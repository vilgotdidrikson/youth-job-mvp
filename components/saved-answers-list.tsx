"use client";

import { useEffect, useRef, useState } from "react";
import { getSupabaseClient } from "@/lib/supabase";
import { validateSavedAnswers, type SavedAnswer } from "@/lib/recruitment-profile";
import { SavedAnswerError, changeSavedAnswers } from "@/lib/saved-answers";
import styles from "./recruitment-profile.module.css";

/** Overview of answers the youth chose to keep: read, correct or remove. Nothing here is shared without a choice per application. */
export function SavedAnswersList({ ownerId, answers, onChanged }: { ownerId: string; answers: SavedAnswer[]; onChanged: () => Promise<unknown> | void }) {
  const [editing, setEditing] = useState<string | null>(null), [text, setText] = useState("");
  const [busy, setBusy] = useState(false), [error, setError] = useState(""), [message, setMessage] = useState("");
  const request = useRef<AbortController | null>(null);
  useEffect(() => () => request.current?.abort(), []);
  if (!answers.length && !message) return null;
  const change = async (next: (current: SavedAnswer[]) => SavedAnswer[], done: string) => {
    if (busy) return;
    const controller = new AbortController(); request.current = controller; setBusy(true); setError(""); setMessage("");
    try {
      await changeSavedAnswers(getSupabaseClient(), ownerId, next, controller.signal);
      if (controller.signal.aborted) return;
      setEditing(null); setMessage(done); await onChanged();
    } catch (reason) {
      if (!controller.signal.aborted) setError(reason instanceof SavedAnswerError || reason instanceof Error && /tecken/.test(reason.message) ? reason.message : "Ändringen kunde inte sparas. Försök igen.");
    } finally { if (!controller.signal.aborted) setBusy(false); }
  };
  return <section id="sparade-svar" className={styles.savedAnswers} aria-labelledby="sparade-svar-rubrik">
    <h2 id="sparade-svar-rubrik">Sparade svar</h2>
    <p>Svar du har valt att spara från tidigare kompletteringar. De används i matchningen för kommande ansökningar, och du väljer i varje ansökan om företaget ska se dem.</p>
    {answers.map(item => <article key={item.source} className={styles.savedAnswer}>
      <small>{item.question} · Sparat {item.savedAt}</small>
      {editing === item.source ? <>
        <label className="sr-only" htmlFor={`saved-${item.source}`}>Ändra uppgiften</label>
        <textarea id={`saved-${item.source}`} className="input-field" rows={3} maxLength={600} disabled={busy} value={text} onChange={event => setText(event.target.value)} />
        <div><button type="button" className="secondary-btn" disabled={busy || !text.trim()} onClick={() => void change(current => validateSavedAnswers(current.map(entry => entry.source === item.source ? { ...entry, text, savedAt: new Date().toISOString().slice(0, 10) } : entry)), "Uppgiften är ändrad.")}>{busy ? "Sparar…" : "Spara ändringen"}</button><button type="button" disabled={busy} onClick={() => setEditing(null)}>Avbryt</button></div>
      </> : <>
        <p>{item.text}</p>
        <div><button type="button" disabled={busy} onClick={() => { setEditing(item.source); setText(item.text); setError(""); setMessage(""); }}>Ändra</button><button type="button" disabled={busy} onClick={() => { if (window.confirm("Ta bort uppgiften från profilen? Redan skickade ansökningar ändras inte.")) void change(current => current.filter(entry => entry.source !== item.source), "Uppgiften är borttagen från profilen."); }}>Ta bort</button></div>
      </>}
    </article>)}
    {error && <p role="alert">{error}</p>}
    {message && <p role="status">{message}</p>}
  </section>;
}
