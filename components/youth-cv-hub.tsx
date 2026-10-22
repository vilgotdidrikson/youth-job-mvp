"use client";

import { ProfileStepComplete } from "./profile-journey";
import { VOICE_CV_ENABLED } from "@/lib/feature-flags";

import { voiceCvStorageKey } from "@/lib/voice-cv-storage";

import Link from "next/link";
import { UiIcon } from "./ui-icon";
import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useSession } from "@/hooks/use-session";
import { authenticatedHeaders } from "@/lib/api-client";
import { getYouthProfile, saveUploadedCvToProfile, saveReviewedCvToProfile } from "@/lib/onboarding";
import { getYouthDocumentSignedUrl, uploadYouthDocument } from "@/lib/storage";
import { renderStructuredCv, structuredCvFromForm, type StructuredCvData } from "@/lib/structured-cv";
import { submitApplicationDraftsAfterCv, type ApplicationDraftSubmissionResult } from "@/lib/youth-job-flow";
import type { YouthDocument, YouthProfile } from "@/lib/types";
import { useVerifiedExperience } from "@/hooks/use-verified-experience";
import { withVerifiedExperience } from "@/lib/recruitment-types";
import { CvFactReview } from "./cv-fact-review";
import { cvReviewSnapshot, cvSourceText, hasApprovedCv } from "@/lib/cv-fact-review";

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

function completedCvMessage(result: ApplicationDraftSubmissionResult, fallback: string) {
  const parts = [fallback];
  if (result.sent === 1) parts.push("Din sparade ansökan har skickats.");
  if (result.sent > 1) parts.push(`${result.sent} sparade ansökningar har skickats.`);
  if (result.unavailable === 1) parts.push("En annons tar inte längre emot ansökningar.");
  if (result.unavailable > 1) parts.push(`${result.unavailable} annonser tar inte längre emot ansökningar.`);
  if (result.pending > 0) parts.push(`${result.pending} ansökningar behöver kompletteras. Öppna Dina ansökningar för att svara eller skicka med uppgift saknas.`);
  return parts.join(" ");
}

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
    experience: cv.workExperience.map((item) => [item.role, item.employer, item.startDate, item.endDate, item.duration, ...item.responsibilities].filter(Boolean).join(" – ")).join("\n"),
    noExperience: cv.workExperience.length === 0,
    skills: cv.skills.map((item) => item.name).join(", "),
    languages: cv.languages.map((item) => [item.name, item.level].filter(Boolean).join(" – ")).join(", "),
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

