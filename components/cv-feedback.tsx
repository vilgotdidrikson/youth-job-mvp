"use client";

import { useEffect, useRef, useState } from "react";
import { authenticatedHeaders } from "@/lib/api-client";
import { CV_FEEDBACK_KINDS, type CvFeedbackItem, type CvFeedbackResult } from "@/lib/cv-feedback";
import { SavedAnswerError, canSaveAnswer, changeSavedAnswers, savedAnswerEntry, withSavedAnswer } from "@/lib/saved-answers";
import { getSupabaseClient } from "@/lib/supabase";
import styles from "./cv-feedback.module.css";

const sourceKey = (question: string) => { let hash = 5381; for (const char of question) hash = ((hash << 5) + hash + char.codePointAt(0)!) >>> 0; return `cv-feedback:${hash.toString(36)}`; };

/** A question is answered by the youth only; nothing is prefilled and saving to the profile is an explicit choice. */
function FeedbackAnswer({ ownerId, item }: { ownerId: string; item: CvFeedbackItem }) {
  const [text, setText] = useState(""), [busy, setBusy] = useState(false), [error, setError] = useState(""), [saved, setSaved] = useState(false);
  const request = useRef<AbortController | null>(null), id = sourceKey(item.question);
  useEffect(() => () => request.current?.abort(), []);
  if (saved) return <p role="status" className={styles.note}>Sparat i din profil. Du kan ändra eller ta bort det under Din jobbprofil.</p>;
  const save = async () => {
    if (busy || !text.trim()) return;
    const controller = new AbortController(); request.current = controller; setBusy(true); setError("");
    try {
      await changeSavedAnswers(getSupabaseClient(), ownerId, current => withSavedAnswer(current, savedAnswerEntry(text, item.question, id)), controller.signal);
      if (!controller.signal.aborted) setSaved(true);
    } catch (reason) {
      if (!controller.signal.aborted) setError(reason instanceof SavedAnswerError || reason instanceof Error && /tecken|högst/.test(reason.message) ? reason.message : "Svaret kunde inte sparas i profilen. Försök igen.");
    } finally { if (!controller.signal.aborted) setBusy(false); }
  };
  return <div className={styles.answer}>
    <label htmlFor={id}>Vill du svara? Det är frivilligt.</label>
    <textarea id={id} className="input-field" rows={2} maxLength={600} disabled={busy} value={text} onChange={event => setText(event.target.value)} placeholder="Skriv med dina egna ord…" />
    {error && <p role="alert" className={styles.error}>{error}</p>}
    <button type="button" className="secondary-btn" disabled={busy || !text.trim()} onClick={() => void save()}>{busy ? "Sparar…" : "Spara svaret i min profil"}</button>
  </div>;
}

/** Optional. The upload is complete without it, and the original file is never replaced. */
export function CvFeedback({ ownerId }: { ownerId: string }) {
  const [state, setState] = useState<{ busy: boolean; error: string; result: CvFeedbackResult | null }>({ busy: false, error: "", result: null });
  const request = useRef<AbortController | null>(null), lock = useRef(false);
  useEffect(() => () => request.current?.abort(), []);
  const load = async () => {
    if (lock.current) return;
    lock.current = true;
    const controller = new AbortController(); request.current = controller;
    setState({ busy: true, error: "", result: null });
    try {
      const response = await fetch("/api/youth/cv/feedback", { method: "POST", headers: await authenticatedHeaders(), signal: AbortSignal.any([controller.signal, AbortSignal.timeout(50_000)]) });
      const body = await response.json().catch(() => null) as (CvFeedbackResult & { error?: string }) | null;
      if (controller.signal.aborted) return;
      if (!response.ok || !body || !Array.isArray(body.items)) setState({ busy: false, error: typeof body?.error === "string" ? body.error : "Förslagen kunde inte hämtas just nu. Ditt CV är oförändrat.", result: null });
      else setState({ busy: false, error: "", result: body });
    } catch {
      if (!controller.signal.aborted) setState({ busy: false, error: "Förslagen kunde inte hämtas i tid. Ditt CV är oförändrat. Försök igen.", result: null });
    } finally { lock.current = false; }
  };
  const { busy, error, result } = state;
  return <section className={styles.panel} aria-label="Förbättringsförslag för ditt CV">
    <div className={styles.head}>
      <div><strong>Vill du ha förbättringsförslag?</strong><p>Valfritt. En AI läser texten i din fil och ger några tips. Namn och kontaktuppgifter tas bort innan texten skickas, och filen ändras inte.</p></div>
      <button type="button" className="secondary-btn" disabled={busy} onClick={() => void load()}>{busy ? "Läser ditt CV…" : result ? "Hämta nya förslag" : "Få förbättringsförslag"}</button>
    </div>
    {error && <p role="alert" className={styles.error}>{error}</p>}
    {result && <div role="status" className={styles.result}>
      {result.status === "unreadable" && <p>Texten i filen kunde inte läsas, till exempel för att den är skannad eller skyddad. Ingen genomläsning har gjorts. Ditt CV är sparat som vanligt.</p>}
      {result.status === "none" && <p>Det finns inget sparat CV att läsa. Ladda upp en PDF först.</p>}
      {result.status === "read" && result.notices.map(notice => <p key={notice} className={styles.notice}>{notice}</p>)}
      {result.status === "read" && !result.items.length && <p>Inga förslag den här gången.</p>}
      {result.status === "read" && result.items.length > 0 && <ol className={styles.list}>{result.items.map(item => <li key={item.tip}>
        <small>{CV_FEEDBACK_KINDS[item.kind]}</small><p>{item.tip}</p>
        {item.question && <p className={styles.question}>{item.question}</p>}
        {item.question && canSaveAnswer(item.question) && <FeedbackAnswer ownerId={ownerId} item={item} />}
      </li>)}</ol>}
      {result.status === "read" && result.items.length > 0 && <p className={styles.note}>Förslagen är tips, inte krav, och sparas inte. Vill du ändra något gör du det i din egen fil och laddar upp den igen.</p>}
    </div>}
  </section>;
}
