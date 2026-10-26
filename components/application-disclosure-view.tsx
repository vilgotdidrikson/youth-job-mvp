"use client";
import { disclosedCvText } from "@/lib/application-disclosure";
import { DAYS, PERIODS } from "@/lib/recruitment-profile";
import type { ApplicationDisclosure } from "@/lib/application-disclosure";
import { getSupabaseClient } from "@/lib/supabase";
import { authenticatedHeaders } from "@/lib/api-client";
import { useEffect, useId, useRef, useState } from "react";
import { openCvDocument } from "@/lib/open-cv-document";
import styles from "./application-disclosure-view.module.css";

/** Identical content renderer for the youth preview and company application. */
export function ApplicationDisclosureView({ packet, youthPreview = false }: {packet: ApplicationDisclosure; youthPreview?: boolean}) {
  const errorId = useId();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const activeRequest = useRef<AbortController | null>(null);
  useEffect(() => {
    setError(""); setBusy(false);
    return () => { activeRequest.current?.abort(); activeRequest.current = null; };
  }, [packet, youthPreview]);
  const a = packet.practical.availability;
  const cvText = disclosedCvText(packet);
  const openCv = async () => {
    if (activeRequest.current) return;
    const controller = new AbortController();
    activeRequest.current = controller;
    setBusy(true); setError("");
    try {
      await openCvDocument({
        signal: controller.signal,
        openWindow: () => window.open("", "_blank"),
        resolveUrl: async (signal) => {
          if (youthPreview) {
            const document = packet.cv.documents[0];
            if (!document) throw new Error("CV-filen saknas.");
            const { data, error } = await getSupabaseClient().storage.from("youth-documents").createSignedUrl(document.url, 300);
            if (error || !data?.signedUrl) throw new Error("Den delade CV-filen kunde inte öppnas. Den kan ha tagits bort.");
            return data.signedUrl;
          }
          const headers = await authenticatedHeaders();
          const response = await fetch("/api/company/candidate-cv", {
            method: "POST", signal, headers: { "Content-Type": "application/json", ...headers },
            body: JSON.stringify({ jobId: packet.job_id, youthUserId: packet.youth_user_id }),
          });
          const result = await response.json();
          if (!response.ok) throw new Error(result.error || "CV:t kunde inte hämtas.");
          return result.url;
        },
      });
    } catch (reason) {
      if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : "CV:t kunde inte hämtas.");
    } finally {
      if (activeRequest.current === controller) { activeRequest.current = null; setBusy(false); }
    }
  };
  return <section aria-label="Delat ansökningsunderlag" className={`disclosure-view ${styles.root}`}>
    <header className={styles.header}><h2>Ansökningsunderlag</h2><p>{packet.identity.full_name || "Sökande"}{packet.identity.age !== null && ` · ${packet.identity.age} år`}</p><p>{packet.job_title} · {packet.company_name}</p>{packet.revision && <small>Delad version {packet.revision}{packet.shared_at && ` · ${new Date(packet.shared_at).toLocaleString("sv-SE")}`}</small>}</header>
    <section className={styles.panel}><h3>CV</h3>{packet.cv.documents.length ? <><button type="button" className={styles.cvButton} disabled={busy} aria-busy={busy} aria-describedby={error ? errorId : undefined} onClick={() => void openCv()}>{busy ? "Hämtar CV…" : error ? "Försök öppna CV igen" : "Öppna delat original-CV"}</button><p>Originalfilen delas som den är och kan innehålla kontaktuppgifter och bostadsadress. Texten nedan ersätter inte innehållet i filen.</p></> : null}{cvText ? <pre className={styles.cvText}>{cvText}</pre> : !packet.cv.documents.length ? <p>Ingen CV-text finns i detta underlag.</p> : null}{error && <p id={errorId} className={styles.error} role="alert">{error}</p>}</section>
    <section className={styles.panel}><h3>Praktiska uppgifter · självuppgivna</h3><dl><dt>Ungefärligt område</dt><dd>{packet.practical.city || "Inte angivet"}</dd><dt>Dagar</dt><dd>{a.days?.map(day=>DAYS[day as keyof typeof DAYS] ?? day).join(", ") || "Inte angivet"}</dd><dt>Tider</dt><dd>{a.periods?.map(period=>PERIODS[period as keyof typeof PERIODS] ?? period).join(", ") || "Inte angivet"}</dd><dt>Tidigaste start</dt><dd>{a.startDate || "Inte angivet"}</dd><dt>Önskad omfattning</dt><dd>{a.hours ? `${a.hours} timmar/vecka` : "Inte angivet"}</dd></dl></section>
    <section className={styles.panel}><h3>Valda profiluppgifter för den här ansökan</h3>{packet.profile_items.length ? packet.profile_items.map(item=><div className={styles.item} key={item.key}><h4>{item.label}</h4><p className={styles.answer}>{item.text}</p></div>) : <p>Inga ytterligare profiluppgifter delas.</p>}<p>Egna exempel är självuppgivna och innebär inget verifierat personlighetsomdöme.</p></section>
    {(Object.keys(packet.answers ?? {}).length>0 || (packet.followup_answers?.length ?? 0)>0) && <section className={styles.panel}><h3>Uttryckligen delade svar</h3>{Object.entries(packet.answers ?? {}).map(([id,answer])=><p key={id}>{answer}</p>)}{packet.followup_answers?.map((item,index)=><div className={styles.item} key={index}><strong>{item.question}</strong><p>{item.answer}</p></div>)}</section>}
  </section>;
}