function Chips({ values, selected, onPick, label }: { values: string[]; selected: string; onPick: (value: string) => void; label: string }) {
  const selectedValues = selected.split(",").map((item) => item.trim());
  return <div className="cv-hub-chips" role="group" aria-label={label}>{values.map((value) => <button key={value} type="button" className={selectedValues.includes(value) ? "is-selected" : ""} onClick={() => onPick(value)} aria-pressed={selectedValues.includes(value)}>{value}</button>)}</div>;
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
  const verified = useVerifiedExperience(user?.id);
  const jobId = query.get("job");
  const title = query.get("title");
  const inJourney = query.get("return") === "build" && !jobId;
  const [completed,setCompleted] = useState(false);
  const returnPath = jobId && /^[0-9a-f-]{36}$/i.test(jobId) ? `/jobb/${jobId}` : inJourney ? "/profile/build" : "/profile?tab=work";
  const [step, setStep] = useState<Step>(initialCreate ? "about" : "start");
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [name, setName] = useState("");
  const [city, setCity] = useState("");
  const [ready, setReady] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [draftStorageUnavailable, setDraftStorageUnavailable] = useState(false);
  const [uploaded, setUploaded] = useState<YouthDocument | null>(null);
  const [generated, setGenerated] = useState<{ text: string; structured: StructuredCvData } | null>(null);
  const [approvedSnapshot, setApprovedSnapshot] = useState<string | null>(null);
  const [reviewSource, setReviewSource] = useState("");
  const factsApproved = generated ? hasApprovedCv(approvedSnapshot, generated.text, generated.structured) : false;
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
          setReviewSource(youth.cv_text || renderStructuredCv(existingStructured));
          setGenerated({ text: youth.cv_text || renderStructuredCv(existingStructured), structured: existingStructured });
          setStep("preview");
        } else if (VOICE_CV_ENABLED && query.get("voice") === "finalize") {
          const voice = sessionStorage.getItem(voiceCvStorageKey("employo-voice-cv-structured", user?.id));
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
        } else if (youth) {
          setDraft(draftFromProfile(youth));
        }
      } catch { if (active) setError("Kunde inte läsa ditt sparade utkast."); }
      finally { if (active) setReady(true); }
    })();
    return () => { active = false; };
  }, [key, query, user?.id]);
  useEffect(() => {
    if (ready && user && !["start", "pdf", "preview"].includes(step)) {
      try { localStorage.setItem(key, JSON.stringify({ step, draft, returnToReview, editedSections })); setDraftStorageUnavailable(false); }
      catch { setDraftStorageUnavailable(true); }
    }
  }, [draft, editedSections, key, ready, returnToReview, step, user]);

  useEffect(() => {
    if (ready) window.scrollTo({ top: 0, behavior: "instant" });
  }, [ready, step]);

  const generate = async () => {
    setError(""); setGenerating(true);
    setApprovedSnapshot(null);
    setReviewSource(cvSourceText(source));
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
    setApprovedSnapshot(null);
    if (!skip && step === "about" && !draft.about.trim()) { setError("Skriv några ord om dig själv, eller hoppa över och fyll i senare."); return; }
    if (returnToReview) { setEditedSections((current) => current.includes(step as FormStep) ? current : [...current, step as FormStep]); setGenerated({ text: renderStructuredCv(source), structured: source }); setStep("preview"); setReturnToReview(false); return; }
    if (step === "merits") { if (canUseAi) void generate(); else prepareManualPreview(); return; }
    setStep(STEPS[index + 1]);
  };
  const prepareManualPreview = () => {
    setApprovedSnapshot(null);
    setGenerated({ text: renderStructuredCv(source), structured: source });
    setReturnToReview(false);
    setStep("preview");
  };
  const canUseAi = true;
  const finish = async () => {
    if (!user?.id || !generated) return;
    if (!factsApproved || generating || saving) { setError("Granska och godkänn CV-texten och profilfakta innan du sparar."); return; }
    setSaving(true); setError("");
    try {
      if (!supportsStructuredCv || !supportsCvExtras) throw new Error("Profilen saknar stöd för samordnade CV-fakta. Kontakta support; din text finns kvar.");
      await saveReviewedCvToProfile(generated.text, generated.structured, approvedSnapshot);
      const applications = await submitApplicationDraftsAfterCv().catch(() => null);
      if (VOICE_CV_ENABLED && query.get("voice") === "finalize") {
        for (const base of ["employo-voice-cv-answers", "employo-voice-cv-structured", "employo-voice-cv-conversation", "employo-voice-cv-draft"]) sessionStorage.removeItem(voiceCvStorageKey(base, user.id));
      }
      try { localStorage.removeItem(key); } catch { /* Saving to the account succeeded. */ }
      setMessage(applications ? completedCvMessage(applications, "Ditt CV är klart!") : "Ditt CV är sparat. Status för dina väntande ansökningar kunde inte bekräftas. Kontrollera Dina ansökningar.");
      setCompleted(true);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Kunde inte göra klart ditt CV."); }
    finally { setSaving(false); }
  };
  const upload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]; if (!file || saving) return;
    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) { setError("Välj en PDF-fil."); return; }
    if (file.size > 5 * 1024 * 1024) { setError("PDF:en är för stor. Max är 5 MB."); return; }
    setSaving(true); setError("");
    try {
      const url = await uploadYouthDocument(file);
      const document = { name: file.name, url, type: "cv" as const };
      await saveUploadedCvToProfile(document);
      const applications = await submitApplicationDraftsAfterCv().catch(() => null);
      setUploaded(document);
      try { localStorage.removeItem(key); } catch { /* Saving to the account succeeded. */ }
      setMessage(applications ? completedCvMessage(applications, "Ditt CV är uppladdat och klart.") : "Ditt CV är sparat. Status för dina väntande ansökningar kunde inte bekräftas. Kontrollera Dina ansökningar.");
      setCompleted(true);
    }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Kunde inte ladda upp PDF:en."); }
    finally { setSaving(false); event.target.value = ""; }
  };
  const jobNote = jobId ? <aside className="cv-hub-job">CV:t behövs för: <strong>{title || "det valda jobbet"}</strong><Link href={returnPath}>Tillbaka till jobbet</Link></aside> : null;

  if (loading || !ready) return <main className="mobile-shell cv-hub"><p>Laddar ditt CV...</p></main>;
  if (completed) return <main className="mobile-shell cv-hub"><h1>Ditt CV är sparat</h1><p role="status" className="cv-hub-success">{message}</p>{inJourney ? <ProfileStepComplete step="cv"/> : <div className="mnw-profile-buttons"><Link className="cta-btn" href={returnPath}>{jobId?"Tillbaka till jobbet":"Till min jobbprofil"}</Link><Link className="secondary-btn" href="/applications">Dina ansökningar</Link></div>}</main>;
  if (step === "start") return <main className="mobile-shell cv-hub">
    
    {/* In the profile journey the step menu leads back; a back link appears once a CV method is chosen. */}
    {!inJourney && <Link href={returnPath} className="cv-hub-back">← Tillbaka</Link>}{jobNote}
    <h1>Skapa ditt CV</h1>
    <div className="cv-hub-options">
      <button className="cv-hub-option recommended" onClick={() => setStep("about")}><span className="cv-hub-option-icon"><UiIcon name="edit" width="25" height="25" /></span><span className="cv-hub-option-recommended">Rekommenderat</span><strong>Skapa med guidat formulär</strong><small>Svara på några frågor så skriver AI:n ett CV som du granskar. Cirka 3–5 min.</small></button>
      <button className="cv-hub-option" onClick={() => setStep("pdf")}><span className="cv-hub-option-icon"><UiIcon name="upload" width="25" height="25" /></span><strong>Ladda upp ett CV</strong><small>Har du redan ett CV? PDF, max 5 MB.</small></button>
      {VOICE_CV_ENABLED && <Link className="cv-hub-option" href={`/voice-cv${jobId ? `?job=${encodeURIComponent(jobId)}${title ? `&title=${encodeURIComponent(title)}` : ""}` : ""}`}><span className="cv-hub-option-icon"><UiIcon name="microphone" width="25" height="25" /></span><strong>Prata fram ditt CV <em>Valfritt</em></strong><small>Svara muntligt på frågor.</small></Link>}
    </div>{error && <p role="alert" className="cv-hub-error">{error}</p>}
  </main>;
  if (step === "pdf") return <main className="mobile-shell cv-hub">
    
    <button className="cv-hub-back" onClick={() => setStep("start")}>← Tillbaka till valen</button>{jobNote}
    <p className="cv-hub-eyebrow">Ladda upp PDF</p><h1>Har du redan ett CV?</h1><p className="cv-hub-lead">Välj en PDF på högst 5 MB.</p>
    <label className="cv-hub-upload"><input type="file" accept="application/pdf,.pdf" onChange={(event) => void upload(event)} disabled={saving} />{saving ? "Laddar upp..." : "Välj PDF"}</label>
    {uploaded && <section className="cv-hub-status"><strong>CV uppladdat</strong><p>{uploaded.name}</p><button onClick={() => void getYouthDocumentSignedUrl(uploaded.url).then((url) => window.open(url, "_blank", "noopener,noreferrer")).catch(() => setError("Kunde inte öppna PDF:en."))}>Förhandsvisa PDF</button></section>}
    {message && <p role="status" className="cv-hub-success">{message} <Link href="/applications">Dina ansökningar →</Link></p>}{error && <p role="alert" className="cv-hub-error">{error}</p>}
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
    {error && <p role="alert" className="cv-hub-error">{error}</p>}
  </main>;
  if (step === "preview") return <main className="mobile-shell cv-hub cv-hub-preview-page">
    
    <Link href={returnPath} className="cv-hub-back">← Tillbaka till profilen</Link>{jobNote}
    <h1>Granska ditt CV</h1>
    <div className="cv-hub-edit-links" role="group" aria-label="Redigera en del av CV:t"><span aria-hidden="true">Redigera:</span>{STEPS.map((item) => <button key={item} onClick={() => { setReturnToReview(true); setStep(item); }}>{LABELS[item]}</button>)}</div>
    <textarea aria-label="Redigera CV-förhandsvisningen" className="cv-hub-preview" disabled={saving || generating} value={generated?.text ?? ""} onChange={(event) => { setApprovedSnapshot(null); setGenerated((current) => current ? { ...current, text: event.target.value } : current); }} rows={20} />
    {generated && <CvFactReview text={generated.text} onSync={(cv) => { setApprovedSnapshot(null); setReviewSource(generated.text); setGenerated({ text: generated.text, structured: cv }); }} cv={generated.structured} sourceText={reviewSource || cvSourceText(source)} approved={factsApproved} disabled={saving || generating}
      onApprove={(approved) => setApprovedSnapshot(approved ? cvReviewSnapshot(generated.text, generated.structured) : null)}
      onChange={(cv) => { setApprovedSnapshot(null); setGenerated({ text: renderStructuredCv(cv), structured: cv }); }} />}
    {verified.items.some(item => item.include_in_cv) && <section className="card" style={{padding:"1rem",margin:"1rem 0"}}><h2>Bekräftad erfarenhet som läggs till automatiskt</h2><pre style={{whiteSpace:"pre-wrap",fontFamily:"inherit",fontSize:".85rem"}}>{withVerifiedExperience("", verified.items)}</pre><Link href="/profile">Ändra vad som tas med på din profil →</Link></section>}
    {verified.error && <p role="alert" className="cv-hub-error">{verified.error}</p>}
    <button className="cv-hub-skip" disabled={generating} onClick={() => void generate()}>{generating ? "AI:n skriver en ny version..." : "Skriv om med AI"}</button>
    <button className="cta-btn" disabled={saving || generating || !factsApproved} onClick={() => void finish()}>{saving ? "Gör klart..." : "Gör mitt CV klart"}</button>
    {error && <p role="alert" className="cv-hub-error">{error}</p>}{message && <p role="status" className="cv-hub-success">{message} <Link href="/applications">Dina ansökningar →</Link></p>}
  </main>;

  return <main className="mobile-shell cv-hub">
    
    {/* One compact row (back + question count) above a thin bar; the journey header above already shows the five profile steps. */}
    <div className="cv-hub-question-head">
      <div><button className="cv-hub-back" onClick={() => { if (returnToReview) { setReturnToReview(false); setStep("preview"); } else setStep(index <= 0 ? "start" : STEPS[index - 1]); }}>← {returnToReview ? "Tillbaka till förhandsvisningen" : "Tillbaka"}</button><span>Fråga {index + 1} av {STEPS.length}</span></div>
      <div className="cv-hub-progress" role="progressbar" aria-label="Frågor i CV-formuläret" aria-valuemin={0} aria-valuemax={STEPS.length} aria-valuenow={index + 1}><span style={{ width: `${Math.round(((index + 1) / STEPS.length) * 100)}%` }} /></div>
    </div>{jobNote}<h1>{LABELS[step]}</h1>
    <div className="cv-hub-form">
      {step === "about" && <><p>Till exempel vad du gillar, hur du är och vad du vill lära dig.</p><textarea aria-label="Kort om mig" autoFocus rows={6} value={draft.about} onChange={(event) => update("about", event.target.value)} placeholder="Skriv kort om dig själv" /></>}
      {step === "education" && <><p>Valfritt.</p><input aria-label="Skola" value={draft.school} onChange={(event) => update("school", event.target.value)} placeholder="Skola" /><input aria-label="Program eller inriktning" value={draft.program} onChange={(event) => update("program", event.target.value)} placeholder="Program eller inriktning" /><label>Planerad examen<select value={draft.graduation} onChange={(event) => update("graduation", event.target.value)}><option value="">Välj år (valfritt)</option>{YEARS.map((year) => <option key={year}>{year}</option>)}</select></label></>}
      {step === "experience" && <><p>Skriv <strong>när, var, vad och hur länge</strong>. T.ex. “Sommaren 2025 hjälpte jag i mammas café i fyra veckor, tog beställningar och höll rent.”</p><textarea aria-label="Erfarenhet" rows={7} disabled={draft.noExperience} value={draft.experience} onChange={(event) => update("experience", event.target.value)} placeholder="Berätta om jobb, praktik, ansvar hemma eller förening" /><label className="cv-hub-check"><input type="checkbox" checked={draft.noExperience} onChange={(event) => update("noExperience", event.target.checked)} /> Jag har ingen erfarenhet ännu</label></>}
      {step === "skills" && <><p>Skriv eller välj bland förslagen – bara sådant du faktiskt kan.</p><textarea aria-label="Kompetenser" rows={4} value={draft.skills} onChange={(event) => update("skills", event.target.value)} placeholder="T.ex. Jag är bra på att möta kunder och har använt Excel i skolan" /><Chips label="Förslag på kompetenser" values={SKILLS} selected={draft.skills} onPick={(chip) => update("skills", draft.skills.split(",").map((item) => item.trim()).includes(chip) ? draft.skills.split(",").map((item) => item.trim()).filter((item) => item !== chip).join(", ") : append(draft.skills, chip))} /></>}
      {step === "languages" && <><p>Skriv fritt eller tryck på ett språk.</p><input aria-label="Språk" value={draft.languages} onChange={(event) => update("languages", event.target.value)} placeholder="T.ex. svenska, engelska" /><Chips label="Förslag på språk" values={LANGUAGES} selected={draft.languages} onPick={(chip) => update("languages", draft.languages.split(",").map((item) => item.trim()).includes(chip) ? draft.languages.split(",").map((item) => item.trim()).filter((item) => item !== chip).join(", ") : append(draft.languages, chip))} /></>}
      {step === "merits" && <><p>Valfritt: körkort, certifikat, förening eller en länk som visar mer om dig.</p><textarea aria-label="Meriter och certifikat" rows={4} value={draft.merits} onChange={(event) => update("merits", event.target.value)} placeholder="T.ex. HLR-utbildning, ledare i en förening" /><input aria-label="LinkedIn-länk" type="url" value={draft.linkedin} onChange={(event) => update("linkedin", event.target.value)} placeholder="LinkedIn-länk (valfritt)" /><input aria-label="Portfolio eller hemsida" type="url" value={draft.portfolio} onChange={(event) => update("portfolio", event.target.value)} placeholder="Portfolio, GitHub eller egen hemsida (valfritt)" /><input aria-label="Annan länk" type="url" value={draft.otherLink} onChange={(event) => update("otherLink", event.target.value)} placeholder="Annan länk, t.ex. ett projekt (valfritt)" /></>}
    </div>
    {error && <p role="alert" className="cv-hub-error">{error}</p>}
    <div className="cv-hub-question-actions">
      <button className="cta-btn" disabled={generating} onClick={() => advance()}>{generating ? "AI:n skriver ditt CV..." : returnToReview ? "Spara ändringen" : step === "merits" ? canUseAi ? "Skapa min CV-förhandsvisning" : "Förhandsvisa ändringar" : "Fortsätt"}</button>
      <button className="cv-hub-skip" disabled={generating} onClick={() => advance(true)}>{returnToReview ? "Spara och återgå till förhandsvisningen" : "Hoppa över"}</button>
    </div>
    {/* Bekräftad erfarenhet visas i förhandsvisningen; i profilbygget finns "Pausa och fortsätt senare" redan i stegrubriken. */}
    <p className="cv-hub-draft-note"><UiIcon name="info" width="17" />{draftStorageUnavailable ? "Utkastet kunde inte sparas på den här enheten. Stanna på sidan tills du har granskat och gjort CV:t klart." : "Sparas på den här enheten medan du skriver."}</p>
    {!draftStorageUnavailable && !inJourney && <Link className="cv-hub-save-later" href={returnPath}>Fortsätt senare <UiIcon name="arrow" width="16" /></Link>}
  </main>;
}
