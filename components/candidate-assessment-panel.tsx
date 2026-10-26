"use client";

import { useEffect, useRef, useState } from "react";
import { authenticatedHeaders } from "@/lib/api-client";
import type { CandidateAssessment } from "@/lib/candidate-assessment";
import { getApplicationFollowups, type ApplicationFollowup } from "@/lib/application-completions";
import type { ApplicationCompletion } from "@/lib/application-completions";
import { getSupabaseClient } from "@/lib/supabase";
import { subscribeVisibleRefresh } from "@/lib/visible-refresh";
import { assessmentDeadline, observeAssessment } from "@/lib/assessment-progress";

import { CandidateAssessmentHistory } from "./candidate-assessment-history";

const CONFIDENCE = { low: "Begränsat underlag", medium: "Delvis underlag", high: "Gott underlag" };
const STATUS = { fulfilled: "Stöd i underlaget", unfulfilled: "Uttrycklig motsägelse", unknown: "Okänd uppgift – tillräckligt belägg saknas" };

export function CandidateAssessmentPanel({ jobId, youthUserId, application }: { jobId: string; youthUserId: string; application?: ApplicationCompletion | null }) {
  return <AssessmentPanel key={`${jobId}:${youthUserId}`} jobId={jobId} youthUserId={youthUserId} application={application} />;
}

