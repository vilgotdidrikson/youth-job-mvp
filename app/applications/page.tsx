"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { subscribeVisibleRefresh } from "@/lib/visible-refresh";
import { useRequireAuth } from "@/hooks/use-require-auth";
import { AuthGateMessage } from "@/components/auth-gate-message";
import { getApplicationCompletions, saveApplicationAnswers, type ApplicationCompletion, getApplicationFollowups, requestApplicationFollowups, type ApplicationFollowup, type FollowupAnalysisResult } from "@/lib/application-completions";

import { ApplicationFollowupCard } from "@/components/application-followup-card";
import { UiIcon } from "@/components/ui-icon";
import { supplementQuestions } from "@/lib/application-supplement";
import { NotificationLink } from "@/components/notification-link";
import { RecruitmentSummary } from "@/components/recruitment-summary";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import {getYouthActivity,type YouthActivity} from "@/lib/youth-activity";

const recruitmentLabels: Record<string,string> = {matched:"Ni har matchat",in_contact:"Kontakt pågår",interview:"Intervju",hired:"Anställd",rejected:"Avslutad",cancelled:"Avslutad"};
import "./applications-design.css";

function analysisNotice(results: FollowupAnalysisResult[]): string {
  if (results.some((result) => result.temporary)) return "Den automatiska kontrollen kunde inte slutföras just nu. Dina skickade ansökningar finns kvar. Återvänd hit senare för ett nytt försök.";
  if (results.some((result) => result.processing)) return "Kontrollen pågår fortfarande. Återvänd hit om en stund för att läsa eventuella kompletteringsfrågor.";
  return "";
}

