"use client";

import { useState } from "react";
import { saveApplicationFollowups, type ApplicationFollowup } from "@/lib/application-completions";

export function ApplicationFollowupCard({ jobId, items, onSaved }: { jobId: string; items: ApplicationFollowup[]; onSaved: (items: ApplicationFollowup[]) => void }) {
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [skips, setSkips] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const pending = items.filter((item) => item.status === "pending");
  const save = async () => {
    if (busy) return;
    const published = Object.fromEntries(pending.filter((item) => !skips.includes(item.id) && answers[item.id]?.trim()).map((item) => [item.id, answers[item.id].trim()]));
    if (!Object.keys(published).length && !skips.length) { setError("Svara på en fråga eller välj att lämna uppgiften obesvarad."); return; }
    setBusy(true); setError(""); setMessage("");
    try {
      onSaved(await saveApplicationFollowups(jobId, published, skips));
      setAnswers({}); setSkips([]); setMessage("Din befintliga ansökan är kompletterad. Företaget kan nu läsa dina svar.");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Kunde inte skicka svaren."); }
    finally { setBusy(false); }
  };
  if (!items.length) return null;
  return <section className="application-followups" aria-label="Individuella kompletteringsfrågor">
    <div className="application-followups-heading"><span className="application-eyebrow">Matchningsunderlag</span><h3>{pending.length ? "Lite mer om dig" : "Din komplettering"}</h3></div>
    {pending.length > 0 && <p>Vi saknar några uppgifter för just det här jobbet. Svara här för att komplettera ansökan du redan har skickat. Frågorna är valfria och innebär inte att du har blivit utvald.</p>}
    {items.map((item, index) => <div className="application-question" key={item.id}>
      <label htmlFor={`followup-${item.id}`}><strong>{index + 1}. {item.question}</strong></label>
      {item.status === "pending" ? <><textarea id={`followup-${item.id}`} className="input-field" rows={3} maxLength={1500} disabled={busy || skips.includes(item.id)} value={answers[item.id] ?? ""} onChange={(event) => setAnswers((current) => ({ ...current, [item.id]: event.target.value }))} placeholder="Berätta med dina egna ord…" /><label className="application-skip"><input type="checkbox" checked={skips.includes(item.id)} disabled={busy} onChange={(event) => setSkips((current) => event.target.checked ? [...current, item.id] : current.filter((id) => id !== item.id))} />Jag vill lämna den här uppgiften obesvarad</label></> : <p className="application-published-answer">{item.status === "answered" ? item.answer : "Uppgift saknas – du valde att inte svara"}</p>}
    </div>)}
    {error && <p role="alert" className="application-completion-error">{error}</p>}
    {message && <p role="status">{message}</p>}
    {pending.length > 0 && <div className="application-completion-actions"><small>Svaren delas när du trycker på Skicka komplettering.</small><button type="button" className="cta-btn" disabled={busy} onClick={() => void save()}>{busy ? "Skickar…" : "Skicka komplettering"}</button></div>}
  </section>;
}