function AssessmentPanel({ jobId, youthUserId, application }: { jobId: string; youthUserId: string; application?: ApplicationCompletion | null }) {
  const [assessment, setAssessment] = useState<CandidateAssessment | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [pdfStatus, setPdfStatus] = useState("");
  const [temporary, setTemporary] = useState(false);
  const [followups, setFollowups] = useState<ApplicationFollowup[]>([]);
  const [followupMessage, setFollowupMessage] = useState("");
  const [automaticStatus, setAutomaticStatus] = useState("");
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const observer = useRef<ReturnType<typeof observeAssessment> | null>(null);
  useEffect(() => {
    const params = { p_job_id: jobId, p_youth_user_id: youthUserId };
    const watch = observeAssessment({
      visible: () => document.visibilityState === "visible",
      read: async (signal) => {
        const { data, error } = await getSupabaseClient().rpc("get_application_assessment_state", params).abortSignal(signal);
        if (error || !data) throw new Error("Assessment read failed");
        return data;
      },
      enqueue: async (signal) => {
        const { error } = await getSupabaseClient().rpc("request_application_assessment", params).abortSignal(signal);
        if (error) throw new Error("Assessment request failed");
      },
      update: (data) => {
        setAutomaticStatus(data.status === "failed" && data.retrying ? "pending" : data.status);
        setError("");
        if (data.assessment) {
          setAssessment(data.assessment); setTemporary(false);
          setPdfStatus((data.assessment as CandidateAssessment & { pdfStatus?: string }).pdfStatus ?? "none");
          setUpdatedAt(data.updated_at ?? null);
        }
      },
      fail: setError,
    });
    observer.current = watch;
    const stopRefresh = subscribeVisibleRefresh(watch.refresh);
    return () => { watch.stop(); stopRefresh(); };
  }, [jobId, youthUserId]);
  const request = useRef<AbortController | null>(null);
  const followupRevision = useRef(0);
  useEffect(() => {
    let active = true;
    const revisions = followupRevision;
    const initialRevision = followupRevision.current;
    void getApplicationFollowups(jobId).then((items) => {
      if (active && initialRevision === followupRevision.current) setFollowups(items.filter((item) => item.youth_user_id === youthUserId));
    }).catch(() => {});
    const unsubscribe = subscribeVisibleRefresh(async () => {
      if (request.current && !request.current.signal.aborted) return;
      const revision = followupRevision.current;
      const items = await getApplicationFollowups(jobId);
      if (active && revision === followupRevision.current) setFollowups(items.filter((item) => item.youth_user_id === youthUserId));
    });
    return () => { active = false; revisions.current++; unsubscribe(); request.current?.abort(); };
  }, [jobId, youthUserId]);
  const analyze = async () => {
    if (request.current) return;
    observer.current?.stop();
    followupRevision.current++;
    const controller = new AbortController(); request.current = controller;
    const timeout = setTimeout(() => controller.abort(), 55_000);
    setBusy(true); setError(""); setAutomaticStatus("");
    try {
      const headers = await assessmentDeadline(authenticatedHeaders(), controller.signal);
      const response = await assessmentDeadline(fetch("/api/company/candidate-assessment", { method: "POST", signal: controller.signal,
        headers: { "Content-Type": "application/json", ...headers }, body: JSON.stringify({ jobId, youthUserId }) }), controller.signal);
      const data = await assessmentDeadline(response.json(), controller.signal);
      if (!response.ok) throw new Error(data.error || "Kunde inte bedöma underlaget.");
      if (!data.assessment || !Array.isArray(data.assessment.criteria)) throw new Error("Svaret saknade en bedömning. Försök igen.");
      setAssessment(data.assessment);
      setPdfStatus(data.pdfStatus ?? "none");
      setTemporary(data.temporary === true);
      setUpdatedAt(data.temporary ? null : data.createdAt ?? new Date().toISOString());
      setAutomaticStatus("completed");
      setFollowupMessage(data.followups?.queued > 0 ? `${data.followups.queued} individuella frågor har skickats till kandidaten. Svaren kompletterar den befintliga ansökan.` : "");
      // Supplementation must not turn a successful assessment into a failed update.
      const revision = ++followupRevision.current;
      void getApplicationFollowups(jobId).then((questions) => {
        if (!controller.signal.aborted && revision === followupRevision.current) setFollowups(questions.filter((item) => item.youth_user_id === youthUserId));
      }).catch(() => {});
    } catch (reason) {
      if (request.current === controller) setError(reason instanceof Error ? reason.message : "Kunde inte bedöma underlaget.");
    } finally {
      clearTimeout(timeout);
      if (request.current === controller) { setBusy(false); request.current = null; }
    }
  };
  return <section className="candidate-assessment-panel" aria-label="Matchningsunderlag" aria-busy={busy}>
    <header><h3>Matchningsunderlag</h3><button type="button" className="secondary-btn" disabled={busy} onClick={() => void analyze()}>{busy ? "Beräknar…" : error || temporary ? "Försök igen" : assessment ? "Uppdatera bedömning" : "Visa matchningsbedömning"}</button></header>
    <p role="status" aria-live="polite">{busy ? "Beräknar" : error ? "Kunde inte uppdateras" : ["pending", "processing"].includes(automaticStatus) ? "Beräknar automatiskt – du kan också uppdatera bedömningen direkt." : assessment ? temporary ? "Preliminärt underlag" : "Klart" : "Hämtar bedömning…"}</p>
    {error && <p role="alert">{error}{assessment ? " Tidigare underlag visas nedan." : " Du kan fortfarande öppna kandidatens CV för egen granskning."}</p>}
    {updatedAt && <p>Senaste färdiga bedömning: <time dateTime={updatedAt}>{new Date(updatedAt).toLocaleString("sv-SE")}</time></p>}
    {pdfStatus === "read" && <p>Texten i uppladdat PDF-CV ingår i underlaget.</p>}
    {pdfStatus === "unreadable" && <p role="status">PDF-CV:t kunde inte läsas automatiskt. Öppna CV:t för egen granskning. Bedömningen använder övriga uppgifter.</p>}
    {temporary && pdfStatus !== "unreadable" && <p role="status">En preliminär bedömning visas. Automatisk analys är tillfälligt otillgänglig; försök igen senare.</p>}
    {assessment?.inputStatus === "review_required" && <p role="status">Delar av underlaget har utelämnats vid lokal rensning. Bedömningen är begränsad. Kandidaten kan behöva rätta eller komplettera; utelämnade uppgifter är inte ett underkännande.</p>}
    {assessment && <><ul>{assessment.criteria.map((criterion) => <li key={criterion.id} data-status={criterion.status}><strong>{criterion.label}</strong><span className="candidate-criterion-status">{criterion.category === "trainable" ? "Kan läras på plats – påverkar inte matchgraden" : criterion.category === "excluded" ? "Används inte i matchningen" : criterion.category === "trait" ? `${STATUS[criterion.status]} · Självuppgivet – ingen verifierad personlighet eller personlighetspoäng` : criterion.status === "unknown" && criterion.evidence?.startsWith("Kan börja arbeta:") ? "Startdatum finns – bedöm om det passar ert önskemål" : STATUS[criterion.status]}{criterion.required ? " · Grundkrav" : ""}</span>{criterion.evidence && <blockquote><span>Självuppgivet belägg: </span>{criterion.evidence}</blockquote>}</li>)}</ul><details><summary>Sammanfattande matchgrad och täckning</summary><p>{assessment.score === null ? "Matchgrad saknas" : `${assessment.score} % av bedömda faktakriterier`} · {assessment.coverage} % täckning · {CONFIDENCE[assessment.confidence]}</p><p>{assessment.explanation}</p><p>Egenskaper och sådant som kan läras på plats ingår inte i procenten. Mer text ger inte fler poäng.</p></details></>}
    {application && application.questions.length > 0 && <div className="candidate-application-answers"><h3>Ansökningsfrågor</h3>{application.questions.map((question) => <div key={question.id}><strong>{question.question}</strong><p>{application.answers[question.id]?.trim() || "Uppgift saknas"}</p></div>)}</div>}
    {followupMessage && <p role="status" className="candidate-followup-notice">{followupMessage}</p>}
    {followups.length > 0 && <section className="candidate-application-answers"><h3>Individuella kompletteringar</h3><p>Skickade svar ingår i nästa uppdatering av matchningsunderlaget.</p>{followups.map((item) => <div key={item.id}><strong>{item.question}</strong><p>{item.status === "answered" ? item.answer : item.status === "skipped" ? "Uppgift saknas – kandidaten valde att inte svara" : "Frågan har skickats. Inv väntar svar.".replace("Inv väntar", "Inväntar")}</p></div>)}</section>}
    <CandidateAssessmentHistory jobId={jobId} youthId={youthUserId} revision={updatedAt} />
    <p className="candidate-assessment-note">Bedömningen visar vilket underlag som finns. Saknade uppgifter räknas inte som avslag. Ni fattar alltid beslutet själva.</p>
  </section>;
}
