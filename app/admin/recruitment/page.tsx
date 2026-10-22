"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { AdminShell } from "@/components/admin/admin-shell";
import { AuthGateMessage } from "@/components/auth-gate-message";
import { useAdminAccess } from "@/hooks/use-admin-access";
import { getRecruitmentRecords, recruitmentAction } from "@/lib/recruitment";
import { needsRecruitmentReview, type RecruitmentRecord } from "@/lib/recruitment-types";
import styles from "@/components/recruitment.module.css";

const responseLabels = { pending: "Inväntar ungdomens granskning", approved: "Godkänd av båda", disputed: "Uppgifterna behöver rättas" };
const reviewLabels = { open: "Öppet", reviewing: "Under granskning", resolved: "Löst", dismissed: "Avfärdat" };
function ReviewCard({ item, refresh }: { item: RecruitmentRecord; refresh: () => Promise<void> }) {
  const [state, setState] = useState(item.review_state ?? "open"), [notes, setNotes] = useState(item.admin_notes ?? "");
  const [restriction, setRestriction] = useState(item.restriction), [reason, setReason] = useState(item.restriction_reason ?? ""), [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false), [error, setError] = useState(""), [notice, setNotice] = useState("");
  const save = async (action: "review" | "restrict") => {
    if (busy) return; setBusy(true); setError(""); setNotice("");
    try {
      await recruitmentAction(action, action === "review" ? item.match_id : null, action === "review" ? { state, notes } : { company_user_id: item.company_user_id, restriction, reason, review_confirmed: confirmed });
      await refresh(); setNotice(action === "review" ? "Granskningen är sparad." : "Företagets behörighet har uppdaterats.");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Kunde inte spara."); }
    finally { setBusy(false); }
  };
  return <article className={styles.adminCard}><h2>{item.company_name} · {item.youth_name}</h2><p>{item.job_title} · {item.match_status === "hired" ? "Markerad som anställd" : "Rekrytering pågår"}</p>
    <p>{item.employment ? `${item.employment.role_name} · Startdatum ${item.employment.start_date}\n${responseLabels[item.employment.response]}` : "Ingen anställning registrerad med befattning och startdatum."}</p>
    {item.requested_at && <p>Påminnelse begärd: {new Date(item.requested_at).toLocaleDateString("sv-SE")}</p>}
    {item.escalated_at && <p>Behöver uppföljning sedan {new Date(item.escalated_at).toLocaleDateString("sv-SE")}</p>}
    {item.report_details && <p><strong>Ungdomens uppgifter</strong><br/>{item.report_details}</p>}
    <p>Betalning: {item.employment?.paid_at ? "Registrerad som betald" : "Inte registrerad; betalningsintegrationen är ännu inte aktiverad"}. Företagsrabatten är avstängd.</p>
    <Link href={`/jobb/${item.job_id}`}>Visa annons →</Link>
    <label>Ärendestatus<select value={state} onChange={event => setState(event.target.value as typeof state)}>{Object.entries(reviewLabels).map(([key,label]) => <option key={key} value={key}>{label}</option>)}</select></label>
    <label>Interna anteckningar<textarea rows={3} maxLength={3000} value={notes} onChange={event => setNotes(event.target.value)}/></label><button type="button" className="secondary-btn" disabled={busy} onClick={() => void save("review")}>Spara granskning</button>
    <details><summary>Företagets rekryteringsbehörighet</summary><p>En rapport är inte bevis för kringgående. Kontakta företaget, ge möjlighet att bemöta uppgifterna och dokumentera uppföljningen innan du begränsar kontot.</p>
      <label>Behörighet<select value={restriction} onChange={event => setRestriction(event.target.value as typeof restriction)}><option value="none">Tillåt nya rekryteringar</option><option value="limited">Pausa nya annonser och kandidatkontakter</option><option value="suspended">Stäng av nya rekryteringar vid upprepade fall</option></select></label>
      <label>Skäl som visas för företaget<textarea rows={3} maxLength={2000} value={reason} onChange={event => setReason(event.target.value)}/></label>
      <label><input type="checkbox" checked={confirmed} onChange={event => setConfirmed(event.target.checked)}/> Jag har följt upp ärendet och gett företaget möjlighet att bemöta uppgifterna.</label>
      <button type="button" className="secondary-btn" disabled={busy || !confirmed || reason.trim().length < 10} onClick={() => void save("restrict")}>Spara behörighet</button>
    </details>{error && <p role="alert" className={styles.error}>{error}</p>}{notice && <p role="status">{notice}</p>}
  </article>;
}

export default function RecruitmentAdminPage() {
  const { user, status, error: sessionError, adminReady, isAdmin } = useAdminAccess();
  const [items, setItems] = useState<RecruitmentRecord[]>([]), [error, setError] = useState(""), [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"review" | "waiting" | "all">("review");
  const refresh = useCallback(async () => { const data = await getRecruitmentRecords(); setItems(data); setError(""); }, []);
  useEffect(() => {
    if (!adminReady || !isAdmin) return;
    let active = true;
    void getRecruitmentRecords().then(data => { if (active) { setItems(data); setError(""); } }).catch(reason => { if (active) setError(reason instanceof Error ? reason.message : "Kunde inte läsa rekryteringar."); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [adminReady, isAdmin, refresh]);
  if (!adminReady) return <AuthGateMessage status={status === "ready" ? "checking" : status} error={sessionError}/>;
  if (!isAdmin) return <main className="mobile-shell"><p>Ingen administratörsåtkomst.</p></main>;
  const visible = items.filter(item => filter === "all" || (filter === "review" ? needsRecruitmentReview(item) || item.restriction !== "none" : !["resolved","dismissed"].includes(item.review_state ?? "") && (item.employment?.response === "pending" || item.requested_at || item.reminder_sent_at)));
  return <AdminShell title="Rekryteringsuppföljning" email={user?.email}><p>Granska uteblivna registreringar och motstridiga uppgifter. Inga fakturor eller begränsningar skapas automatiskt från en ungdoms rapport.</p>
    <div className={styles.filters}>{([["review","Behöver följas upp"],["waiting","Inväntar svar"],["all","Alla rekryteringar"]] as const).map(([key,label]) => <button type="button" className="secondary-btn" aria-pressed={filter === key} key={key} onClick={() => setFilter(key)}>{label}</button>)}<button className="secondary-btn" type="button" onClick={() => void refresh().catch(reason => setError(reason instanceof Error ? reason.message : "Kunde inte uppdatera."))}>Uppdatera</button></div>
    {error && <p role="alert" className={styles.error}>{error}</p>}{loading ? <p role="status">Hämtar rekryteringar…</p> : <div className={styles.adminList}>{visible.map(item => <ReviewCard key={`${item.match_id}:${item.restriction}:${item.review_state}`} item={item} refresh={refresh}/>)}{!visible.length && <section className={styles.adminCard}>Inga ärenden i den här vyn.</section>}</div>}
  </AdminShell>;
}