function ApplicationCard({ item, onSaved, followups, onFollowupsSaved, hidden, initiallyOpen, stage }: { stage?:YouthActivity; initiallyOpen:boolean; hidden: boolean; item: ApplicationCompletion; followups: ApplicationFollowup[]; onFollowupsSaved: (application:ApplicationCompletion, items: ApplicationFollowup[]) => void; onSaved: (item: ApplicationCompletion) => void }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const pending = item.status === "needs_completion";
  const save = async (submit: boolean) => {
    if (busy) return;
    setBusy(true); setError(""); setMessage("");
    try {
      const result = await saveApplicationAnswers(item.job_id, item.answers, submit);
      onSaved(result);
      setMessage(submit ? "Ansökan är skickad." : "Dina svar är sparade.");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Kunde inte spara svaren."); }
    finally { setBusy(false); }
  };
  return <article id={`application-${item.job_id}`} hidden={hidden} className="card application-completion-card">
    <header><div className="application-company-avatar">{item.company_name.slice(0, 2).toUpperCase()}</div><div><p>{item.company_name}</p><h2>{item.job_title}</h2></div><span className="application-status">{pending ? "Inte skickad ännu" : item.status === "submitted" ? "Skickad" : "Annonsen är inte tillgänglig"}</span></header>
    {item.status === "submitted" && <p className="application-sent-note"><UiIcon name="check" width="18"/>Företaget har fått din ansökan. Eventuella frågor är frivilliga.</p>}
    {stage && recruitmentLabels[stage.status] && <div className="application-recruitment-stage"><span>{recruitmentLabels[stage.status]}</span>{!["rejected","cancelled"].includes(stage.status) && <Link href={`/chats?job=${item.job_id}`}>Öppna meddelanden <UiIcon name="arrow" width="16"/></Link>}</div>}
    {pending && <p>Den här äldre ansökan är inte skickad ännu. Du kan skicka den direkt utan att svara på frågor. Eventuell komplettering görs efteråt.</p>}
    <ApplicationFollowupCard application={item} items={followups} initiallyOpen={initiallyOpen} onSaved={onFollowupsSaved} />
    <Link className="application-job-link" href={`/jobb/${item.job_id}`}>Visa annons <UiIcon name="arrow" width="16" /></Link>
    {error && <p role="alert" className="application-completion-error">{error}</p>}
    {message && <p role="status">{message}</p>}
    {pending && <div className="application-completion-actions"><button type="button" className="cta-btn" disabled={busy} onClick={() => void save(true)}>{busy ? "Skickar…" : "Skicka ansökan direkt"}</button></div>}
  </article>;
}

function ApplicationsPageContent() {
  const { user, profile, status, error: sessionError } = useRequireAuth();
  const [items, setItems] = useState<ApplicationCompletion[]>([]);
  const [followups, setFollowups] = useState<ApplicationFollowup[]>([]);
  const [activity,setActivity] = useState<YouthActivity[]>([]);
  const [tab, setTab] = useState<"all" | "questions">("all");
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(false);
  const [checkNotice, setCheckNotice] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState("");
  const userId = user?.id;
  const savedRevision = useRef(0);
  const searchParams = useSearchParams();
  const selectedJob = searchParams.get("job");
  useEffect(() => {
    if (!userId || profile?.role !== "youth" || loading) return;
    let active = true;
    const unsubscribe = subscribeVisibleRefresh(async () => {
      const revision = savedRevision.current;
      const [questions,data,stages] = await Promise.all([getApplicationFollowups(),getApplicationCompletions(),getYouthActivity(userId)]);
      if (active && revision === savedRevision.current) {setFollowups(questions);setItems(data);setActivity(stages);}
    });
    return () => { active = false; unsubscribe(); };
  }, [userId, profile?.role, loading]);
  useEffect(() => {
    if (!userId || profile?.role !== "youth") return;
    let active = true;
    void Promise.all([getApplicationCompletions(), getApplicationFollowups(),getYouthActivity(userId)]).then(([data, questions,stages]) => {
      if (!active) return;
      setItems(data); setFollowups(questions);setActivity(stages);
      setChecking(data.some((item) => item.status === "submitted"));
      const analysisRevision=savedRevision.current;
      // At most three recent applications per visit; cached source prevents repeated AI work.
      void Promise.all(data.filter((item) => item.status === "submitted").slice(0, 3).map((item) => requestApplicationFollowups(item.job_id)))
        .then((results) => { if (active) setCheckNotice(analysisNotice(results)); return Promise.all([getApplicationFollowups(),getApplicationCompletions()] as const); }).then(([updated,applications]) => { if (active && savedRevision.current===analysisRevision) {setFollowups(updated);setItems(applications);window.dispatchEvent(new Event("mnw-navigation-refresh"));} }).catch(() => {}).finally(() => { if (active) setChecking(false); });
    })
      .catch((reason) => { if (active) setError(reason instanceof Error ? reason.message : "Kunde inte hämta ansökningar."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [userId, profile?.role]);
  if (status !== "ready") return <AuthGateMessage status={status} error={sessionError} />;
  if (profile?.role !== "youth") return <main className="mobile-shell"><p>Den här sidan är för ungdomskonton.</p></main>;
  const needsAnswers = (item: ApplicationCompletion) => item.status === "submitted" && supplementQuestions(item,followups.filter(question=>question.job_id===item.job_id)).some(question=>question.status === "pending");
  const pending = items.filter(needsAnswers);
  const ordered = [...pending, ...items.filter((item) => !needsAnswers(item))].sort((a,b)=>a.job_id===selectedJob ? -1 : b.job_id===selectedJob ? 1 : 0);
  const visible = tab === "questions" ? pending : ordered;
  return <main className="mobile-shell application-completions-page">
    <header className="applications-heading"><div><p className="application-eyebrow">Dina nästa steg</p><h1>Dina ansökningar</h1><p>Följ det du har skickat. Komplettera när det passar dig.</p></div><NotificationLink /></header>
    <div className="applications-layout"><section className="applications-content">
      <RecruitmentSummary />
      <div className="applications-tabs"><button type="button" aria-pressed={tab === "all"} onClick={() => setTab("all")}>Alla <span>{items.length}</span></button><button type="button" aria-pressed={tab === "questions"} onClick={() => setTab("questions")}>Frivilliga frågor <span>{pending.filter(item=>item.status==='submitted').length}</span></button></div>
      {error && <p role="alert" className="application-completion-error">{error}</p>}
      {confirmation && <p role="status" className="applications-confirmation"><UiIcon name="check" width="18" />{confirmation}</p>}
      {checking && <p role="status" className="applications-checking">Vi kontrollerar om dina ansökningar behöver fler uppgifter. Frågorna visas här när kontrollen är klar.</p>}
      {!checking && checkNotice && <p role="status" className="applications-checking">{checkNotice}</p>}
      {!loading && tab === "all" && activity.filter(stage=>!items.some(item=>item.job_id===stage.jobId)).map(stage=><article className="card application-completion-card" key={stage.jobId}><header><div><p>{stage.company}</p><h2>{stage.title}</h2></div><span className="application-status">{stage.status==="draft" ? "Inte skickad ännu" : recruitmentLabels[stage.status] || "Skickad"}</span></header><p>{stage.status==="draft" ? "Ditt intresse är sparat. Gör klart CV:t så skickas ansökan." : "Ansökan finns kvar. Följ nästa steg här."}</p><Link className="application-job-link" href={stage.status==="draft" ? "/youth/cv" : recruitmentLabels[stage.status] && !["rejected","cancelled"].includes(stage.status) ? `/chats?job=${stage.jobId}` : `/jobb/${stage.jobId}`}>{stage.status==="draft" ? "Gör klart CV:t" : "Visa nästa steg"}<UiIcon name="arrow" width="16"/></Link></article>)}
      {loading ? <p role="status" className="applications-empty">Hämtar dina ansökningar…</p> : ordered.map((item) => <ApplicationCard key={item.job_id} hidden={tab === "questions" && !needsAnswers(item)} initiallyOpen={item.job_id===selectedJob} stage={activity.find(stage=>stage.jobId===item.job_id)} item={item} followups={followups.filter((question) => question.job_id === item.job_id)} onFollowupsSaved={(application,saved) => { savedRevision.current++; setItems(current=>current.map(entry=>entry.job_id===application.job_id ? application : entry)); window.dispatchEvent(new Event("mnw-navigation-refresh")); setFollowups((current) => [...current.filter((question) => question.job_id !== item.job_id), ...saved]); setConfirmation("Kompletteringen är skickad. Din ansökan var redan skickad."); }} onSaved={(saved) => {
        savedRevision.current++;
        setItems((current) => current.map((entry) => entry.job_id === saved.job_id ? saved : entry));
        if (saved.status === "submitted") { setChecking(true); setCheckNotice(""); void requestApplicationFollowups(saved.job_id).then((result) => { setCheckNotice(analysisNotice([result])); return getApplicationFollowups(); }).then(setFollowups).catch(() => {}).finally(() => setChecking(false)); }
      }} />)}
      {!loading && visible.length === 0 && (tab === "questions" || activity.length === 0) && <section className="applications-empty"><UiIcon name={tab === "questions" ? "check" : "briefcase"} width="32" height="32" /><h2>{tab === "questions" ? checking ? "Vi går igenom ditt underlag" : "Inga frågor att besvara just nu" : "Ditt nästa jobb börjar här"}</h2><p>{tab === "questions" ? "Nya kompletteringsfrågor dyker upp här och i dina notiser." : "När du söker ett jobb samlar vi din ansökan här."}</p><Link className="cta-btn" href="/swipe">Upptäck jobb</Link></section>}
    </section><aside className="applications-aside"><UiIcon name="info" width="24" /><h2>En ansökan, mer om dig</h2><p>Kompletteringsfrågorna utgår från just det här jobbets önskemål. Dina svar läggs till i ansökan du redan har skickat.</p><p>Du kan lämna en fråga obesvarad. Saknad information är aldrig ett automatiskt avslag.</p><Link href="/notifications">Till din aktivitet <UiIcon name="arrow" width="16" /></Link><Link href="/youth/cv">Se ditt CV <UiIcon name="arrow" width="16" /></Link></aside></div>
  </main>;
}

export default function ApplicationsPage() { return <Suspense fallback={<main className="mobile-shell"><p role="status">Hämtar ansökningar…</p></main>}><ApplicationsPageContent/></Suspense>; }
