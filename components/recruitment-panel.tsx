"use client";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { ModalDialog } from "@/components/modal-dialog";
import { getRecruitmentRecords, recruitmentAction, RecruitmentConflictError } from "@/lib/recruitment";
import { employmentPresentation, employmentSnapshot, experiencePeriod, type RecruitmentRecord } from "@/lib/recruitment-types";
import { subscribeVisibleRefresh } from "@/lib/visible-refresh";
import { CURRENT_COMPANY_OFFER } from "@/lib/current-offer";
import styles from "./recruitment.module.css";

function EmploymentForm({ item, company, onClose, onSaved }: { item: RecruitmentRecord; company: boolean; onClose: () => void; onSaved: () => Promise<void> }) {
  const [role, setRole] = useState(item.employment?.role_name ?? item.job_title);
  const [start, setStart] = useState(item.employment?.start_date ?? "");
  const [show, setShow] = useState(item.employment?.show_on_profile ?? false);
  const [cv, setCv] = useState(item.employment?.include_in_cv ?? false);
  const [expected] = useState(() => employmentSnapshot(item.employment));
  const [busy, setBusy] = useState(false), [error, setError] = useState("");
  const [reload, setReload] = useState(false);
  const lock = useRef(false);
  const approved = expected?.response === "approved";
  const reloadLatest = async () => {
    if (lock.current) return;
    lock.current = true; setBusy(true); setError("");
    try { await onSaved(); onClose(); }
    catch { setError("Kunde inte hämta senaste uppgifterna. Försök igen."); }
    finally { lock.current = false; setBusy(false); }
  };
  const submit = async (event: FormEvent, response = "approved") => {
    event.preventDefault(); if (lock.current || reload) return;
    lock.current = true; setBusy(true); setError("");
    let saved = false;
    try {
      await recruitmentAction(company ? "register" : "respond", item.match_id, {
        expected_employment: expected,
        ...(company ? { role_name: role.trim(), start_date: start } : { response, show_on_profile: show, include_in_cv: cv }),
      });
      saved = true;
      await onSaved(); onClose();
    } catch (reason) {
      if (saved) { setReload(true); setError("Uppgifterna är sparade, men den senaste statusen kunde inte hämtas. Hämta uppgifterna igen."); }
      else { setReload(reason instanceof RecruitmentConflictError); setError(reason instanceof Error ? reason.message : "Kunde inte spara."); }
    } finally { lock.current = false; setBusy(false); }
  };
  return <ModalDialog label={company ? "Registrera anställning" : approved ? "Synlighet och CV" : "Granska anställning"} onClose={onClose} busy={busy} className={styles.dialog}><form onSubmit={submit}>
    <h2>{company ? `${expected ? "Rätta anställningsuppgifter" : "Registrera anställning"} för ${item.youth_name}` : approved ? "Synlighet och CV" : "Granska din anställning"}</h2>
    {company ? <><p>Registrera bara en anställning ni har kommit överens om. Kandidaten får granska befattning och startdatum. Ändrade uppgifter behöver godkännas igen. Chatten finns kvar.</p><p>{CURRENT_COMPANY_OFFER.registration}</p><label>Befattning<input required maxLength={120} disabled={reload} value={role} onChange={event => setRole(event.target.value)}/></label><label>Startdatum<input required type="date" min="2000-01-01" disabled={reload} value={start} onChange={event => setStart(event.target.value)}/></label></> : <>
      <p><strong>{expected?.role_name} · {item.employment?.company_name}</strong><br/>Startdatum: {expected?.start_date}</p><p>{approved ? "Anställningen är redan bekräftad. Här väljer du var erfarenheten visas." : "Arbetsgivaren har registrerat uppgifterna. Godkänn bara om de stämmer. Du kan be om en rättelse utan att godkänna dem."}</p>
      <label className={styles.checkbox}><input type="checkbox" disabled={reload} checked={show} onChange={event => setShow(event.target.checked)}/>Visa erfarenheten och bocken ”Jobb via MatchnWork” på min profil</label>
      <label className={styles.checkbox}><input type="checkbox" disabled={reload} checked={cv} onChange={event => setCv(event.target.checked)}/>Ta med erfarenheten i mitt MatchnWork-CV och nästa PDF</label><p>Valen är frivilliga. Du kan godkänna anställningen utan att visa erfarenheten. En redan nedladdad eller uppladdad PDF ändras inte.</p>
    </>}
    {error && <p role="alert" className={styles.error}>{error}</p>}<div className={styles.actions}>
      {reload ? <button type="button" className="cta-btn" disabled={busy} onClick={() => void reloadLatest()}>{busy ? "Hämtar…" : "Hämta senaste uppgifter"}</button> : <>
        <button type="submit" className="cta-btn" disabled={busy || (company && (!role.trim() || !start))}>{busy ? "Sparar…" : company ? expected ? "Skicka rättelse" : "Registrera anställning" : approved ? "Spara synlighet och CV" : "Uppgifterna stämmer"}</button>
        {!company && <button type="button" className="secondary-btn" disabled={busy} onClick={event => void submit(event, "disputed")}>{approved ? "Begär rättelse av anställningen" : "Uppgifterna behöver rättas"}</button>}
      </>}
      <button type="button" className="secondary-btn" disabled={busy} onClick={onClose}>Avbryt</button>
    </div>
  </form></ModalDialog>;
}

