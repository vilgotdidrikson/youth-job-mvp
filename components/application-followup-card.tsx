"use client";

import { useEffect, useRef, useState } from "react";
import { type ApplicationCompletion, type ApplicationFollowup } from "@/lib/application-completions";
import { supplementQuestions, supplementPayload } from "@/lib/application-supplement";
import { submitOwnedSupplement, SupplementWriteError, SupplementRequestError, type SupplementReceipt } from "@/lib/owned-application-supplement";
import { supplementQuestionText } from "@/lib/supplement-question-text";
import { canSaveAnswer, savedAnswerSource } from "@/lib/saved-answers";
import { ReportDialog } from "./report-dialog";
import { SavedAnswerChoice, useSavedAnswerSources } from "./saved-answer-choice";
import { UiIcon } from "./ui-icon";

type Props = { manualReadOnly?:boolean; application:ApplicationCompletion; items:ApplicationFollowup[]; initiallyOpen:boolean; onSaved:(application:ApplicationCompletion, items:ApplicationFollowup[])=>void };
export function ApplicationFollowupCard(props: Props) { return <FollowupWorkspace key={`${props.application.youth_user_id}:${props.application.job_id}`} {...props}/>; }
function FollowupWorkspace({ application, items, initiallyOpen, onSaved, manualReadOnly = false }: Props) {
  const [answers,setAnswers] = useState<Record<string,string>>({});
  const [skips,setSkips] = useState<string[]>([]), [editing,setEditing] = useState<string[]>([]);
  const [open,setOpen] = useState(initiallyOpen), [busy,setBusy] = useState(false);
  const [error,setError] = useState(""), [message,setMessage] = useState("");
  const questions = supplementQuestions(application,items);
  const pending = questions.filter(item=>item.status === "pending" && !(manualReadOnly && item.source === "company"));
  const editable = questions.filter(item=>(item.status === "pending" || editing.includes(item.key)) && !(manualReadOnly && item.source === "company"));
  const panelId = `supplement-${application.job_id}`;
  const alive = useRef(false), lock = useRef(false), request = useRef<AbortController | null>(null);
  const receipt = useRef<SupplementReceipt | null>(null);
  const [recovery, setRecovery] = useState(false);
  const saved = useSavedAnswerSources(application.youth_user_id, open && application.status === "submitted" && questions.some(item=>item.status === "answered"));
  useEffect(() => { alive.current = application.status === "submitted"; return () => { alive.current = false; request.current?.abort(); }; }, [application.status]);
  const run = async (write: boolean) => {
    if (lock.current || !alive.current || write && receipt.current) return;
    const payload = supplementPayload(questions.filter(item=>!(manualReadOnly && item.source === "company")),answers,skips,editing);
    if (write && !Object.keys(payload.answers).length && !Object.keys(payload.followupAnswers).length && !payload.skipIds.length && !payload.followupSkipIds.length) {setError("Svara på en fråga eller välj att avstå.");return;}
    lock.current = true; setBusy(true);setError("");setMessage("");
    const controller = new AbortController(); request.current = controller;
    try {
      if (write) {
        try { receipt.current = await submitOwnedSupplement(application.youth_user_id,application.job_id,payload,controller.signal); }
        catch (reason) { if (reason instanceof SupplementWriteError) receipt.current = reason.receipt; throw reason; }
        if (!alive.current || controller.signal.aborted) return;
        setRecovery(true);setMessage("Kompletteringen är sparad. Kontrollerar de sparade svaren…");
      }
      if (!receipt.current) return;
      const result = await receipt.current.read(controller.signal);
      if (!alive.current || controller.signal.aborted) return;
      onSaved(result.application,result.followups);
      receipt.current = null;setRecovery(false);
      if (result.application.status !== "submitted") {setMessage("Ansökan är avslutad eller återkallad.");return;}
      if (result.confirmed) { setAnswers({});setSkips([]);setEditing([]);setMessage("Kompletteringen är skickad. Din ansökan är fortfarande skickad."); }
      else setMessage("Aktuella svar är hämtade. Dina ändringar finns kvar här. Granska svaren innan du väljer att skicka igen.");
    } catch (reason) {
      if (alive.current && !controller.signal.aborted) { setRecovery(!!receipt.current);setError(reason instanceof SupplementWriteError || reason instanceof SupplementRequestError ? reason.message : "Kunde inte kontrollera kompletteringen."); }
    } finally { lock.current = false; if (request.current === controller) request.current = null; if (alive.current) setBusy(false); }
  };
  if(!questions.length || application.status !== "submitted") return null;
  return <section className="application-followups" aria-label="Frivillig komplettering">
    <div className="application-supplement-summary"><span className="application-supplement-icon"><UiIcon name={pending.length ? "edit" : "check"}/></span><div><h3>{pending.length ? `${pending.length} ${pending.length === 1 ? "frivillig fråga" : "frivilliga frågor"}` : "Din komplettering"}</h3><p>Ansökan är redan skickad. {pending.length ? "Du kan svara när det passar dig." : "Här finns dina svar och val."}</p></div><button type="button" className="secondary-btn" aria-expanded={open} aria-controls={panelId} onClick={()=>setOpen(current=>!current)}>{open ? "Dölj" : pending.length ? "Komplettera" : "Visa svar"}</button></div>
    <div id={panelId} hidden={!open} className="application-supplement-body">
      <p className="application-completion-note">Svaren hjälper företaget att förstå din ansökan. De är frivilliga och skickas först när du trycker på Skicka komplettering.</p>
      {questions.map((item,index)=><div className="application-question" key={item.key}>
        {item.source === "company" && <p>Fråga från företaget</p>}
        {((item.status === "pending" || editing.includes(item.key)) && !(manualReadOnly && item.source === "company")) ? <><label htmlFor={`followup-${item.key}`}><strong>{index+1}. {supplementQuestionText(item.question,item.criterionLabel,item.status,item.source)}</strong></label><textarea id={`followup-${item.key}`} className="input-field" rows={3} maxLength={1500} disabled={busy || recovery || skips.includes(item.key)} value={answers[item.key] ?? ""} onChange={event=>setAnswers(current=>({...current,[item.key]:event.target.value}))} placeholder="Berätta med dina egna ord…"/>{item.status === "pending" && <label className="application-skip"><input type="checkbox" checked={skips.includes(item.key)} disabled={busy || recovery} onChange={event=>setSkips(current=>event.target.checked ? [...current,item.key] : current.filter(key=>key!==item.key))}/>Jag vill avstå från att svara</label>}{editing.includes(item.key) && <button type="button" className="application-answer-edit" disabled={busy || recovery} onClick={()=>setEditing(current=>current.filter(key=>key!==item.key))}>Avbryt ändringen</button>}</> : <><strong>{index+1}. {supplementQuestionText(item.question,item.criterionLabel,item.status,item.source)}</strong><p className="application-published-answer">{item.status === "answered" ? item.answer : item.status === "pending" ? "Ansökan är avslutad. Frågan kan inte längre besvaras." : "Du valde att avstå från att svara"}</p>{!(manualReadOnly && item.source === "company") && <button type="button" className="application-answer-edit" disabled={busy || recovery} onClick={()=>{setAnswers(current=>({...current,[item.key]:item.answer}));setEditing(current=>[...current,item.key]);setMessage("");}}>{item.status === "answered" ? "Ändra mitt svar" : "Lägg till ett svar"}</button>}{item.status === "answered" && saved && canSaveAnswer(item.question,item.criterionLabel) && (source=><SavedAnswerChoice key={`${source}:${item.answer}`} ownerId={application.youth_user_id} source={source} question={supplementQuestionText(item.question,item.criterionLabel,item.status,item.source)} answer={item.answer} initial={saved.sources.includes(source) ? "saved" : saved.declined.includes(source) ? "declined" : "ask"}/>)(savedAnswerSource(application.job_id,item.key))}</>}
        {item.source === "company" && <ReportDialog targetType="application_question" targetId={item.id} label="Rapportera frågan" />}
      </div>)}
      {recovery && <button type="button" className="secondary-btn" disabled={busy} onClick={()=>void run(false)}>Kontrollera sparningen</button>}
      {error && <p role="alert" className="application-completion-error">{error}</p>}
      {editable.length>0 && <div className="application-completion-actions"><small>Ansökan är skickad även om du inte svarar.</small><button type="button" className="cta-btn" disabled={busy || recovery} onClick={()=>void run(true)}>{busy ? "Skickar…" : "Skicka komplettering"}</button></div>}
    </div>
    {message && <p role="status">{message}</p>}
  </section>;
}
