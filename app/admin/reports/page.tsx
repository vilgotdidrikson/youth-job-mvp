"use client";

import { useEffect, useRef, useState } from "react";
import { AdminShell } from "@/components/admin/admin-shell";
import { AuthGateMessage } from "@/components/auth-gate-message";
import { useAdminAccess } from "@/hooks/use-admin-access";
import { VideoPlayer } from "@/components/video-player";
import { createLatestRead, type ReadState } from "@/lib/latest-read";
import { getModerationCasework, reviewModerationCase, type ModerationCase, type ModerationStatus } from "@/lib/reports";
import styles from "./reports.module.css";

const reasonLabels = { scam: "Misstänkt bedrägeri", harassment: "Trakasserier eller hot", discrimination: "Diskriminering", inappropriate: "Olämpligt innehåll", privacy: "Personuppgifter eller integritet", other: "Annat" };
const statusLabels = { open: "Ny", reviewing: "Granskas", resolved: "Åtgärdad", dismissed: "Avslutad" };
const targetLabels = { job: "Jobbannons", conversation: "Konversation", message: "Meddelande", user: "Användare", application_question: "Kompletteringsfråga" };

export default function ModerationReportsPage() {
  const access = useAdminAccess();
  if (access.status !== "ready" || !access.adminReady) return <AuthGateMessage status={access.status === "ready" ? "checking" : access.status} error={access.error} />;
  if (access.adminError) return <main className="mobile-shell"><p role="alert">{access.adminError}</p><button type="button" className="secondary-btn" onClick={access.retryAdmin}>Försök igen</button></main>;
  if (!access.isAdmin || !access.user) return <main className="mobile-shell"><h1>Ingen administratörsåtkomst</h1><p>Kontot finns inte i MatchnWorks adminlista.</p></main>;
  return <Casework key={access.user.id} email={access.user.email} />;
}

