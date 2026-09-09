"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useSession } from "@/hooks/use-session";
import { authenticatedHeaders } from "@/lib/api-client";
import { getYouthProfile, saveUploadedCvToProfile } from "@/lib/onboarding";
import { getSupabaseClient } from "@/lib/supabase";
import { getYouthDocumentSignedUrl, uploadYouthDocument } from "@/lib/storage";
import { renderStructuredCv, structuredCvFromForm, structuredCvToLegacy, type StructuredCvData } from "@/lib/structured-cv";
import type { YouthDocument, YouthProfile } from "@/lib/types";

type FormStep = "about" | "education" | "experience" | "skills" | "languages" | "merits";
type Step = "start" | "pdf" | "review" | "preview" | FormStep;
type Draft = { about: string; school: string; program: string; graduation: string; experience: string; noExperience: boolean; skills: string; languages: string; merits: string; linkedin: string; portfolio: string; otherLink: string };
const EMPTY: Draft = { about: "", school: "", program: "", graduation: "", experience: "", noExperience: false, skills: "", languages: "", merits: "", linkedin: "", portfolio: "", otherLink: "" };
const STEPS: FormStep[] = ["about", "education", "experience", "skills", "languages", "merits"];
const LABELS: Record<FormStep, string> = { about: "Kort om mig", education: "Utbildning", experience: "Erfarenhet", skills: "Kompetenser", languages: "Språk", merits: "Meriter & länkar" };
const YEARS = Array.from({ length: 16 }, (_, i) => String(new Date().getFullYear() + 10 - i));
const SKILLS = ["Service", "Samarbete", "Canva", "Excel", "Sociala medier", "Kassasystem", "Matlagning", "Barnpassning"];
const LANGUAGES = ["Svenska", "Engelska", "Arabiska", "Spanska", "Finska", "Somaliska"];
const append = (value: string, item: string) => value.split(",").map((part) => part.trim()).includes(item) ? value : [value.trim(), item].filter(Boolean).join(", ");

function buildSource(draft: Draft, name: string, city: string) {
  return structuredCvFromForm({
    full_name: name, city, linkedin: draft.linkedin, portfolio: draft.portfolio,
    profile_details: draft.about, strengths: draft.about,
    work_experience: draft.noExperience ? "" : draft.experience,
    skills_text: draft.skills, languages: draft.languages, certificates: draft.merits,
    educations: draft.school || draft.program || draft.graduation ? [{ school: draft.school, degree: draft.program, end_date: draft.graduation }] : [],
    other_entries: draft.otherLink.trim() ? [{ title: "Länk", type: "link", value: draft.otherLink }] : [],
  });
}

function draftFromProfile(profile: YouthProfile): Draft {
  const cv = profile.cv_structured;
  if (cv) return {
    ...EMPTY,
    about: cv.profile.summary ?? cv.profile.sourceNotes.join(" "),
    school: cv.education[0]?.school ?? "",
    program: cv.education[0]?.program ?? "",
    graduation: cv.education[0]?.expectedGraduation ?? cv.education[0]?.endDate ?? "",
    experience: cv.workExperience.flatMap((item) => item.sourceNotes.length ? item.sourceNotes : item.responsibilities).join("\n"),
    noExperience: cv.workExperience.length === 0,
    skills: cv.skills.map((item) => item.name).join(", "),
    languages: cv.languages.map((item) => item.name).join(", "),
    merits: cv.certifications.map((item) => item.name).filter(Boolean).join(", "),
    linkedin: cv.personalInfo.linkedin ?? "",
    portfolio: cv.personalInfo.portfolio ?? "",
    otherLink: cv.otherExperience.find((item) => item.type === "link")?.details[0] ?? "",
  };
  return {
    ...EMPTY,
    about: (profile.strengths ?? []).join(", "),
    school: (profile.education ?? []).join("\n"),
    experience: (profile.work_experience ?? []).join("\n"),
    noExperience: !(profile.work_experience ?? []).length,
    skills: (profile.strengths ?? []).join(", "),
    languages: (profile.languages ?? []).join(", "),
    merits: [profile.certificates, profile.extracurriculars].filter(Boolean).join("\n"),
  };
}

