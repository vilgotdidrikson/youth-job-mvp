"use client";
import { useEffect, useRef, useState } from "react";
import { getCompanyQuestions, sendCompanyQuestion, COMPANY_QUESTION_MAX_LENGTH, normalizedCompanyQuestion } from "@/lib/company-questions";
import { createLatestRead, type ReadState } from "@/lib/latest-read";
import { subscribeVisibleRefresh } from "@/lib/visible-refresh";
import type { ApplicationFollowup } from "@/lib/application-completions";
import styles from "./company-application-questions.module.css";

export function CompanyApplicationQuestions(props: { jobId: string; youthId: string; canAsk: boolean }) {
  return <Questions key={`${props.jobId}:${props.youthId}`} {...props} />;
}
function Questions({ jobId, youthId, canAsk }: { jobId: string; youthId: string; canAsk: boolean }) {
  const [state, setState] = useState<ReadState<ApplicationFollowup[]>>({ status: "loading" });
  const [open, setOpen] = useState(false), [text, setText] = useState("");
  const [busy, setBusy] = useState(false), [error, setError] = useState(""), [message, setMessage] = useState("");
  const reader = useRef<ReturnType<typeof createLatestRead<ApplicationFollowup[]>> | null>(null);
  const request = useRef<{ text: string; key: string } | null>(null);
  const lock = useRef(false), alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    const current = createLatestRead<ApplicationFollowup[]>({ read: (_, signal) => getCompanyQuestions(jobId, youthId, signal), update: setState, errorMessage: "Kompletteringsfrågorna kunde inte hämtas." });
    reader.current = current; void current.load();
    const unsubscribe = subscribeVisibleRefresh(() => current.load());
    return () => { alive.current = false; current.stop(); reader.current = null; unsubscribe(); };
  }, [jobId, youthId]);
  const items = state.status === "ready" ? state.value : [];
  const pending = items.filter(item => item.status === "pending").length;
  const maySend = canAsk && state.status === "ready" && pending < 2 && items.length < 5;
  const send = async () => {
    if (lock.current || !maySend || !alive.current) return;
    const question = normalizedCompanyQuestion(text);
    if (!question || question.length > COMPANY_QUESTION_MAX_LENGTH) { setError("Skriv en fråga på högst 500 tecken."); return; }
    lock.current = true; setBusy(true); setError(""); setMessage("");
    // Preserve the key after an uncertain result: retrying the same text cannot send twice.
    if (!request.current || request.current.text !== question) request.current = { text: question, key: crypto.randomUUID() };
    try {
      await sendCompanyQuestion(jobId, youthId, question, request.current.key);
      if (!alive.current) return;
      request.current = null; setText(""); setOpen(false); setMessage("Frågan är skickad. Kandidaten får en notis och kan svara under Ansökningar.");
      await reader.current?.load();
    } catch (reason) { if (alive.current) setError(reason instanceof Error ? reason.message : "Frågan kunde inte skickas."); }
    finally { lock.current = false; if (alive.current) setBusy(false); }
  };
  if (state.status === "ready" && !items.length && !canAsk) return null;
  return <section className={styles.panel} aria-label="Egna kompletteringsfrågor">
    <header><h3>Frågor till kandidaten</h3>{canAsk && !open && <button type="button" className="secondary-btn" disabled={!maySend || busy} onClick={() => { setOpen(true); setMessage(""); }}>Ställ en kompletteringsfråga</button>}</header>
    {state.status === "loading" ? <p role="status">Hämtar frågor…</p> : state.status === "error" ? <div><p role="alert">{state.message}</p><button type="button" className="secondary-btn" onClick={() => void reader.current?.load()}>Försök igen</button></div> : items.length > 0 && <ul>{items.map(item => <li key={item.id}><p>{item.question}</p><span>{item.status === "pending" ? "Inväntar svar" : item.status === "answered" ? "Besvarad" : "Kandidaten avstod"}</span></li>)}</ul>}
    {canAsk && state.status === "ready" && !maySend && <p>{items.length >= 5 ? "Fem egna frågor har skickats för den här ansökan." : "Invänta svar på de två obesvarade frågorna."}</p>}
    {open && <form onSubmit={event => { event.preventDefault(); void send(); }}>
      <label htmlFor={`company-question-${jobId}-${youthId}`}>Din fråga</label><textarea id={`company-question-${jobId}-${youthId}`} value={text} maxLength={COMPANY_QUESTION_MAX_LENGTH} rows={3} disabled={busy || !canAsk} onChange={event => { setText(event.target.value); setError(""); }} />
      <p>Fråga om jobbet eller ansökan. Svaret är frivilligt. Högst 500 tecken.</p>
      <div><button type="submit" className="cta-btn" disabled={busy || !maySend}>{busy ? "Skickar…" : "Skicka fråga"}</button><button type="button" className="secondary-btn" disabled={busy} onClick={() => { setOpen(false); setError(""); }}>Avbryt</button></div>
    </form>}
    {error && <p role="alert" className={styles.error}>{error}</p>}{message && <p role="status">{message}</p>}
  </section>;
}
