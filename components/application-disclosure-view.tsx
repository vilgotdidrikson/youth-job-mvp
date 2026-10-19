"use client";
import { disclosedCvText } from "@/lib/application-disclosure";
import { DAYS, PERIODS } from "@/lib/recruitment-profile";
import type { ApplicationDisclosure } from "@/lib/application-disclosure";
import { getSupabaseClient } from "@/lib/supabase";
import { authenticatedHeaders } from "@/lib/api-client";
import { useState } from "react";

/** Identical content renderer for the youth preview and company application. */
export function ApplicationDisclosureView({ packet, youthPreview = false }: {packet: ApplicationDisclosure; youthPreview?: boolean}) {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const a = packet.practical.availability;
  const cvText = disclosedCvText(packet);
  const openCv = async () => {
    if (busy) return;
    const win = window.open("", "_blank"); if (win) win.opener = null;
    setBusy(true); setError("");
    try {
      let url: string | undefined;
      if (youthPreview) {
        const document = packet.cv.documents[0];
        if (!document) throw Error("CV-filen saknas.");
        const {data,error} = await getSupabaseClient().storage.from("youth-documents").createSignedUrl(document.url,300);
        if(error || !data?.signedUrl) throw Error("Den delade CV-filen kunde inte öppnas. Den kan ha tagits bort.");
        url=data.signedUrl;
      } else {
        const response = await fetch("/api/company/candidate-cv", {method:"POST",headers:{"Content-Type":"application/json",...await authenticatedHeaders()},body:JSON.stringify({jobId:packet.job_id,youthUserId:packet.youth_user_id})});
        const result = await response.json(); if(!response.ok) throw Error(result.error || "CV:t kunde inte hämtas.");
        url=result.url;
      }
      if (!url) throw Error("CV-filen kunde inte öppnas.");
      if(win) win.location.href=url; else setError("Tillåt ett nytt fönster för att öppna CV:t.");
    } catch(reason) { win?.close(); setError(reason instanceof Error ? reason.message : "CV:t kunde inte hämtas."); }
    finally {setBusy(false);}
  };
  return <section aria-label="Delat ansökningsunderlag" className="disclosure-view">
    <header><h2>Ansökningsunderlag</h2><p>{packet.identity.full_name || "Sökande"}{packet.identity.age !== null && ` · ${packet.identity.age} år`}</p><p>{packet.job_title} · {packet.company_name}</p>{packet.revision && <small>Delad version {packet.revision}{packet.shared_at && ` · ${new Date(packet.shared_at).toLocaleString("sv-SE")}`}</small>}</header>
    <section><h3>CV</h3>{packet.cv.documents.length ? <><button type="button" className="secondary-btn" disabled={busy} onClick={() => void openCv()}>{busy ? "Hämtar CV…" : "Öppna delat original-CV"}</button><p>Originalfilen delas som den är och kan innehålla kontaktuppgifter och bostadsadress. Texten nedan ersätter inte innehållet i filen.</p></> : null}{cvText ? <pre style={{whiteSpace:"pre-wrap",fontFamily:"inherit"}}>{cvText}</pre> : !packet.cv.documents.length ? <p>Ingen CV-text finns i detta underlag.</p> : null}{error && <p role="alert">{error}</p>}</section>
    <section><h3>Praktiska uppgifter · självuppgivna</h3><dl><dt>Ungefärligt område</dt><dd>{packet.practical.city || "Inte angivet"}</dd><dt>Dagar</dt><dd>{a.days?.map(day=>DAYS[day as keyof typeof DAYS] ?? day).join(", ") || "Inte angivet"}</dd><dt>Tider</dt><dd>{a.periods?.map(period=>PERIODS[period as keyof typeof PERIODS] ?? period).join(", ") || "Inte angivet"}</dd><dt>Tidigaste start</dt><dd>{a.startDate || "Inte angivet"}</dd><dt>Önskad omfattning</dt><dd>{a.hours ? `${a.hours} timmar/vecka` : "Inte angivet"}</dd></dl></section>
    <section><h3>Valda profiluppgifter för den här ansökan</h3>{packet.profile_items.length ? packet.profile_items.map(item=><div key={item.key}><h4>{item.label}</h4><p style={{whiteSpace:"pre-wrap"}}>{item.text}</p></div>) : <p>Inga ytterligare profiluppgifter delas.</p>}<p>Egna exempel är självuppgivna och innebär inget verifierat personlighetsomdöme.</p></section>
    {(Object.keys(packet.answers ?? {}).length>0 || (packet.followup_answers?.length ?? 0)>0) && <section><h3>Uttryckligen delade svar</h3>{Object.entries(packet.answers ?? {}).map(([id,answer])=><p key={id}>{answer}</p>)}{packet.followup_answers?.map((item,index)=><div key={index}><strong>{item.question}</strong><p>{item.answer}</p></div>)}</section>}
  </section>;
}
