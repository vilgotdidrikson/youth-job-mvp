"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { CvFactReview } from "./cv-fact-review";
import styles from "./recruitment-profile.module.css";
import { getYouthProfile } from "@/lib/onboarding";
import { getSupabaseClient } from "@/lib/supabase";
import { createCvSave, ownedCvHeaders } from "@/lib/cv-save-workflow";
import { cvReviewSnapshot } from "@/lib/cv-fact-review";
import { renderStructuredCv, type StructuredCvData } from "@/lib/structured-cv";
import { recruitmentProfileSource, type RecruitmentProfile } from "@/lib/recruitment-profile";
import { cvFromProfileChat, hasProfileChatAnswer, profileChatFields, profileChatKeys, profileChatTextLimit, profileFromChat, readProfileChatDraft, type ProfileChatDraft, type ProfileChatField } from "@/lib/profile-chat";

type Mode = "chat" | "form";
type Intent = "profile" | "cv";
type StoredDraft = { answers: ProfileChatDraft; mode: Mode; step?: ProfileChatField; cvApplied?: ProfileChatDraft; cvEdit?: { source: string; value: StructuredCvData } };
const draftKey = (owner: string) => `mnw-profile-chat:${owner}`;

function loadDraft(owner: string, initialMode: Mode): StoredDraft {
  try {
    const stored = JSON.parse(window.localStorage.getItem(draftKey(owner)) ?? "{}");
    return { answers: readProfileChatDraft(stored.answers), mode: initialMode, step: profileChatKeys.includes(stored.step) ? stored.step : undefined, cvApplied: readProfileChatDraft(stored.cvApplied), cvEdit: stored.cvEdit };
  } catch {
    return { answers: {}, mode: initialMode };
  }
}

