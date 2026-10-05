"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRequireAuth } from "@/hooks/use-require-auth";
import { AuthGateMessage } from "@/components/auth-gate-message";
import { getApplicationCompletions, saveApplicationAnswers, type ApplicationCompletion } from "@/lib/application-completions";

function ApplicationCard({ item, onSaved }: { item: ApplicationCompletion; onSaved: (item: ApplicationCompletion) => void }) {
  const [answers, setAnswers] = useState(item.answers);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const pending = item.status === "needs_completion";
  const save = async (submit: boolean) => {
    if (busy) return;
    setBusy(true); setError(""); setMessage("");
    try {
      const result = await saveApplicationAnswers(item.job_id, answers, submit);
      onSaved(result);
      setMessage(submit ? "Ansökan är skickad." : "Dina svar är sparade.");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Kunde inte spara svaren."); }
    finally { setBusy(false); }
  };
  return <article className="card application-completion-card">
    <header><p>{item.company_name}</p><h2>{item.job_title}</h2><span>{pending ? "Behöver kompletteras" : item.status === "submitted" ? "Skickad" : "Annonsen är inte tillgänglig"}</span></header>
    {pending && <p>Frågorna bygger på företagets önskemål och skickas automatiskt av MatchnWork. Arbetsgivaren får läsa svaren när du skickar ansökan. CV och svar används för ett förklarat matchningsunderlag. Frågorna innebär inte att du redan har blivit utvald.</p>}
    {item.questions.map((question, index) => <label className="application-question" key={question.id}>
      <strong>{index + 1}. {question.question}</strong>
      {pending ? <><small>Valfritt. Frågan hjälper företaget att bedöma din ansökan när uppgiften saknas i ditt CV.</small><textarea className="input-field" rows={3} maxLength={1500} disabled={busy} value={answers[question.id] ?? ""} onChange={(event) => setAnswers((current) => ({ ...current, [question.id]: event.target.value }))} placeholder="Skriv ditt svar, eller lämna tomt för uppgift saknas" /></> : <p>{item.answers[question.id]?.trim() || "Uppgift saknas"}</p>}
    </label>)}
    {error && <p role="alert" className="application-completion-error">{error}</p>}
    {message && <p role="status">{message}</p>}
    {pending && <><p className="application-completion-note">Du kan lämna frågor tomma. Ansökan skickas då med ”uppgift saknas”.</p><div className="application-completion-actions"><button type="button" className="secondary-btn" disabled={busy} onClick={() => void save(false)}>Spara till senare</button><button type="button" className="cta-btn" disabled={busy} onClick={() => void save(true)}>{busy ? "Sparar…" : "Skicka ansökan"}</button></div></>}
  </article>;
}

export default function ApplicationsPage() {
  const { user, profile, status, error: sessionError } = useRequireAuth();
  const [items, setItems] = useState<ApplicationCompletion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    if (!user || profile?.role !== "youth") return;
    let active = true;
    void getApplicationCompletions().then((data) => { if (active) setItems(data); })
      .catch((reason) => { if (active) setError(reason instanceof Error ? reason.message : "Kunde inte hämta ansökningar."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [user, profile?.role]);
  if (status !== "ready") return <AuthGateMessage status={status} error={sessionError} />;
  if (profile?.role !== "youth") return <main className="mobile-shell"><p>Den här sidan är för ungdomskonton.</p></main>;
  const pending = items.filter((item) => item.status === "needs_completion");
  const ordered = [...pending, ...items.filter((item) => item.status !== "needs_completion")];
  return <main className="mobile-shell application-completions-page"><Link href="/swipe">← Hitta jobb</Link><h1>Dina ansökningar</h1><p>{pending.length ? `${pending.length} ${pending.length === 1 ? "ansökan behöver" : "ansökningar behöver"} kompletteras. Det tar ungefär två minuter per jobb.` : "Här finns dina ansökningsfrågor och svar."}</p>{error && <p role="alert">{error}</p>}{loading ? <p>Laddar ansökningar…</p> : ordered.length ? ordered.map((item) => <ApplicationCard key={item.job_id} item={item} onSaved={(saved) => setItems((current) => current.map((entry) => entry.job_id === saved.job_id ? saved : entry))} />) : <p>Inga ansökningsfrågor ännu. <Link href="/swipe">Utforska lediga jobb</Link>.</p>}</main>;
}
