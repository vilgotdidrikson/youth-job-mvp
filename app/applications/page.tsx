"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { subscribeVisibleRefresh } from "@/lib/visible-refresh";
import { useRequireAuth } from "@/hooks/use-require-auth";
import { AuthGateMessage } from "@/components/auth-gate-message";
import { getApplicationCompletions, prepareApplication, saveApplicationAnswers, type ApplicationCompletion, getApplicationFollowups, requestApplicationFollowups, type ApplicationFollowup, type FollowupAnalysisResult } from "@/lib/application-completions";

import { ApplicationFollowupCard } from "@/components/application-followup-card";
import { UiIcon } from "@/components/ui-icon";
import "./applications-design.css";

function analysisNotice(results: FollowupAnalysisResult[]): string {
  if (results.some((result) => result.temporary)) return "Den automatiska kontrollen kunde inte slutföras just nu. Dina skickade ansökningar finns kvar. Återvänd hit senare för ett nytt försök.";
  if (results.some((result) => result.processing)) return "Kontrollen pågår fortfarande. Återvänd hit om en stund för att läsa eventuella kompletteringsfrågor.";
  return "";
}

function ApplicationCard({ item, onSaved, followups, onFollowupsSaved }: { item: ApplicationCompletion; followups: ApplicationFollowup[]; onFollowupsSaved: (items: ApplicationFollowup[]) => void; onSaved: (item: ApplicationCompletion) => void }) {
  const [answers, setAnswers] = useState(item.answers);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const pending = item.status === "needs_completion";
  const readCv = async () => {
    if (busy) return;
    setBusy(true); setError(""); setMessage("");
    try {
      // Persist manual edits first; automatic evidence only fills remaining blanks.
      await saveApplicationAnswers(item.job_id, answers, false);
      const updated = await prepareApplication(item.job_id);
      setAnswers(updated.answers); onSaved(updated);
      setMessage(updated.status === "submitted" ? "CV:t besvarade frågorna och ansökan är skickad." : "Inga fler säkra svar kunde hämtas. Du kan svara själv eller skicka med uppgift saknas. Skannade PDF-filer kan behöva kompletteras manuellt.");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Kunde inte läsa CV:t."); }
    finally { setBusy(false); }
  };
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
    <header><div className="application-company-avatar">{item.company_name.slice(0, 2).toUpperCase()}</div><div><p>{item.company_name}</p><h2>{item.job_title}</h2></div><span className="application-status">{pending ? "Behöver kompletteras" : item.status === "submitted" ? followups.some((question) => question.status === "pending") ? "Frågor att besvara" : "Skickad" : "Annonsen är inte tillgänglig"}</span></header>
    {pending && <p>Frågorna bygger på företagets önskemål och skickas automatiskt av MatchnWork. Arbetsgivaren får läsa svaren när du skickar ansökan. CV och svar används för ett förklarat matchningsunderlag. Frågorna innebär inte att du redan har blivit utvald.</p>}
    {pending && <button type="button" className="secondary-btn" disabled={busy} onClick={() => void readCv()}>Hämta saknade svar från CV</button>}
    {item.questions.map((question, index) => <label className="application-question" key={question.id}>
      <strong>{index + 1}. {question.question}</strong>
      {pending ? <><small>Valfritt. Frågan hjälper företaget att bedöma din ansökan när uppgiften saknas i ditt CV.</small><textarea className="input-field" rows={3} maxLength={1500} disabled={busy} value={answers[question.id] ?? ""} onChange={(event) => setAnswers((current) => ({ ...current, [question.id]: event.target.value }))} placeholder="Skriv ditt svar, eller lämna tomt för uppgift saknas" /></> : <p>{item.answers[question.id]?.trim() || "Uppgift saknas"}</p>}
    </label>)}
    <ApplicationFollowupCard jobId={item.job_id} items={followups} onSaved={onFollowupsSaved} />
    <Link className="application-job-link" href={`/jobb/${item.job_id}`}>Visa annons <UiIcon name="arrow" width="16" /></Link>
    {error && <p role="alert" className="application-completion-error">{error}</p>}
    {message && <p role="status">{message}</p>}
    {pending && <><p className="application-completion-note">Du kan lämna frågor tomma. Ansökan skickas då med ”uppgift saknas”.</p><div className="application-completion-actions"><button type="button" className="secondary-btn" disabled={busy} onClick={() => void save(false)}>Spara till senare</button><button type="button" className="cta-btn" disabled={busy} onClick={() => void save(true)}>{busy ? "Sparar…" : "Skicka ansökan"}</button></div></>}
  </article>;
}

export default function ApplicationsPage() {
  const { user, profile, status, error: sessionError } = useRequireAuth();
  const [items, setItems] = useState<ApplicationCompletion[]>([]);
  const [followups, setFollowups] = useState<ApplicationFollowup[]>([]);
  const [tab, setTab] = useState<"all" | "questions">("all");
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(false);
  const [checkNotice, setCheckNotice] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState("");
  const userId = user?.id;
  const savedRevision = useRef(0);
  useEffect(() => {
    if (!userId || profile?.role !== "youth" || loading) return;
    let active = true;
    const unsubscribe = subscribeVisibleRefresh(async () => {
      const revision = savedRevision.current;
      const questions = await getApplicationFollowups();
      if (active && revision === savedRevision.current) setFollowups(questions);
    });
    return () => { active = false; unsubscribe(); };
  }, [userId, profile?.role, loading]);
  useEffect(() => {
    if (!userId || profile?.role !== "youth") return;
    let active = true;
    void Promise.all([getApplicationCompletions(), getApplicationFollowups()]).then(([data, questions]) => {
      if (!active) return;
      setItems(data); setFollowups(questions);
      setChecking(data.some((item) => item.status === "submitted"));
      // At most three recent applications per visit; cached source prevents repeated AI work.
      void Promise.all(data.filter((item) => item.status === "submitted").slice(0, 3).map((item) => requestApplicationFollowups(item.job_id)))
        .then((results) => { if (active) setCheckNotice(analysisNotice(results)); return getApplicationFollowups(); }).then((updated) => { if (active) setFollowups(updated); }).catch(() => {}).finally(() => { if (active) setChecking(false); });
    })
      .catch((reason) => { if (active) setError(reason instanceof Error ? reason.message : "Kunde inte hämta ansökningar."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [userId, profile?.role]);
  if (status !== "ready") return <AuthGateMessage status={status} error={sessionError} />;
  if (profile?.role !== "youth") return <main className="mobile-shell"><p>Den här sidan är för ungdomskonton.</p></main>;
  const needsAnswers = (item: ApplicationCompletion) => item.status === "needs_completion" || followups.some((question) => question.job_id === item.job_id && question.status === "pending");
  const pending = items.filter(needsAnswers);
  const ordered = [...pending, ...items.filter((item) => !needsAnswers(item))];
  const visible = tab === "questions" ? pending : ordered;
  return <main className="mobile-shell application-completions-page">
    <header className="applications-heading"><p className="application-eyebrow">Dina nästa steg</p><h1>Dina ansökningar</h1><p>Håll koll på dina svar och komplettera med det som gör dig lättare att lära känna.</p></header>
    <div className="applications-layout"><section className="applications-content">
      <div className="applications-tabs"><button type="button" aria-pressed={tab === "all"} onClick={() => setTab("all")}>Alla ansökningar <span>{items.length}</span></button><button type="button" aria-pressed={tab === "questions"} onClick={() => setTab("questions")}>Att besvara <span>{pending.length}</span></button></div>
      {error && <p role="alert" className="application-completion-error">{error}</p>}
      {confirmation && <p role="status" className="applications-confirmation"><UiIcon name="check" width="18" />{confirmation}</p>}
      {checking && <p role="status" className="applications-checking">Vi kontrollerar om dina ansökningar behöver fler uppgifter. Frågorna visas här när kontrollen är klar.</p>}
      {!checking && checkNotice && <p role="status" className="applications-checking">{checkNotice}</p>}
      {loading ? <p role="status" className="applications-empty">Hämtar dina ansökningar…</p> : visible.length ? visible.map((item) => <ApplicationCard key={item.job_id} item={item} followups={followups.filter((question) => question.job_id === item.job_id)} onFollowupsSaved={(saved) => { savedRevision.current++; setFollowups((current) => [...current.filter((question) => question.job_id !== item.job_id), ...saved]); setConfirmation("Din befintliga ansökan är kompletterad. Företaget kan nu läsa dina svar."); }} onSaved={(saved) => {
        savedRevision.current++;
        setItems((current) => current.map((entry) => entry.job_id === saved.job_id ? saved : entry));
        if (saved.status === "submitted") { setChecking(true); setCheckNotice(""); void requestApplicationFollowups(saved.job_id).then((result) => { setCheckNotice(analysisNotice([result])); return getApplicationFollowups(); }).then(setFollowups).catch(() => {}).finally(() => setChecking(false)); }
      }} />) : <section className="applications-empty"><UiIcon name={tab === "questions" ? "check" : "briefcase"} width="32" height="32" /><h2>{tab === "questions" ? checking ? "Vi går igenom ditt underlag" : "Inga frågor att besvara just nu" : "Ditt nästa jobb börjar här"}</h2><p>{tab === "questions" ? "Nya kompletteringsfrågor dyker upp här och i dina notiser." : "När du söker ett jobb samlar vi din ansökan här."}</p><Link className="cta-btn" href="/swipe">Upptäck jobb</Link></section>}
    </section><aside className="applications-aside"><UiIcon name="info" width="24" /><h2>En ansökan, mer om dig</h2><p>Kompletteringsfrågorna utgår från just det här jobbets önskemål. Dina svar läggs till i ansökan du redan har skickat.</p><p>Du kan lämna en fråga obesvarad. Saknad information är aldrig ett automatiskt avslag.</p><Link href="/notifications">Till din aktivitet <UiIcon name="arrow" width="16" /></Link><Link href="/youth/cv">Se ditt CV <UiIcon name="arrow" width="16" /></Link></aside></div>
  </main>;
}