function Chips({ values, selected, onPick }: { values: string[]; selected: string; onPick: (value: string) => void }) {
  const selectedValues = selected.split(",").map((item) => item.trim());
  return <div className="cv-hub-chips">{values.map((value) => <button key={value} type="button" className={selectedValues.includes(value) ? "is-selected" : ""} onClick={() => onPick(value)} aria-pressed={selectedValues.includes(value)}>{value}</button>)}</div>;
}

function sectionSummary(item: FormStep, draft: Draft) {
  if (item === "about") return draft.about || "Inte ifyllt ännu";
  if (item === "education") return [draft.school, draft.program, draft.graduation].filter(Boolean).join(" · ") || "Inte ifyllt ännu";
  if (item === "experience") return draft.noExperience ? "Ingen erfarenhet ännu" : draft.experience || "Inte ifyllt ännu";
  if (item === "skills") return draft.skills || "Inte ifyllt ännu";
  if (item === "languages") return draft.languages || "Inte ifyllt ännu";
  return [draft.merits, draft.linkedin, draft.portfolio, draft.otherLink].filter(Boolean).join(" · ") || "Inte ifyllt ännu";
}

export function YouthCvHub({ initialCreate = false }: { initialCreate?: boolean }) {
  const router = useRouter();
  const query = useSearchParams();
  const { user, profile, loading } = useSession();
  const jobId = query.get("job");
  const title = query.get("title");
  const returnPath = jobId && /^[0-9a-f-]{36}$/i.test(jobId) ? `/jobb/${jobId}` : "/profile";
  const [step, setStep] = useState<Step>(initialCreate ? "about" : "start");
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [name, setName] = useState("");
  const [city, setCity] = useState("");
  const [ready, setReady] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [uploaded, setUploaded] = useState<YouthDocument | null>(null);
  const [generated, setGenerated] = useState<{ text: string; structured: StructuredCvData } | null>(null);
  const [returnToReview, setReturnToReview] = useState(false);
  const [editedSections, setEditedSections] = useState<FormStep[]>([]);
  const [supportsStructuredCv, setSupportsStructuredCv] = useState(false);
  const [supportsCvExtras, setSupportsCvExtras] = useState(false);
  const key = `employo-cv-hub-draft:${user?.id ?? "anonymous"}`;
  const index = STEPS.indexOf(step as FormStep);
  const source = useMemo(() => buildSource(draft, name, city), [draft, name, city]);
  const update = (field: keyof Draft, value: string | boolean) => setDraft((current) => ({ ...current, [field]: value }));

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
    if (!loading && profile?.role && profile.role !== "youth") router.replace("/profile");
  }, [loading, profile?.role, router, user]);
  useEffect(() => {
    if (!user?.id) return;
    let active = true;
    void (async () => {
      try {
        const youth = await getYouthProfile(user.id);
        if (!active) return;
        setName(youth?.full_name ?? ""); setCity(youth?.city ?? "");
        setSupportsStructuredCv(Object.prototype.hasOwnProperty.call(youth ?? {}, "cv_structured"));
        setSupportsCvExtras(Object.prototype.hasOwnProperty.call(youth ?? {}, "certificates") && Object.prototype.hasOwnProperty.call(youth ?? {}, "extracurriculars"));
        const docs = Array.isArray(youth?.documents) ? youth.documents : [];
        setUploaded(docs.find((doc) => doc.type === "cv") ?? null);
        const saved = localStorage.getItem(key);
        if (query.get("edit") === "1" && (youth?.cv_structured || youth?.cv_text)) {
          const existingDraft = draftFromProfile(youth);
          const existingStructured = youth.cv_structured ?? buildSource(existingDraft, youth.full_name ?? "", youth.city ?? "");
          setDraft(existingDraft);
          setGenerated({ text: youth.cv_text || renderStructuredCv(existingStructured), structured: existingStructured });
          setStep("preview");
        } else if (query.get("voice") === "finalize") {
          const voice = sessionStorage.getItem("employo-voice-cv-structured");
          if (voice) {
            const cv = JSON.parse(voice) as StructuredCvData;
            setDraft({ ...EMPTY, about: cv.profile.summary ?? cv.profile.sourceNotes.join(" "), skills: cv.skills.map((item) => item.name).join(", "), languages: cv.languages.map((item) => item.name).join(", "), merits: cv.certifications.map((item) => item.name).filter(Boolean).join(", "), experience: cv.workExperience.flatMap((item) => item.sourceNotes).join("\n"), school: cv.education[0]?.school ?? "", program: cv.education[0]?.program ?? "", graduation: cv.education[0]?.expectedGraduation ?? cv.education[0]?.endDate ?? "" });
            setStep("merits");
          }
        } else if (saved) {
          const parsed = JSON.parse(saved) as { step?: Step; draft?: Partial<Draft>; returnToReview?: boolean; editedSections?: FormStep[] };
          if (parsed.draft) setDraft({ ...EMPTY, ...parsed.draft });
          if (parsed.step && !["start", "pdf", "preview", "review"].includes(parsed.step)) setStep(parsed.step);
          setReturnToReview(Boolean(parsed.returnToReview));
          setEditedSections(parsed.editedSections ?? []);
        }
      } catch { if (active) setError("Kunde inte läsa ditt sparade utkast."); }
      finally { if (active) setReady(true); }
    })();
    return () => { active = false; };
  }, [key, query, user?.id]);
  useEffect(() => {
    if (ready && user && !["start", "pdf", "preview"].includes(step)) localStorage.setItem(key, JSON.stringify({ step, draft, returnToReview, editedSections }));
  }, [draft, editedSections, key, ready, returnToReview, step, user]);

  const generate = async () => {
    setError(""); setGenerating(true);
    try {
      const response = await fetch("/api/youth/cv/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(await authenticatedHeaders()) },
        body: JSON.stringify({ structured: source, profile_details: draft.about, work_experience: draft.noExperience ? "" : draft.experience, skills_text: draft.skills, languages: draft.languages, certificates: draft.merits, linkedin: draft.linkedin, portfolio: draft.portfolio }),
      });
      const result = await response.json() as { cv?: string; structured?: StructuredCvData; error?: string };
      if (!response.ok || !result.cv || !result.structured) throw new Error(result.error ?? "Kunde inte skriva CV:t just nu.");
      setGenerated({ text: result.cv, structured: result.structured });
      setReturnToReview(false);
      setStep("preview");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Kunde inte skapa CV:t. Dina svar är kvar."); }
    finally { setGenerating(false); }
  };
  const advance = (skip = false) => {
    setError("");
    if (!skip && step === "about" && !draft.about.trim()) { setError("Skriv några ord om dig själv, eller hoppa över och fyll i senare."); return; }
    if (returnToReview) { setEditedSections((current) => current.includes(step as FormStep) ? current : [...current, step as FormStep]); setGenerated({ text: renderStructuredCv(source), structured: source }); setStep("preview"); setReturnToReview(false); return; }
    if (step === "merits") { if (canUseAi) void generate(); else prepareManualPreview(); return; }
    setStep(STEPS[index + 1]);
  };
  const prepareManualPreview = () => {
    setGenerated({ text: renderStructuredCv(source), structured: source });
    setReturnToReview(false);
    setStep("preview");
  };
  const canUseAi = true;
  const finish = async () => {
    if (!user?.id || !generated) return;
    setSaving(true); setError("");
    try {
      const legacy = structuredCvToLegacy(generated.structured);
      const client = getSupabaseClient();
      const { error: saveError } = await client.from("youth_profiles").update({
        cv_text: generated.text, cv_generated: true,
        strengths: legacy.strengths, work_experience: legacy.workExperience, education: legacy.education,
        languages: legacy.languages,
      }).eq("user_id", user.id);
      if (saveError) throw saveError;
      if (supportsStructuredCv || supportsCvExtras) {
        const extendedPayload: Record<string, unknown> = {};
        if (supportsStructuredCv) extendedPayload.cv_structured = generated.structured;
        if (supportsCvExtras) {
          extendedPayload.certificates = legacy.certificates.join("\n") || null;
          extendedPayload.extracurriculars = legacy.extracurriculars.join("\n") || null;
        }
        const { error: extendedSaveError } = await client.from("youth_profiles").update(extendedPayload).eq("user_id", user.id);
        if (extendedSaveError) console.warn("Kunde inte spara utökade CV-fält:", extendedSaveError.message);
      }
      localStorage.removeItem(key); setMessage("Ditt CV är klart!");
      window.setTimeout(() => router.push(returnPath), 650);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Kunde inte göra klart ditt CV."); }
    finally { setSaving(false); }
  };
  const upload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]; if (!file) return;
    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) { setError("Välj en PDF-fil."); return; }
    if (file.size > 5 * 1024 * 1024) { setError("PDF:en är för stor. Max är 5 MB."); return; }
    setSaving(true); setError("");
    try { const url = await uploadYouthDocument(file); const document = { name: file.name, url, type: "cv" as const }; await saveUploadedCvToProfile(document); setUploaded(document); localStorage.removeItem(key); setMessage("Ditt CV är uppladdat och klart."); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Kunde inte ladda upp PDF:en."); }
    finally { setSaving(false); event.target.value = ""; }
  };
  const jobNote = jobId ? <aside className="cv-hub-job">CV:t behövs för: <strong>{title || "det valda jobbet"}</strong><Link href={returnPath}>Tillbaka till jobbet</Link></aside> : null;

  if (loading || !ready) return <main className="mobile-shell cv-hub"><p>Laddar ditt CV...</p></main>;
  if (step === "start") return <main className="mobile-shell cv-hub">
    <Link href={returnPath} className="cv-hub-back">← Tillbaka</Link>{jobNote}
    <p className="cv-hub-eyebrow">Ditt nästa steg</p><h1>Skapa ditt CV</h1>
    <p className="cv-hub-lead">Svara fritt med egna ord. AI:n ordnar sedan dina fakta till ett CV som du själv granskar och redigerar.</p>
    <div className="cv-hub-options">
      <button className="cv-hub-option recommended" onClick={() => setStep("about")}><span>Rekommenderat</span><strong>Skapa med guidat formulär</strong><small>Svara på enkla frågor. Tar cirka 3–5 minuter.</small></button>
      <button className="cv-hub-option" onClick={() => setStep("pdf")}><strong>Ladda upp ett CV</strong><small>Ladda upp en PDF om du redan har ett CV.</small></button>
      <Link className="cv-hub-option" href={`/voice-cv${jobId ? `?job=${encodeURIComponent(jobId)}${title ? `&title=${encodeURIComponent(title)}` : ""}` : ""}`}><strong>Prata fram ditt CV <em>Valfritt</em></strong><small>Svara muntligt på frågor.</small></Link>
    </div>{error && <p className="cv-hub-error">{error}</p>}
  </main>;
  if (step === "pdf") return <main className="mobile-shell cv-hub">
    <button className="cv-hub-back" onClick={() => setStep("start")}>← Tillbaka till valen</button>{jobNote}
    <p className="cv-hub-eyebrow">Ladda upp PDF</p><h1>Har du redan ett CV?</h1><p className="cv-hub-lead">Välj en PDF på högst 5 MB.</p>
    <label className="cv-hub-upload"><input type="file" accept="application/pdf,.pdf" onChange={(event) => void upload(event)} disabled={saving} />{saving ? "Laddar upp..." : "Välj PDF"}</label>
    {uploaded && <section className="cv-hub-status"><strong>CV uppladdat</strong><p>{uploaded.name}</p><button onClick={() => void getYouthDocumentSignedUrl(uploaded.url).then((url) => window.open(url, "_blank", "noopener,noreferrer")).catch(() => setError("Kunde inte öppna PDF:en."))}>Förhandsvisa PDF</button></section>}
    {message && <p className="cv-hub-success">{message}</p>}{error && <p className="cv-hub-error">{error}</p>}
  </main>;
  if (step === "review") return <main className="mobile-shell cv-hub cv-hub-review-page">
    <Link href={returnPath} className="cv-hub-back">← Tillbaka till profilen</Link>{jobNote}
    <p className="cv-hub-eyebrow">Redigera CV</p><h1>Gör dina ändringar i lugn och ro</h1>
    <p className="cv-hub-lead">Välj en del i taget. Dina ändringar sparas här medan du arbetar och syns när du förhandsvisar CV:t.</p>
    <section className="cv-hub-saved-banner" aria-live="polite">
      <strong>{editedSections.length ? "Ändringar sparade" : "Ditt redigeringsutkast"}</strong>
      <span>{editedSections.length ? `${editedSections.length} ${editedSections.length === 1 ? "del är" : "delar är"} sparad${editedSections.length === 1 ? "" : "e"}.` : "Välj en del för att börja redigera."}</span>
    </section>
    <div className="cv-hub-review-list">
      {STEPS.map((item) => <button className="cv-hub-review-card" key={item} type="button" onClick={() => { setReturnToReview(true); setStep(item); }}><span className="cv-hub-review-card-copy"><strong>{LABELS[item]}</strong><small>{sectionSummary(item, draft)}</small></span><span className="cv-hub-review-card-meta">{editedSections.includes(item) && <em>Sparat</em>}<b>Ändra</b></span></button>)}
    </div>
    <button className="cta-btn" disabled={generating} onClick={() => { if (canUseAi) void generate(); else prepareManualPreview(); }}>{generating ? "AI:n skriver ditt CV..." : canUseAi ? "Skapa mitt CV" : "Förhandsvisa ändringar"}</button>
    <p className="cv-hub-cost-note">{canUseAi ? "AI:n används bara för den första versionen. Du kan göra hur många ändringar du vill innan dess." : "Det här CV:t uppdateras utan AI. Dina sparade ändringar visas i förhandsvisningen."}</p>
    {error && <p className="cv-hub-error">{error}</p>}
  </main>;
  if (step === "preview") return <main className="mobile-shell cv-hub cv-hub-preview-page">
    <Link href={returnPath} className="cv-hub-back">← Tillbaka till profilen</Link>{jobNote}
    <p className="cv-hub-eyebrow">Din CV-förhandsvisning</p><h1>Så här kommer företag att se din profil.</h1>
    <p className="cv-hub-status"><strong>Status: redo att granska</strong><br />Dina ändringar är med. Du kan redigera manuellt eller be AI:n skriva en ny version när du vill.</p>
    <div className="cv-hub-edit-links">{STEPS.map((item) => <button key={item} onClick={() => { setReturnToReview(true); setStep(item); }}>Redigera {LABELS[item]}</button>)}</div>
    <textarea className="cv-hub-preview" value={generated?.text ?? ""} onChange={(event) => setGenerated((current) => current ? { ...current, text: event.target.value } : current)} rows={20} />
    <button className="cv-hub-skip" disabled={generating} onClick={() => void generate()}>{generating ? "AI:n skriver en ny version..." : "Skriv om med AI"}</button>
    <button className="cta-btn" disabled={saving || !generated?.text.trim()} onClick={() => void finish()}>{saving ? "Gör klart..." : "Gör mitt CV klart"}</button>
    {error && <p className="cv-hub-error">{error}</p>}{message && <p className="cv-hub-success">{message}</p>}
  </main>;

  return <main className="mobile-shell cv-hub">
    <button className="cv-hub-back" onClick={() => { if (returnToReview) { setReturnToReview(false); setStep("preview"); } else setStep(index <= 0 ? "start" : STEPS[index - 1]); }}>← {returnToReview ? "Tillbaka till förhandsvisningen" : "Tillbaka"}</button>{jobNote}
    <p className="cv-hub-eyebrow">Steg {index + 1} av {STEPS.length}</p><div className="cv-hub-progress"><span style={{ width: `${Math.round(((index + 1) / STEPS.length) * 100)}%` }} /></div><h1>{LABELS[step]}</h1>
    <div className="cv-hub-form">
      {step === "about" && <><p>Skriv som du vill. Exempel: vad du gillar, hur du är som person och vad du vill lära dig.</p><textarea autoFocus rows={6} value={draft.about} onChange={(event) => update("about", event.target.value)} placeholder="Skriv kort om dig själv" /></>}
      {step === "education" && <><p>Valfritt. Lägg till det du vill att arbetsgivaren ska känna till.</p><input value={draft.school} onChange={(event) => update("school", event.target.value)} placeholder="Skola" /><input value={draft.program} onChange={(event) => update("program", event.target.value)} placeholder="Program eller inriktning" /><label>Planerad examen<select value={draft.graduation} onChange={(event) => update("graduation", event.target.value)}><option value="">Välj år (valfritt)</option>{YEARS.map((year) => <option key={year}>{year}</option>)}</select></label></>}
      {step === "experience" && <><p>Skriv fritt. Ett starkt svar beskriver <strong>när, var, vad, hur och hur länge</strong>: “Sommaren 2025 hjälpte jag i mammas café i fyra veckor, tog beställningar och höll rent.”</p><textarea rows={7} disabled={draft.noExperience} value={draft.experience} onChange={(event) => update("experience", event.target.value)} placeholder="Berätta om jobb, praktik, ansvar hemma eller förening" /><label className="cv-hub-check"><input type="checkbox" checked={draft.noExperience} onChange={(event) => update("noExperience", event.target.checked)} /> Jag har ingen erfarenhet ännu</label></>}
      {step === "skills" && <><p>Skriv fritt eller välj piller. Välj bara sådant du faktiskt kan eller har använt.</p><textarea rows={4} value={draft.skills} onChange={(event) => update("skills", event.target.value)} placeholder="T.ex. Jag är bra på att möta kunder och har använt Excel i skolan" /><Chips values={SKILLS} selected={draft.skills} onPick={(chip) => update("skills", draft.skills.split(",").map((item) => item.trim()).includes(chip) ? draft.skills.split(",").map((item) => item.trim()).filter((item) => item !== chip).join(", ") : append(draft.skills, chip))} /></>}
      {step === "languages" && <><p>Skriv fritt eller tryck på ett språk.</p><input value={draft.languages} onChange={(event) => update("languages", event.target.value)} placeholder="T.ex. svenska, engelska" /><Chips values={LANGUAGES} selected={draft.languages} onPick={(chip) => update("languages", draft.languages.split(",").map((item) => item.trim()).includes(chip) ? draft.languages.split(",").map((item) => item.trim()).filter((item) => item !== chip).join(", ") : append(draft.languages, chip))} /></>}
      {step === "merits" && <><p>Valfritt: körkort, certifikat, förening eller en länk som visar mer om dig.</p><textarea rows={4} value={draft.merits} onChange={(event) => update("merits", event.target.value)} placeholder="T.ex. HLR-utbildning, ledare i en förening" /><input type="url" value={draft.linkedin} onChange={(event) => update("linkedin", event.target.value)} placeholder="LinkedIn-länk (valfritt)" /><input type="url" value={draft.portfolio} onChange={(event) => update("portfolio", event.target.value)} placeholder="Portfolio, GitHub eller egen hemsida (valfritt)" /><input type="url" value={draft.otherLink} onChange={(event) => update("otherLink", event.target.value)} placeholder="Annan länk, t.ex. ett projekt (valfritt)" /></>}
    </div>
    <button className="cta-btn" disabled={generating} onClick={() => advance()}>{generating ? "AI:n skriver ditt CV..." : returnToReview ? "Spara ändringen" : step === "merits" ? canUseAi ? "Skapa min CV-förhandsvisning" : "Förhandsvisa ändringar" : "Fortsätt"}</button>
    <button className="cv-hub-skip" disabled={generating} onClick={() => advance(true)}>{returnToReview ? "Spara och återgå till förhandsvisningen" : step === "about" ? "Jag vill skriva detta senare" : "Hoppa över"}</button>
    {error && <p className="cv-hub-error">{error}</p>}
  </main>;
}