function Casework({ email }: {email?: string | null}) {
  const [state, setState] = useState<ReadState<ModerationCase[]>>({status: "loading"});
  const [filter, setFilter] = useState<"active" | "all" | "closed">("active");
  const [decision, setDecision] = useState<{report: ModerationCase; status: Exclude<ModerationStatus, "open">} | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const reader = useRef<ReturnType<typeof createLatestRead<ModerationCase[]>> | null>(null);
  const lock = useRef(false);
  const active = useRef(true);
  useEffect(() => {
    active.current = true;
    const current = createLatestRead<ModerationCase[]>({ read: (_, signal) => getModerationCasework(signal), update: setState,
      errorMessage: "Anmälningarna kunde inte hämtas. Försök igen." });
    reader.current = current; void current.load();
    return () => { active.current = false; current.stop(); reader.current = null; };
  }, []);
  async function saveDecision() {
    if (!decision || lock.current || !active.current || state.status !== "ready" || !state.value.some(r => r.id === decision.report.id && r.status === decision.report.status)) return;
    lock.current = true; setBusy(true); setError(""); setMessage("");
    try {
      await reviewModerationCase(decision.report, decision.status, note);
      if (!active.current) return;
      setDecision(null); setNote(""); setMessage("Beslutet är sparat."); await reader.current?.load();
    } catch (reason) {
      if (active.current) { setError(reason instanceof Error ? reason.message : "Beslutet kunde inte sparas."); await reader.current?.load(); }
    } finally { lock.current = false; if (active.current) setBusy(false); }
  }
  const reports = state.status === "ready" ? state.value : [];
  const shown = reports.filter(r => filter === "all" || (filter === "active") === ["open", "reviewing"].includes(r.status));
  const decisionCurrent = state.status === "ready" && !!decision && reports.some(r => r.id === decision.report.id && r.status === decision.report.status);
  return <AdminShell title="Anmälningar" eyebrow="Moderering" email={email}>
    <div className={styles.toolbar}><label>Visa <select value={filter} onChange={e => setFilter(e.target.value as typeof filter)}><option value="active">Aktiva ärenden</option><option value="closed">Avslutade ärenden</option><option value="all">Alla ärenden</option></select></label><button type="button" className="secondary-btn" disabled={busy || state.status === "loading"} onClick={() => void reader.current?.load()}>Uppdatera</button></div>
    {message && <p role="status">{message}</p>}{error && <p className="admin-alert admin-alert-error" role="alert">{error}</p>}
    {decision && <form className={styles.decision} aria-label="Beslut i anmälningsärende" onSubmit={event => { event.preventDefault(); void saveDecision(); }}>
      <h2>{statusLabels[decision.status]} · {decision.report.target_summary}</h2>
      <p>Ärende {decision.report.id.slice(0,8)}</p>
      {state.status === "ready" && !decisionCurrent && <p role="alert">Ärendet har ändrats. Avbryt och öppna det aktuella ärendet i listan.</p>}
      <label htmlFor="resolution-note">Beslutsanteckning (valfritt)</label><textarea id="resolution-note" autoFocus className="input-field" rows={3} maxLength={2000} value={note} disabled={busy} onChange={e => setNote(e.target.value)} />
      <p>Anteckningen sparas för administratörer. Anmälaren får en generell notis när ärendet avslutas.</p>
      <div className={styles.actions}><button type="button" className="secondary-btn" disabled={busy} onClick={() => { if (lock.current) return; setDecision(null); setNote(""); setError(""); }}>Avbryt</button><button type="submit" className="cta-btn" disabled={busy || !decisionCurrent}>{busy ? "Sparar…" : "Spara beslut"}</button></div>
    </form>}
    {state.status === "loading" ? <p role="status">Hämtar anmälningar…</p> : state.status === "error" ? <section className="admin-empty"><p role="alert">{state.message}</p><button type="button" className="secondary-btn" disabled={busy} onClick={() => void reader.current?.load()}>Försök igen</button></section> : !shown.length ? <section className="admin-empty"><h2>Inga ärenden i den här vyn</h2></section> : <div className="admin-verification-list">{shown.map(report => <article key={report.id} className="admin-verification-card">
      <header className={styles.heading}><div><h2>{report.target_summary}</h2><p>{targetLabels[report.target_type]} · {reasonLabels[report.reason]}</p></div><span className="admin-status">{statusLabels[report.status]}</span></header>
      <p className={styles.meta}>Inskickad <time dateTime={report.created_at}>{new Date(report.created_at).toLocaleString("sv-SE")}</time> · Ärende {report.id.slice(0,8)}</p>
      {report.details && <p className={styles.text}>{report.details}</p>}
      <details className={styles.evidence}><summary>Sparat underlag</summary><Evidence report={report} /></details>
      {report.reviewed_at && <section className={styles.outcome}><h3>Sparat beslut</h3><p><time dateTime={report.reviewed_at}>{new Date(report.reviewed_at).toLocaleString("sv-SE")}</time>{report.reviewed_by_user_id && ` · Handläggare ${report.reviewed_by_user_id.slice(0,8)}`}</p><p className={styles.text}>{report.resolution_note || "Ingen beslutsanteckning."}</p></section>}
      {["open","reviewing"].includes(report.status) && <div className={styles.actions}>{(report.status === "open" ? ["reviewing","resolved","dismissed"] as const : ["resolved","dismissed"] as const).map(status => <button key={status} type="button" className={status === "resolved" ? "cta-btn" : "secondary-btn"} disabled={busy} onClick={() => { if (lock.current) return; setDecision({report,status}); setNote(""); setError(""); setMessage(""); }}>{status === "reviewing" ? "Påbörja granskning" : status === "resolved" ? "Markera åtgärdad" : "Avsluta utan åtgärd"}</button>)}</div>}
    </article>)}</div>}
  </AdminShell>;
}

function Evidence({report}: {report: ModerationCase}) {
  const snapshot = report.target_snapshot;
  if (!snapshot) return <p>Inget sparat underlag finns.</p>;
  const messages = report.target_type === "conversation" && Array.isArray(snapshot.messages) ? snapshot.messages : [];
  const videos = new Set([...(typeof snapshot.video_id === "string" ? [snapshot.video_id] : []),...(Array.isArray(snapshot.video_ids) ? snapshot.video_ids.filter((id): id is string => typeof id === "string") : [])]);
  return <div className={styles.evidenceBody}>
    {report.target_type === "job" && <><h3>{String(snapshot.title ?? "Jobbannons")}</h3><p className={styles.text}>{String(snapshot.description ?? "")}</p></>}
    {report.target_type === "message" && <p className={styles.text}>{String(snapshot.message_text ?? "")}</p>}
    {report.target_type === "application_question" && <p className={styles.text}>{String(snapshot.question ?? "")}</p>}
    {report.target_type === "user" && <p>{String(snapshot.display_name ?? "Namn saknas")}</p>}
    {messages.map((m, index) => <p className={styles.text} key={index}>{typeof m.sender_user_id === "string" && <strong>{m.sender_user_id.slice(0,8)}: </strong>}{String(m.message_text ?? "")}</p>)}
    {[...videos].map(id => <VideoPlayer key={id} videoId={id} label="Anmäld video" />)}
    {!!videos.size && <p>Utgångna eller borttagna videor kan inte spelas upp här.</p>}
  </div>;
}