export function RecruitmentPanel({ matchId, jobId, company = false, compact = false, onChanged }: { matchId?: string; jobId?: string; company?: boolean; compact?: boolean; onChanged?: () => void }) {
  return <RecruitmentPanelContent key={`${company}:${matchId ?? ""}:${jobId ?? ""}`} matchId={matchId} jobId={jobId} company={company} compact={compact} onChanged={onChanged} />;
}

function RecruitmentPanelContent({ matchId, jobId, company = false, compact = false, onChanged }: { matchId?: string; jobId?: string; company?: boolean; compact?: boolean; onChanged?: () => void }) {
  const [item, setItem] = useState<RecruitmentRecord | null>(null), [error, setError] = useState(""), [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(true), [busy, setBusy] = useState(false), [edit, setEdit] = useState(false), [report, setReport] = useState(false), [details, setDetails] = useState("");
  const [expanded, setExpanded] = useState(false);
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
  const presentation = employmentPresentation(employment, company);
  const eligible = ["matched", "in_contact", "interview", "hired"].includes(item.match_status);
  const requestedRecently = Boolean(item.requested_at && new Date(item.requested_at).getTime() > Date.now() - 7 * 86400000);
  const attention = employment?.response === "disputed" || (!company && employment?.response === "pending");
  const panelId = `recruitment-${item.match_id}`;
  return <section className={`${styles.panel} ${compact ? styles.compact : ""}`} aria-label="Rekryteringsavslut">
    {compact && <div className={styles.compactHeader}><div><strong>{employment ? presentation.title : "Rekrytering"}</strong>{employment && <span>{employment.role_name}</span>}</div>{attention && <button type="button" className="secondary-btn" onClick={() => setEdit(true)}>{company ? "Rätta uppgifter" : "Granska"}</button>}{company && eligible && !employment && <button type="button" className="secondary-btn" onClick={() => setEdit(true)}>Registrera anställning</button>}<button type="button" className={styles.textButton} aria-expanded={expanded} aria-controls={panelId} onClick={() => setExpanded(current => !current)}>{expanded ? "Dölj detaljer" : "Visa alternativ"}</button></div>}
    <div id={panelId} hidden={compact && !expanded} className={compact ? styles.compactBody : undefined}><h3>{presentation.title}</h3>
    {employment && <p>{employment.role_name} · {employment.company_name}<br/>{experiencePeriod(employment.start_date)}</p>}
    <p>{presentation.description}</p>
    {eligible && <div className={styles.actions}>{company ? <>
      {employment?.response !== "approved" && <button type="button" className="secondary-btn" onClick={() => setEdit(true)}>{presentation.action}</button>}
      {!employment && (item.requested_at || item.reminder_sent_at) && item.review_state !== "resolved" && <><button type="button" className="secondary-btn" disabled={busy} onClick={() => void action("company_reply", { reply: "ongoing" })}>Rekryteringen pågår</button><button type="button" className="secondary-btn" disabled={busy} onClick={() => void action("company_reply", { reply: "no_hire" })}>Ingen anställning avtalad</button></>}
    </> : employment ? <button type="button" className="secondary-btn" onClick={() => setEdit(true)}>{employment.response === "approved" ? "Ändra synlighet och CV" : "Granska uppgifterna"}</button> : <>
      <button type="button" className="secondary-btn" disabled={busy || requestedRecently} onClick={() => void action("request")}>{requestedRecently ? "Påminnelse skickad" : "Be arbetsgivaren registrera anställningen"}</button>
      {item.reported_at && !["resolved", "dismissed"].includes(item.review_state ?? "") ? <p>Admin har fått ditt ärende.</p> : <button type="button" className={styles.textButton} onClick={() => setReport(true)}>Jag har börjat arbeta, men anställningen är inte registrerad</button>}
    </>}</div>}
  </div>{notice && <p role="status" className={styles.notice}>{notice}</p>}{error && <p role="alert" className={styles.error}>{error}</p>}
    {edit && <EmploymentForm key={item.match_id} item={item} company={company} onClose={() => setEdit(false)} onSaved={async () => { await load(); onChanged?.(); }}/>}
    {report && <ModalDialog label="Kontakta admin om anställningen" onClose={() => setReport(false)} busy={busy} className={styles.dialog}><h2>Anställningen är inte registrerad</h2><p>Beskriv när du började och vad ni kommit överens om. Ärendet är privat för dig och admin. Ingen avgift eller begränsning skapas automatiskt.</p><label>Vad har hänt?<textarea rows={4} maxLength={2000} value={details} onChange={event => setDetails(event.target.value)}/></label>{error && <p role="alert" className={styles.error}>{error}</p>}<div className={styles.actions}><button type="button" className="cta-btn" disabled={busy || details.trim().length < 10} onClick={() => void action("report", { details })}>{busy ? "Skickar…" : "Skicka till admin"}</button><button type="button" className="secondary-btn" disabled={busy} onClick={() => setReport(false)}>Avbryt</button></div></ModalDialog>}
  </section>;
}
