"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { getSupabaseClient } from "@/lib/supabase";
import { MAX_SAVED_ANSWERS, type SavedAnswer } from "@/lib/recruitment-profile";
import { SAVE_ANSWER_PROMPT, SavedAnswerError, changeSavedAnswers, loadSavedAnswers, savedAnswerEntry, withSavedAnswer } from "@/lib/saved-answers";

const declinedKey = (ownerId: string) => `mnw-saved-answer-declined:${ownerId}`;
function readDeclined(ownerId: string): string[] {
  try { const value = JSON.parse(window.localStorage.getItem(declinedKey(ownerId)) ?? "[]"); return Array.isArray(value) ? value.filter(item => typeof item === "string") : []; } catch { return []; }
}

/** Saved sources for one account, read once when a supplement is opened. Null hides the optional choice. */
export function useSavedAnswerSources(ownerId: string, enabled: boolean) {
  const [state, setState] = useState<{ owner: string; sources: string[]; declined: string[] } | null>(null);
  useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController();
    loadSavedAnswers(getSupabaseClient(), ownerId, controller.signal)
      .then(result => { if (!controller.signal.aborted) setState({ owner: ownerId, sources: result.answers.map(item => item.source), declined: readDeclined(ownerId) }); })
      .catch(() => {});
    return () => controller.abort();
  }, [ownerId, enabled]);
  return state?.owner === ownerId ? state : null;
}

type Props = { ownerId: string; source: string; question: string; answer: string; initial: "saved" | "declined" | "ask" };
/** No option is preselected. Declining or ignoring the choice never saves anything to the profile. */
export function SavedAnswerChoice({ ownerId, source, question, answer, initial }: Props) {
  const [step, setStep] = useState<"ask" | "review" | "saved" | "declined">(initial);
  const [text, setText] = useState(answer.slice(0, 600)), [busy, setBusy] = useState(false), [error, setError] = useState("");
  const request = useRef<AbortController | null>(null), fieldId = useId();
  useEffect(() => () => request.current?.abort(), []);
  if (step === "declined") return null;
  if (step === "saved") return <p className="application-save-answer" role="status">Sparat i din profil. <Link href="/profile/develop#sparade-svar">Ändra eller ta bort</Link></p>;
  const decline = () => {
    try { window.localStorage.setItem(declinedKey(ownerId), JSON.stringify([...new Set([...readDeclined(ownerId), source])].slice(-200))); } catch { /* The choice is still respected for this view. */ }
    setStep("declined");
  };
  const save = async () => {
    if (busy) return;
    const controller = new AbortController(); request.current = controller; setBusy(true); setError("");
    try {
      await changeSavedAnswers(getSupabaseClient(), ownerId, (current: SavedAnswer[]) => withSavedAnswer(current, savedAnswerEntry(text, question, source)), controller.signal);
      if (!controller.signal.aborted) setStep("saved");
    } catch (reason) {
      if (!controller.signal.aborted) setError(reason instanceof SavedAnswerError || reason instanceof Error && /tecken|högst|redan/.test(reason.message) ? reason.message : "Uppgiften kunde inte sparas i profilen. Försök igen.");
    } finally { if (!controller.signal.aborted) setBusy(false); }
  };
  if (step === "ask") return <div className="application-save-answer">
    <p>{SAVE_ANSWER_PROMPT}</p>
    <div className="application-save-answer-actions"><button type="button" className="secondary-btn" onClick={() => setStep("review")}>Ja, spara i min profil</button><button type="button" className="application-answer-edit" onClick={decline}>Nej, bara för den här ansökan</button></div>
  </div>;
  return <div className="application-save-answer">
    <label htmlFor={fieldId}><strong>Uppgift som sparas i profilen</strong></label>
    <textarea id={fieldId} className="input-field" rows={3} maxLength={600} disabled={busy} value={text} onChange={event => setText(event.target.value)} />
    <small>Skriv så att uppgiften går att förstå utan frågan, och undvik känsliga uppgifter som hälsa eller personnummer. Den används i matchningen för kommande ansökningar. Du väljer i varje ansökan om företaget ska se den. Högst {MAX_SAVED_ANSWERS} sparade svar.</small>
    {error && <p role="alert" className="application-completion-error">{error}</p>}
    <div className="application-save-answer-actions"><button type="button" className="secondary-btn" disabled={busy || !text.trim()} onClick={() => void save()}>{busy ? "Sparar…" : "Spara i profilen"}</button><button type="button" className="application-answer-edit" disabled={busy} onClick={() => setStep("ask")}>Avbryt</button></div>
  </div>;
}
