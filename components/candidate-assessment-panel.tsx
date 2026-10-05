"use client";

import { useEffect, useRef, useState } from "react";
import { authenticatedHeaders } from "@/lib/api-client";
import type { CandidateAssessment } from "@/lib/candidate-assessment";
import { getApplicationFollowups, type ApplicationFollowup } from "@/lib/application-completions";
import type { ApplicationCompletion } from "@/lib/application-completions";
import { getSupabaseClient } from "@/lib/supabase";

const CONFIDENCE = { low: "Begränsat underlag", medium: "Delvis underlag", high: "Gott underlag" };
const STATUS = { fulfilled: "Stöds av underlaget", unfulfilled: "Motsägs av underlaget", unknown: "Uppgift saknas" };

export function CandidateAssessmentPanel({ jobId, youthUserId, application }: { jobId: string; youthUserId: string; application?: ApplicationCompletion | null }) {
  const [assessment, setAssessment] = useState<CandidateAssessment | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [pdfStatus, setPdfStatus] = useState("");
  const [temporary, setTemporary] = useState(false);
  const [followups, setFollowups] = useState<ApplicationFollowup[]>([]);
  const [followupMessage, setFollowupMessage] = useState("");
  const [history, setHistory] = useState<{ id: string; job_profile_version: number; result: CandidateAssessment; created_at: string }[] | null>(null);
  const loadHistory = async () => {
    const { data, error } = await getSupabaseClient().from("candidate_assessments").select("id,job_profile_version,result,created_at")
      .eq("job_id", jobId).eq("youth_user_id", youthUserId).order("created_at", { ascending: false }).limit(20);
    if (error) setError("Kunde inte läsa tidigare bedömningar."); else setHistory(data ?? []);
  };
  const request = useRef<AbortController | null>(null);
  useEffect(() => {
    let active = true;
    void getApplicationFollowups(jobId).then((items) => {
      if (active) setFollowups(items.filter((item) => item.youth_user_id === youthUserId));
    }).catch(() => {});
    return () => { active = false; request.current?.abort(); };
  }, [jobId, youthUserId]);
  const analyze = async () => {
    if (busy) return;
    const controller = new AbortController(); request.current = controller;
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/company/candidate-assessment", { method: "POST", signal: controller.signal,
        headers: { "Content-Type": "application/json", ...(await authenticatedHeaders()) }, body: JSON.stringify({ jobId, youthUserId }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Kunde inte bedöma underlaget.");
      setAssessment(data.assessment);
      setPdfStatus(data.pdfStatus ?? "none");
      setTemporary(data.temporary === true);
      setFollowupMessage(data.followups?.queued > 0 ? `${data.followups.queued} individuella frågor har skickats till kandidaten. Svaren kompletterar den befintliga ansökan.` : "");
      const questions = await getApplicationFollowups(jobId);
      if (!controller.signal.aborted) setFollowups(questions.filter((item) => item.youth_user_id === youthUserId));
    } catch (reason) { if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : "Kunde inte bedöma underlaget."); }
    finally { if (!controller.signal.aborted) setBusy(false); }
  };
  return <section className="candidate-assessment-panel" aria-label="Matchningsunderlag">
    <header><h3>Matchningsunderlag</h3><button type="button" className="secondary-btn" disabled={busy} onClick={() => void analyze()}>{busy ? "Läser underlaget…" : assessment ? "Uppdatera bedömning" : "Visa matchningsbedömning"}</button></header>
    {error && <p role="alert">{error}</p>}
    {pdfStatus === "read" && <p>Texten i uppladdat PDF-CV ingår i underlaget.</p>}
    {pdfStatus === "unreadable" && <p role="status">PDF-CV:t kunde inte läsas automatiskt. Öppna CV:t för egen granskning. Bedömningen använder övriga uppgifter.</p>}
    {temporary && pdfStatus !== "unreadable" && <p role="status">En preliminär bedömning visas. Automatisk analys är tillfälligt otillgänglig; försök igen senare.</p>}
    {assessment && <><div className="candidate-assessment-summary"><strong>{assessment.score === null ? "Matchgrad saknas" : `${assessment.score} % av bedömda kriterier`}</strong><span>{CONFIDENCE[assessment.confidence]} · {assessment.coverage} % täckning</span></div><p>{assessment.explanation}</p><ul>{assessment.criteria.map((criterion) => <li key={criterion.id}><strong>{criterion.label}</strong><span>{criterion.category === "trainable" ? "Kan läras på plats – påverkar inte matchgraden" : STATUS[criterion.status]}{criterion.required ? " · Grundkrav" : ""}</span>{criterion.evidence && <blockquote>{criterion.evidence}</blockquote>}</li>)}</ul></>}
    {application && application.questions.length > 0 && <div className="candidate-application-answers"><h3>Ansökningsfrågor</h3>{application.questions.map((question) => <div key={question.id}><strong>{question.question}</strong><p>{application.answers[question.id]?.trim() || "Uppgift saknas"}</p></div>)}</div>}
    {followupMessage && <p role="status" className="candidate-followup-notice">{followupMessage}</p>}
    {followups.length > 0 && <section className="candidate-application-answers"><h3>Individuella kompletteringar</h3><p>Skickade svar ingår i nästa uppdatering av matchningsunderlaget.</p>{followups.map((item) => <div key={item.id}><strong>{item.question}</strong><p>{item.status === "answered" ? item.answer : item.status === "skipped" ? "Uppgift saknas – kandidaten valde att inte svara" : "Frågan har skickats. Inv väntar svar.".replace("Inv väntar", "Inväntar")}</p></div>)}</section>}
    <details onToggle={(event) => { if (event.currentTarget.open && history === null) void loadHistory(); }}><summary>Tidigare bedömningar</summary>{history?.length === 0 && <p>Inga sparade bedömningar ännu.</p>}{history?.map((item) => <details key={item.id}><summary>Kriterieversion {item.job_profile_version} · {new Date(item.created_at).toLocaleString("sv-SE")}</summary><p>{item.result.explanation}</p><ul>{item.result.criteria.map((criterion) => <li key={criterion.id}><strong>{criterion.label}</strong><span>{STATUS[criterion.status]}</span>{criterion.evidence && <blockquote>{criterion.evidence}</blockquote>}</li>)}</ul></details>)}</details>
    <p className="candidate-assessment-note">Bedömningen visar vilket underlag som finns. Saknade uppgifter räknas inte som avslag. Ni fattar alltid beslutet själva.</p>
  </section>;
}