export function ProfileChat({ owner, initialMode, profile: initialProfile, version: initialVersion }: { owner: string; initialMode: Mode; profile: RecruitmentProfile; version: number }) {
  const [{ profile, version }, setProfileBase] = useState({ profile: initialProfile, version: initialVersion });
  const [cvBase, setCvBase] = useState<{ cv?: StructuredCvData | null; name?: string; uploaded: boolean; hasUnstructuredCv: boolean } | null>(null);
  const [stored, setStored] = useState<StoredDraft | null>(null);
  const [reviewing, setReviewing] = useState(false);
  const [profileApproval, setProfileApproval] = useState("");
  const [cvApproval, setCvApproval] = useState<string | null>(null);
  const [saved, setSaved] = useState({ profile: false, cv: false });
  const [message, setMessage] = useState("");
  const [failure, setFailure] = useState("");
  const [help, setHelp] = useState<Partial<Record<ProfileChatField, string>>>({});
  const [helpBusy, setHelpBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const activeSave = useRef<AbortController | null>(null);
  useEffect(() => () => activeSave.current?.abort(), []);

  useEffect(() => {
    let active = true;
    const initial = loadDraft(owner, initialMode);
    void getYouthProfile(owner).then(value => {
      if (!active) return;
      if (!value) throw new Error("Din jobbprofil kunde inte läsas.");
      setCvBase({ cv: value.cv_structured, name: value.full_name ?? undefined, uploaded: Boolean(value.cv_uploaded), hasUnstructuredCv: Boolean(value.cv_text && !value.cv_structured) });
      setStored(initial);
    }).catch(() => { if (active) setFailure("Din jobbprofil kunde inte läsas. Ladda om sidan och försök igen."); });
    return () => { active = false; };
  }, [owner, initialMode]);

  if (!stored || !cvBase) return <main className={styles.page}>{failure ? <p role="alert">{failure}</p> : <p role="status">Hämtar ditt utkast…</p>}</main>;
  const { answers, mode, step } = stored;
  const currentCv = cvBase.cv;
  const field = step ?? profileChatKeys.find(key => !hasProfileChatAnswer(key, profile, currentCv)) ?? "experience";
  const [question, hint, localFollowup] = profileChatFields[field];
  const current = profileChatKeys.indexOf(field);
  let proposal: RecruitmentProfile | null = null;
  let validationError = "";
  try { proposal = profileFromChat(profile, answers); }
  catch (reason) { validationError = reason instanceof Error ? reason.message : "Kontrollera ditt utkast."; }
  const snapshot = proposal ? JSON.stringify([version, proposal]) : "";
  const cvAnswers = Object.fromEntries(profileChatKeys.filter(key => answers[key] !== stored.cvApplied?.[key]).map(key => [key, answers[key]]));
  const baseCv = cvFromProfileChat(cvAnswers, currentCv);
  const cvSource = cvReviewSnapshot(renderStructuredCv(baseCv), baseCv);
  let cv = { ...baseCv, personalInfo: { ...baseCv.personalInfo, name: baseCv.personalInfo.name || cvBase.name } };
  if (stored.cvEdit?.source === cvSource) {
    try { renderStructuredCv(stored.cvEdit.value); cv = { ...stored.cvEdit.value, personalInfo: { ...stored.cvEdit.value.personalInfo, name: stored.cvEdit.value.personalInfo.name || cvBase.name } }; }
    catch { /* A broken device draft cannot override the editable source. */ }
  }
  const cvText = renderStructuredCv(cv);
  const cvSnapshot = cvReviewSnapshot(cvText, cv);
  const cvChanged = JSON.stringify(baseCv) !== JSON.stringify(cvFromProfileChat({}, currentCv));

  function keep(next: StoredDraft) {
    setStored(next);
    try { window.localStorage.setItem(draftKey(owner), JSON.stringify(next)); }
    catch { setFailure("Utkastet kunde inte sparas på enheten. Ha sidan öppen om du vill fortsätta arbeta med din text."); }
  }
  function change(key: ProfileChatField, value: string) {
    setProfileApproval("");
    setCvApproval(null);
    setSaved({ profile: false, cv: false });
    setMessage("");
    keep({ ...stored!, answers: { ...answers, [key]: value } });
  }
  function next() {
    const nextStep = profileChatKeys.slice(current + 1).find(key => !answers[key]?.trim() && !hasProfileChatAnswer(key, profile, currentCv));
    if (nextStep) keep({ ...stored!, step: nextStep });
    else setReviewing(true);
  }
  async function followup(key: ProfileChatField) {
    if (help[key]) {
      setHelp(previous => ({ ...previous, [key]: undefined }));
      return;
    }
    setHelpBusy(true);
    let follow: string = profileChatFields[key][2];
    try {
      const signal = AbortSignal.timeout(17_000);
      const headers = await ownedCvHeaders(owner, signal);
      const response = await fetch("/api/youth/profile/coach", {
        method: "POST", headers: { ...headers, "Content-Type": "application/json" }, body: JSON.stringify({ field: key }), signal,
      });
      const result = response.ok ? await response.json() : {};
      if (typeof result.question === "string") follow = result.question;
    } catch {
      // The question and the form are available even if assistance is offline.
    } finally {
      setHelp(previous => ({ ...previous, [key]: follow }));
      setHelpBusy(false);
    }
  }
  async function save(kind: Intent) {
    if (activeSave.current || saved[kind] || (kind === "profile" && (!proposal || snapshot !== profileApproval)) || (kind === "cv" && cvApproval !== cvSnapshot)) return;
    const controller = new AbortController();
    activeSave.current = controller;
    setSaving(true);
    setFailure("");
    setMessage("");
    try {
      const signal = AbortSignal.any([controller.signal, AbortSignal.timeout(25_000)]);
      if (kind === "profile") {
        if (!proposal) return;
        const client = getSupabaseClient();
        const identity = await client.auth.getUser();
        signal.throwIfAborted();
        if (identity.error || identity.data.user?.id !== owner) throw new Error("Kontot har ändrats. Öppna jobbprofilen igen.");
        const { data, error } = await client.from("youth_profiles").update({ recruitment_profile: proposal })
          .eq("user_id", owner).eq("recruitment_profile_version", version).select("user_id,recruitment_profile_version").abortSignal(signal).maybeSingle();
        signal.throwIfAborted();
        if (error || data?.user_id !== owner || typeof data.recruitment_profile_version !== "number") throw new Error("Sparningen kunde inte bekräftas. Ladda om sidan för att läsa eventuell ny profilversion. Utkastet finns kvar.");
        setProfileBase({ profile: proposal, version: data.recruitment_profile_version });
        setProfileApproval("");
      } else {
        const operation = createCvSave(owner, { kind: "reviewed", text: cvText, structured: cv, approval: cvApproval, previousStructured: currentCv ?? null, keepRecruitmentProfile: true });
        await operation.save(signal);
        signal.throwIfAborted();
        setCvBase(previous => previous ? { ...previous, cv } : previous);
        keep({ ...stored!, cvApplied: answers, cvEdit: undefined });
        setCvApproval(null);
      }
      setSaved(previous => ({ ...previous, [kind]: true }));
      setMessage(kind === "profile" ? "Jobbprofilen är sparad." : "CV:t är sparat.");
    } catch (reason) {
      if (!controller.signal.aborted) setFailure(reason instanceof Error ? reason.message : "Kunde inte spara. Utkastet finns kvar.");
    } finally {
      activeSave.current = null;
      if (!controller.signal.aborted) setSaving(false);
    }
  }

  function input(key: ProfileChatField) {
    const [label, description] = profileChatFields[key];
    return <div key={key}>
      <label htmlFor={`profile-chat-${key}`}>{label}</label>
      {description && <small id={`profile-hint-${key}`}>{description}</small>}
      <textarea id={`profile-chat-${key}`} aria-describedby={description ? `profile-hint-${key}` : undefined} rows={3} maxLength={profileChatTextLimit} disabled={saving} value={answers[key] ?? ""} onChange={event => change(key, event.target.value)} />
      {mode === "form" && <button type="button" className="secondary-btn" disabled={helpBusy} onClick={() => void followup(key)}>{help[key] ? "Dölj följdfråga" : "Hjälp mig utveckla texten"}</button>}
      {help[key] && <p role="status">{help[key]}</p>}
    </div>;
  }
  const draftKeys = profileChatKeys.filter(key => answers[key]?.trim());

  return <main className={styles.page}>
    <header className={styles.heading}><h1>Bygg din jobbprofil</h1><p>Utkastet sparas på den här enheten. Du väljer vad som ska ingå och godkänner innan något sparas i profilen.</p></header>
    <section className={styles.form}>
      <nav aria-label="Välj hur du bygger din profil">
        <button type="button" className={mode === "chat" ? "cta-btn" : "secondary-btn"} aria-pressed={mode === "chat"} disabled={saving} onClick={() => { keep({ ...stored, mode: "chat" }); setReviewing(false); }}>Bygg med AI-chatt</button>{" "}
        <button type="button" className={mode === "form" ? "cta-btn" : "secondary-btn"} aria-pressed={mode === "form"} disabled={saving} onClick={() => { keep({ ...stored, mode: "form" }); setReviewing(false); }}>Fyll i själv</button>
      </nav>
      {!reviewing && (mode === "form" ? <>{profileChatKeys.map(input)}<button type="button" className="cta-btn" onClick={() => setReviewing(true)}>Granska utkastet</button></> : <>
        <p aria-live="polite"><strong>{question}</strong></p>
        {hint && <p>{hint}</p>}
        <textarea key={field} aria-label={question} rows={4} maxLength={profileChatTextLimit} value={answers[field] ?? ""} onChange={event => change(field, event.target.value)} />
        {help[field] && <p role="status">{help[field] === question ? localFollowup : help[field]}</p>}
        <button type="button" className="secondary-btn" disabled={helpBusy} onClick={() => void followup(field)}>{helpBusy ? "Hämtar fråga…" : help[field] ? "Dölj följdfråga" : "Ställ en följdfråga"}</button>
        <footer><button type="button" className="secondary-btn" disabled={!current} onClick={() => keep({ ...stored, step: profileChatKeys[current - 1] })}>Föregående</button><button type="button" className="cta-btn" onClick={next}>{answers[field]?.trim() ? "Nästa fråga" : "Hoppa över"}</button></footer>
        <button type="button" className="secondary-btn" onClick={() => setReviewing(true)}>Granska utkastet</button>
      </>)}
      {mode === "chat" && <details><summary>Det här har vi fått med hittills</summary>{draftKeys.length ? draftKeys.map(input) : <p>Inga nya svar ännu.</p>}</details>}
      {reviewing && <>
        <h2>Din jobbprofil</h2>
        {validationError && <p role="alert">{validationError}</p>}
        <p style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{proposal ? recruitmentProfileSource(proposal) || "Inga profiluppgifter tillagda." : "Ändra uppgifterna och granska igen."}</p>
        <label><input type="checkbox" checked={Boolean(snapshot) && snapshot === profileApproval} disabled={!proposal || saving} onChange={event => setProfileApproval(event.target.checked ? snapshot : "")} /> Jag godkänner att dessa uppgifter sparas i min jobbprofil och används vid matchning.</label>
        <button type="button" className="cta-btn" disabled={!snapshot || snapshot !== profileApproval || saving || saved.profile} onClick={() => void save("profile")}>Spara jobbprofil</button>
        <h2>Ditt CV</h2>
        {(cvChanged || Boolean(currentCv && cvText.trim())) && !cvBase.hasUnstructuredCv && !cvBase.uploaded ? <>
          <pre style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere", font: "inherit" }}>{cvText}</pre>
          <CvFactReview manual cv={cv} text={cvText} sourceText={draftKeys.map(key => answers[key]).join("\n")} approved={cvApproval === cvSnapshot} disabled={saving} onApprove={checked => setCvApproval(checked ? cvSnapshot : null)} onChange={next => { keep({ ...stored, cvEdit: { source: cvSource, value: next } }); setCvApproval(null); setSaved(previous => ({ ...previous, cv: false })); }} />
          <button type="button" className="cta-btn" disabled={!cvText.trim() || cvApproval !== cvSnapshot || saving || saved.cv} onClick={() => void save("cv")}>Spara CV</button>
        </> : <p>{cvBase.hasUnstructuredCv || cvBase.uploaded ? "Du har redan ett CV. Öppna CV-sidan för att granska det." : "Lägg till exempelvis erfarenheter, utbildning eller kunskaper för att skapa ett CV-utkast."} <Link href="/youth/cv?edit=1">Öppna CV-sidan</Link></p>}
        <button type="button" className="secondary-btn" disabled={saving} onClick={() => setReviewing(false)}>Ändra svaren</button>
      </>}
      {failure && <p role="alert">{failure}</p>}
      {message && <p role="status">{message}</p>}
      <footer><Link className="secondary-btn" href="/profile/build">Pausa och gå tillbaka</Link>{draftKeys.length > 0 && <button type="button" className="secondary-btn" disabled={saving} onClick={() => { keep({ mode, answers: {} }); setProfileApproval(""); setCvApproval(null); setSaved({ profile: false, cv: false }); setReviewing(false); setHelp({}); setMessage("Utkastet rensades."); }}>Rensa utkast</button>}</footer>
    </section>
  </main>;
}
