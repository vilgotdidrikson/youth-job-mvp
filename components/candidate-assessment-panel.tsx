"use client";

import { useEffect, useRef, useState } from "react";
import { authenticatedHeaders } from "@/lib/api-client";
import type { CandidateAssessment } from "@/lib/candidate-assessment";
import type { ApplicationCompletion } from "@/lib/application-completions";

const CONFIDENCE = { low: "Begränsat underlag", medium: "Delvis underlag", high: "Gott underlag" };
const STATUS = { fulfilled: "Stöds av underlaget", unfulfilled: "Motsägs av underlaget", unknown: "Uppgift saknas" };

export function CandidateAssessmentPanel({ jobId, youthUserId, application }: { jobId: string; youthUserId: string; application?: ApplicationCompletion | null }) {
  const [assessment, setAssessment] = useState<CandidateAssessment | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const request = useRef<AbortController | null>(null);
  useEffect(() => () => request.current?.abort(), []);
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
    } catch (reason) { if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : "Kunde inte bedöma underlaget."); }
    finally { if (!controller.signal.aborted) setBusy(false); }
  };
  return <section className="candidate-assessment-panel" aria-label="Matchningsunderlag">
    <header><h3>Matchningsunderlag</h3><button type="button" className="secondary-btn" disabled={busy} onClick={() => void analyze()}>{busy ? "Läser underlaget…" : assessment ? "Uppdatera bedömning" : "Visa matchningsbedömning"}</button></header>
    {error && <p role="alert">{error}</p>}
    {assessment && <><div className="candidate-assessment-summary"><strong>{assessment.score === null ? "Matchgrad saknas" : `${assessment.score} % av bedömda kriterier`}</strong><span>{CONFIDENCE[assessment.confidence]} · {assessment.coverage} % täckning</span></div><p>{assessment.explanation}</p><ul>{assessment.criteria.map((criterion) => <li key={criterion.id}><strong>{criterion.label}</strong><span>{criterion.category === "trainable" ? "Kan läras på plats – påverkar inte matchgraden" : STATUS[criterion.status]}{criterion.required ? " · Grundkrav" : ""}</span>{criterion.evidence && <blockquote>{criterion.evidence}</blockquote>}</li>)}</ul></>}
    {application && application.questions.length > 0 && <div className="candidate-application-answers"><h3>Ansökningsfrågor</h3>{application.questions.map((question) => <div key={question.id}><strong>{question.question}</strong><p>{application.answers[question.id]?.trim() || "Uppgift saknas"}</p></div>)}</div>}
    <p className="candidate-assessment-note">Bedömningen visar vilket underlag som finns. Saknade uppgifter räknas inte som avslag. Ni fattar alltid beslutet själva.</p>
  </section>;
}
