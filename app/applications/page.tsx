"use client";
import { useApplicationRetention } from "@/hooks/use-data-retention";
import { ApplicationRetentionNotice, RetiredApplicationCard } from "@/components/data-retention-notice";
import type { ApplicationRetention } from "@/lib/data-retention";
import { JobRequirementsInsight } from "@/components/job-requirements-insight";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { subscribeVisibleRefresh } from "@/lib/visible-refresh";
import { useRequireAuth } from "@/hooks/use-require-auth";
import { AuthGateMessage } from "@/components/auth-gate-message";
import { getApplicationCompletions, prepareApplication, saveApplicationAnswers, type ApplicationCompletion, getApplicationFollowups, requestApplicationFollowups, type ApplicationFollowup, type FollowupAnalysisResult } from "@/lib/application-completions";

import { ApplicationFollowupCard } from "@/components/application-followup-card";
import { UiIcon } from "@/components/ui-icon";
import { TabList } from "@/components/tab-list";
import { tabPanelProps } from "@/lib/tab-keyboard";
import { supplementQuestions } from "@/lib/application-supplement";
import { NotificationLink } from "@/components/notification-link";
import { RecruitmentSummary } from "@/components/recruitment-summary";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import {getYouthActivity,type YouthActivity} from "@/lib/youth-activity";
import { activityWithoutApplication, applicationCounts, isUnsent, pendingInterestView } from "@/lib/application-overview";
import { useCvCompletion } from "@/hooks/use-cv-completion";
import { WithdrawApplicationButton } from "@/components/withdraw-application-button";
import { canWithdrawApplication, withdrawalCopy, type WithdrawalResult } from "@/lib/application-withdrawal";

const recruitmentLabels: Record<string,string> = {matched:"Ni har matchat",in_contact:"Kontakt pågår",interview:"Intervju",hired:"Anställd",rejected:"Avslutad",cancelled:"Avslutad"};
import "./applications-design.css";

function analysisNotice(results: FollowupAnalysisResult[]): string {
  if (results.some((result) => result.temporary)) return "Den automatiska kontrollen kunde inte slutföras just nu. Dina skickade ansökningar finns kvar. Återvänd hit senare för ett nytt försök.";
  if (results.some((result) => result.processing)) return "Kontrollen pågår fortfarande. Återvänd hit om en stund för att läsa eventuella kompletteringsfrågor.";
  return "";
}

function ApplicationCard({ retention, item, onSaved, followups, onFollowupsSaved, hidden, initiallyOpen, stage, onWithdrawn }: { retention?: ApplicationRetention; onWithdrawn: (jobId: string, result: WithdrawalResult) => void; stage?:YouthActivity; initiallyOpen:boolean; hidden: boolean; item: ApplicationCompletion; followups: ApplicationFollowup[]; onFollowupsSaved: (application:ApplicationCompletion, items: ApplicationFollowup[]) => void; onSaved: (item: ApplicationCompletion) => void }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  if (retention?.expired) return <RetiredApplicationCard record={retention} hidden={hidden}/>;
  const pending = item.status === "needs_completion";
  if (item.status === "withdrawn") return <article id={`application-${item.job_id}`} hidden={hidden} className="card application-completion-card"><header><div><p>{item.company_name}</p><h2>{item.job_title}</h2></div><span className="application-status">Återkallad</span></header><p>Ansökan eller det sparade intresset är återkallat och skickas inte igen automatiskt. En eventuell match är avslutad och chatten är skrivskyddad.</p>{item.withdrawn_at && <p>Återkallad {new Date(item.withdrawn_at).toLocaleDateString("sv-SE")}</p>}<ApplicationRetentionNotice record={retention}/></article>;
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
    <ApplicationRetentionNotice record={retention}/>
    {item.status === "submitted" && <p className="application-sent-note"><UiIcon name="check" width="18"/>Företaget har fått din ansökan. Eventuella frågor är frivilliga.</p>}
    {stage && recruitmentLabels[stage.status] && <div className="application-recruitment-stage"><span>{recruitmentLabels[stage.status]}</span>{!["rejected","cancelled"].includes(stage.status) && <Link href={`/chats?job=${item.job_id}`}>Öppna meddelanden <UiIcon name="arrow" width="16"/></Link>}</div>}
    {pending && <p>Den här äldre ansökan är inte skickad ännu. Du kan skicka den direkt utan att svara på frågor. Eventuell komplettering görs efteråt.</p>}
    <JobRequirementsInsight jobId={item.job_id}/>
    <ApplicationFollowupCard application={item} items={followups} initiallyOpen={initiallyOpen} onSaved={onFollowupsSaved} />
    <Link className="application-job-link" href={`/applications/preview?job=${encodeURIComponent(item.job_id)}`}>Se och uppdatera delat underlag</Link>
    <Link className="application-job-link" href={`/jobb/${item.job_id}`}>Visa annons <UiIcon name="arrow" width="16" /></Link>
    {error && <p role="alert" className="application-completion-error">{error}</p>}
    {message && <p role="status">{message}</p>}
    {pending && <div className="application-completion-actions"><button type="button" className="cta-btn" disabled={busy} onClick={() => void save(true)}>{busy ? "Skickar…" : "Skicka ansökan direkt"}</button></div>}
    {canWithdrawApplication(item.status, stage?.status) && <div className="application-completion-actions"><WithdrawApplicationButton jobId={item.job_id} title={item.job_title} submitted={item.status === "submitted" || Boolean(item.submitted_at)} disabled={busy} onBusyChange={setBusy} onWithdrawn={result => onWithdrawn(item.job_id, result)}/></div>}
  </article>;
}

