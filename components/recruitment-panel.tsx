"use client";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { ModalDialog } from "@/components/modal-dialog";
import { getRecruitmentRecords, recruitmentAction } from "@/lib/recruitment";
import { experiencePeriod, type RecruitmentRecord } from "@/lib/recruitment-types";
import { subscribeVisibleRefresh } from "@/lib/visible-refresh";
import styles from "./recruitment.module.css";

function EmploymentForm({ item, company, onClose, onSaved }: { item: RecruitmentRecord; company: boolean; onClose: () => void; onSaved: () => Promise<void> }) {
  const [role, setRole] = useState(item.employment?.role_name ?? item.job_title);
  const [start, setStart] = useState(item.employment?.start_date ?? "");
  const [show, setShow] = useState(item.employment?.show_on_profile ?? false);
  const [cv, setCv] = useState(item.employment?.include_in_cv ?? false);
  const [busy, setBusy] = useState(false), [error, setError] = useState("");
  const submit = async (event: FormEvent, response = "approved") => {
    event.preventDefault(); if (busy) return;
    setBusy(true); setError("");
    try {
      await recruitmentAction(company ? "register" : "respond", item.match_id, company ? { role_name: role, start_date: start } : { response, show_on_profile: show, include_in_cv: cv });
      await onSaved(); onClose();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Kunde inte spara."); }
    finally { setBusy(false); }
  };
  return <ModalDialog label={company ? "Registrera anställning" : "Granska anställning"} onClose={onClose} busy={busy} className={styles.dialog}><form onSubmit={submit}>
    <h2>{company ? `Registrera anställning för ${item.youth_name}` : "Granska din anställning"}</h2>
    {company ? <><p>Registrera bara en anställning ni har kommit överens om. Kandidaten får granska uppgifterna. Chatten finns kvar.</p><label>Befattning<input required maxLength={120} value={role} onChange={event => setRole(event.target.value)}/></label><label>Startdatum<input required type="date" min="2000-01-01" value={start} onChange={event => setStart(event.target.value)}/></label></> : <>
      <p><strong>{item.employment?.role_name} · {item.employment?.company_name}</strong><br/>Startdatum: {item.employment?.start_date}</p><p>Arbetsgivaren har bekräftat anställningen. Godkänn bara om uppgifterna stämmer.</p>
      <label className={styles.checkbox}><input type="checkbox" checked={show} onChange={event => setShow(event.target.checked)}/>Visa erfarenheten och bocken ”Jobb via MatchnWork” på min profil</label>
      <label className={styles.checkbox}><input type="checkbox" checked={cv} onChange={event => setCv(event.target.checked)}/>Ta med erfarenheten i mitt MatchnWork-CV och nästa PDF</label><p>Du kan ändra synligheten senare. En redan nedladdad eller uppladdad PDF ändras inte.</p>
    </>}
    {error && <p role="alert" className={styles.error}>{error}</p>}<div className={styles.actions}><button type="submit" className="cta-btn" disabled={busy}>{busy ? "Sparar…" : company ? "Registrera anställning" : "Uppgifterna stämmer"}</button>{!company && <button type="button" className="secondary-btn" disabled={busy} onClick={event => void submit(event, "disputed")}>Uppgifterna behöver rättas</button>}<button type="button" className="secondary-btn" disabled={busy} onClick={onClose}>Avbryt</button></div>
  </form></ModalDialog>;
}

export function RecruitmentPanel({ matchId, jobId, company = false, onChanged }: { matchId?: string; jobId?: string; company?: boolean; onChanged?: () => void }) {
  const [item, setItem] = useState<RecruitmentRecord | null>(null), [error, setError] = useState(""), [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(true), [busy, setBusy] = useState(false), [edit, setEdit] = useState(false), [report, setReport] = useState(false), [details, setDetails] = useState("");
  const load = useCallback(async () => {
    const items = await getRecruitmentRecords();
    setItem(items.find(entry => matchId ? entry.match_id === matchId : entry.job_id === jobId) ?? null); setError("");
  }, [matchId, jobId]);
  useEffect(() => {
    let active = true;
    const refresh = async () => {
      try { const items = await getRecruitmentRecords(); if (active) { setItem(items.find(entry => matchId ? entry.match_id === matchId : entry.job_id === jobId) ?? null); setError(""); } }
      catch (reason) { if (active) setError(reason instanceof Error ? reason.message : "Kunde inte läsa rekryteringsstatus."); }
      finally { if (active) setLoading(false); }
    };
    void refresh(); const unsubscribe = subscribeVisibleRefresh(refresh);
    window.addEventListener("mnw-recruitment-refresh", refresh);
    return () => { active = false; unsubscribe(); window.removeEventListener("mnw-recruitment-refresh", refresh); };
  }, [matchId, jobId]);
  const action = async (name: string, payload: Record<string, unknown> = {}) => {
    if (!item || busy) return; setBusy(true); setError(""); setNotice("");
    try { await recruitmentAction(name, item.match_id, payload); await load(); onChanged?.(); setNotice(name === "report" ? "Admin har fått ditt ärende. Det verifierar inte anställningen automatiskt." : name === "request" ? "Påminnelsen är skickad till arbetsgivaren." : "Svaret är sparat."); setReport(false); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Kunde inte spara."); }
    finally { setBusy(false); }
  };
  if (loading) return <p className={styles.loading} role="status">Hämtar rekryteringsstatus…</p>;
  if (!item) return error ? <p className={styles.error} role="alert">{error}</p> : null;
  const employment = item.employment;
  const eligible = ["matched", "in_contact", "interview", "hired"].includes(item.match_status);
  const requestedRecently = Boolean(item.requested_at && new Date(item.requested_at).getTime() > Date.now() - 7 * 86400000);
  return <section className={styles.panel} aria-label="Rekryteringsavslut"><div><h3>{employment ? employment.response === "approved" ? "Anställning bekräftad" : employment.response === "disputed" ? "Uppgifterna behöver rättas" : "Anställning registrerad" : "Har rekryteringen lett till ett jobb?"}</h3>
    {employment ? <><p>{employment.role_name} · {employment.company_name}<br/>{experiencePeriod(employment.start_date)}</p><p>{employment.response === "approved" ? "Arbetsgivaren och ungdomen har godkänt uppgifterna." : employment.response === "disputed" ? "Kontrollera befattning och startdatum tillsammans. Admin kan följa upp ärendet." : company ? "Kandidaten behöver granska uppgifterna innan erfarenheten kan visas på profilen och i CV:t." : "Granska arbetsgivarens uppgifter och välj om erfarenheten ska visas på din profil och i ditt CV."}</p></> : <p>{company ? "Registrera anställningen när ni har kommit överens. Kandidaten får en verifierad erfarenhet att använda i sitt CV." : "Be arbetsgivaren registrera anställningen. När du godkänt uppgifterna kan du visa en bock på profilen och ta med erfarenheten i CV:t."}</p>}
    {eligible && <div className={styles.actions}>{company ? <>
      {employment?.response !== "approved" && <button type="button" className="secondary-btn" onClick={() => setEdit(true)}>{employment ? "Rätta anställningsuppgifter" : "Markera som anställd"}</button>}
      {!employment && (item.requested_at || item.reminder_sent_at) && item.review_state !== "resolved" && <><button type="button" className="secondary-btn" disabled={busy} onClick={() => void action("company_reply", { reply: "ongoing" })}>Rekryteringen pågår</button><button type="button" className="secondary-btn" disabled={busy} onClick={() => void action("company_reply", { reply: "no_hire" })}>Ingen anställning avtalad</button></>}
    </> : employment ? <button type="button" className="secondary-btn" onClick={() => setEdit(true)}>{employment.response === "approved" ? "Ändra synlighet och CV" : "Granska uppgifterna"}</button> : <>
      <button type="button" className="secondary-btn" disabled={busy || requestedRecently} onClick={() => void action("request")}>{requestedRecently ? "Påminnelse skickad" : "Be arbetsgivaren registrera anställningen"}</button>
      {item.reported_at && !["resolved", "dismissed"].includes(item.review_state ?? "") ? <p>Admin har fått ditt ärende.</p> : <button type="button" className={styles.textButton} onClick={() => setReport(true)}>Jag har börjat arbeta, men anställningen är inte registrerad</button>}
    </>}</div>}
  </div>{notice && <p role="status" className={styles.notice}>{notice}</p>}{error && <p role="alert" className={styles.error}>{error}</p>}
    {edit && <EmploymentForm key={employment?.registered_at ?? item.match_id} item={item} company={company} onClose={() => setEdit(false)} onSaved={async () => { await load(); onChanged?.(); }}/>} 
    {report && <ModalDialog label="Kontakta admin om anställningen" onClose={() => setReport(false)} busy={busy} className={styles.dialog}><h2>Anställningen är inte registrerad</h2><p>Beskriv när du började och vad ni kommit överens om. Ärendet är privat för dig och admin. Ingen avgift eller begränsning skapas automatiskt.</p><label>Vad har hänt?<textarea rows={4} maxLength={2000} value={details} onChange={event => setDetails(event.target.value)}/></label>{error && <p role="alert" className={styles.error}>{error}</p>}<div className={styles.actions}><button type="button" className="cta-btn" disabled={busy || details.trim().length < 10} onClick={() => void action("report", { details })}>{busy ? "Skickar…" : "Skicka till admin"}</button><button type="button" className="secondary-btn" disabled={busy} onClick={() => setReport(false)}>Avbryt</button></div></ModalDialog>}
  </section>;
}