/** Saved interest or a stage without an application row. Saved interest is never presented as sent. */
function ActivityCard({ stage, hidden, cvCompleted, onSend, onWithdrawn }: { onWithdrawn: (jobId: string, result: WithdrawalResult) => void; stage: YouthActivity; hidden: boolean; cvCompleted: boolean | null; onSend: (jobId: string) => Promise<void> }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const header = (label: string) => <header><div className="application-company-avatar">{stage.company.slice(0, 2).toUpperCase()}</div><div><p>{stage.company}</p><h2>{stage.title}</h2></div><span className="application-status">{label}</span></header>;
  const withdraw = <WithdrawApplicationButton jobId={stage.jobId} title={stage.title} submitted={stage.status !== "draft"} disabled={busy} onBusyChange={setBusy} onWithdrawn={result => onWithdrawn(stage.jobId, result)}/>;
  if (stage.status === "withdrawn") return <article className="card application-completion-card" hidden={hidden}>{header("Återkallad")}<p>Intresset är återkallat och skickas inte igen automatiskt.</p></article>;
  if (stage.status !== "draft") {
    const active = recruitmentLabels[stage.status] && !["rejected", "cancelled"].includes(stage.status);
    return <article className="card application-completion-card" hidden={hidden}>{header(recruitmentLabels[stage.status] || "Skickad")}<p>Ansökan finns kvar. Följ nästa steg här.</p><Link className="application-job-link" href={active ? `/chats?job=${stage.jobId}` : `/jobb/${stage.jobId}`}>Visa nästa steg<UiIcon name="arrow" width="16"/></Link>{stage.status !== "hired" && withdraw}</article>;
  }
  const view = pendingInterestView(stage, cvCompleted);
  const send = async () => {
    if (busy) return;
    setBusy(true); setError("");
    try { await onSend(stage.jobId); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Ansökan kunde inte skickas. Försök igen."); }
    finally { setBusy(false); }
  };
  return <article id={`application-${stage.jobId}`} className="card application-completion-card application-pending-interest" hidden={hidden}>
    {header(view.label)}
    <p>{view.body}</p>
    {view.showJobLink && <Link className="application-job-link" href={`/jobb/${stage.jobId}`}>Visa annons <UiIcon name="arrow" width="16" /></Link>}
    {error && <p role="alert" className="application-completion-error">{error}</p>}
    {view.action === "complete_cv" && <div className="application-completion-actions"><Link className="cta-btn" href={`/youth/cv?job=${encodeURIComponent(stage.jobId)}&title=${encodeURIComponent(stage.title)}`}>Gör klart CV:t</Link></div>}
    {view.action === "send" && <div className="application-completion-actions"><button type="button" className="cta-btn" disabled={busy} onClick={() => void send()}>{busy ? "Skickar…" : "Skicka ansökan"}</button></div>}
    <div className="application-completion-actions">{withdraw}</div>
  </article>;
}

function ApplicationsPageContent() {
  const { user, profile, status, error: sessionError } = useRequireAuth();
  const [items, setItems] = useState<ApplicationCompletion[]>([]);
  const [followups, setFollowups] = useState<ApplicationFollowup[]>([]);
  const [activity,setActivity] = useState<YouthActivity[]>([]);
  const [tab, setTab] = useState<"all" | "unsent" | "questions">("all");
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(false);
  const [checkNotice, setCheckNotice] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState("");
  const userId = user?.id;
  const retention = useApplicationRetention(profile?.role === "youth" ? userId : undefined);
  const retentionByJob = new Map(retention.value.map(row => [row.job_id, row]));
  const retiredRows = retention.value.filter(row => row.expired && !items.some(item => item.job_id === row.job_id));
  const savedRevision = useRef(0);
  const searchParams = useSearchParams();
  const selectedJob = searchParams.get("job");
  const { cvCompleted, cvLoading } = useCvCompletion(userId, profile?.role === "youth");
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
  const needsAnswers = (item: ApplicationCompletion) => !retentionByJob.get(item.job_id)?.expired && item.status === "submitted" && supplementQuestions(item,followups.filter(question=>question.job_id===item.job_id)).some(question=>question.status === "pending");
  const pending = items.filter(needsAnswers);
  const ordered = [...pending, ...items.filter((item) => !needsAnswers(item))].sort((a,b)=>a.job_id===selectedJob ? -1 : b.job_id===selectedJob ? 1 : 0);
  const extraActivity = activityWithoutApplication(activity, items).filter(stage => !retentionByJob.get(stage.jobId)?.expired);
  const counts = applicationCounts(items, activity, needsAnswers);
  counts.all += retiredRows.filter(row => !activity.some(stage => stage.jobId === row.job_id)).length;
  const itemHidden = (item: ApplicationCompletion) => (tab === "questions" && !needsAnswers(item)) || (tab === "unsent" && !isUnsent(item));
  const visibleCount = tab === "all" ? counts.all : tab === "unsent" ? counts.unsent : counts.questions;
  const withdrawn = (jobId: string, result: WithdrawalResult) => {
    savedRevision.current++;
    setItems(current => current.map(item => item.job_id === jobId ? { ...item, status: "withdrawn", withdrawn_at: result.withdrawn_at } : item));
    setActivity(current => current.map(stage => stage.jobId === jobId ? { ...stage, status: "withdrawn" } : stage));
    setFollowups(current => current.filter(item => item.job_id !== jobId));
    setConfirmation(withdrawalCopy(result.was_submitted).confirmation);
    window.dispatchEvent(new Event("mnw-navigation-refresh"));
    const revision = savedRevision.current;
    void Promise.all([getApplicationCompletions(),getYouthActivity(userId!)]).then(([data,stages]) => {
      if (revision === savedRevision.current) { setItems(data); setActivity(stages); }
    }).catch(() => setError("Återkallelsen är sparad, men listan kunde inte hämtas igen. Ladda om sidan för aktuell historik."));
  };
  const sendSavedInterest = async (jobId: string) => {
    const sent = await prepareApplication(jobId);
    savedRevision.current++;
    const [data, stages] = await Promise.all([getApplicationCompletions(), getYouthActivity(userId!)]);
    setItems(data); setActivity(stages);
    setConfirmation(`Ansökan till ${sent.job_title} är skickad.`);
    window.dispatchEvent(new Event("mnw-navigation-refresh"));
    setChecking(true); setCheckNotice("");
    void requestApplicationFollowups(jobId).then((result) => { setCheckNotice(analysisNotice([result])); return getApplicationFollowups(); }).then(setFollowups).catch(() => {}).finally(() => setChecking(false));
  };
  return <main className="mobile-shell application-completions-page">
    <header className="applications-heading"><div><p className="application-eyebrow">Dina nästa steg</p><h1>Dina ansökningar</h1><p>Följ dina ansökningar och sparade intressen. Komplettera när det passar dig.</p></div><NotificationLink /></header>
    <div className="applications-layout"><section className="applications-content">
      <RecruitmentSummary />
      <TabList id="applications" label="Visa ansökningar" className="applications-tabs" items={[{ value: "all", label: <>Alla <span>{counts.all}</span></> }, ...(counts.unsent > 0 || tab === "unsent" ? [{ value: "unsent" as const, label: <>Inte skickade <span>{counts.unsent}</span></> }] : []), { value: "questions", label: <>Frivilliga frågor <span>{counts.questions}</span></> }]} value={tab} onChange={setTab} />
      {error && <p role="alert" className="application-completion-error">{error}</p>}
      {retention.state.status === "error" && <div><p role="alert">{retention.state.message}</p><button type="button" className="secondary-btn" onClick={retention.retry}>Hämta lagringsstatus igen</button></div>}
      {confirmation && <p role="status" className="applications-confirmation"><UiIcon name="check" width="18" />{confirmation}</p>}
      {checking && <p role="status" className="applications-checking">Vi kontrollerar om dina ansökningar behöver fler uppgifter. Frågorna visas här när kontrollen är klar.</p>}
      {!checking && checkNotice && <p role="status" className="applications-checking">{checkNotice}</p>}
      <div className="applications-tab-panel" {...tabPanelProps("applications", tab)}>
      {!loading && extraActivity.map(stage => <ActivityCard key={stage.jobId} stage={stage} hidden={tab === "questions" || (tab === "unsent" && !isUnsent(stage))} cvCompleted={cvLoading ? null : cvCompleted} onSend={sendSavedInterest} onWithdrawn={withdrawn} />)}
      {loading ? <p role="status" className="applications-empty">Hämtar dina ansökningar…</p> : ordered.map((item) => <ApplicationCard key={item.job_id} retention={retentionByJob.get(item.job_id)} hidden={itemHidden(item)} initiallyOpen={item.job_id===selectedJob} stage={activity.find(stage=>stage.jobId===item.job_id)} item={item} followups={followups.filter((question) => question.job_id === item.job_id)} onWithdrawn={withdrawn} onFollowupsSaved={(application,saved) => { savedRevision.current++; setItems(current=>current.map(entry=>entry.job_id===application.job_id ? application : entry)); window.dispatchEvent(new Event("mnw-navigation-refresh")); setFollowups((current) => [...current.filter((question) => question.job_id !== item.job_id), ...saved]); setConfirmation("Kompletteringen är skickad. Din ansökan var redan skickad."); }} onSaved={(saved) => {
        savedRevision.current++;
        setItems((current) => current.map((entry) => entry.job_id === saved.job_id ? saved : entry));
        if (saved.status === "submitted") { setChecking(true); setCheckNotice(""); void requestApplicationFollowups(saved.job_id).then((result) => { setCheckNotice(analysisNotice([result])); return getApplicationFollowups(); }).then(setFollowups).catch(() => {}).finally(() => setChecking(false)); }
      }} />)}
      {!loading && tab === "all" && retiredRows.map(row => <RetiredApplicationCard key={row.job_id} record={row}/>)}
      {!loading && visibleCount === 0 && (tab !== "all" || retiredRows.length === 0) && <section className="applications-empty"><UiIcon name={tab === "all" ? "briefcase" : "check"} width="32" height="32" /><h2>{tab === "questions" ? checking ? "Vi går igenom ditt underlag" : "Inga frågor att besvara just nu" : tab === "unsent" ? "Allt är skickat" : "Ditt nästa jobb börjar här"}</h2><p>{tab === "questions" ? "Nya kompletteringsfrågor dyker upp här och i dina notiser." : tab === "unsent" ? "Du har inga sparade intressen som väntar på att skickas." : "När du söker ett jobb samlar vi din ansökan här."}</p><Link className="cta-btn" href="/swipe">Upptäck jobb</Link></section>}
      </div>
    </section><aside className="applications-aside"><UiIcon name="info" width="24" /><h2>En ansökan, mer om dig</h2><p>Kompletteringsfrågorna utgår från just det här jobbets önskemål. Dina svar läggs till i ansökan du redan har skickat.</p><p>Du kan lämna en fråga obesvarad. Saknad information är aldrig ett automatiskt avslag.</p><Link href="/notifications">Till din aktivitet <UiIcon name="arrow" width="16" /></Link><Link href="/youth/cv">Se ditt CV <UiIcon name="arrow" width="16" /></Link></aside></div>
  </main>;
}

export default function ApplicationsPage() { return <Suspense fallback={<main className="mobile-shell"><p role="status">Hämtar ansökningar…</p></main>}><ApplicationsPageContent/></Suspense>; }
