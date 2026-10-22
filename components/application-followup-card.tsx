"use client";

import { useState } from "react";
import { saveApplicationSupplement, type ApplicationCompletion, type ApplicationFollowup } from "@/lib/application-completions";
import { supplementQuestions, supplementPayload } from "@/lib/application-supplement";
import { UiIcon } from "./ui-icon";

export function ApplicationFollowupCard({ application, items, initiallyOpen, onSaved }: { application:ApplicationCompletion; items:ApplicationFollowup[]; initiallyOpen:boolean; onSaved:(application:ApplicationCompletion, items:ApplicationFollowup[])=>void }) {
  const [answers,setAnswers] = useState<Record<string,string>>({});
  const [skips,setSkips] = useState<string[]>([]), [editing,setEditing] = useState<string[]>([]);
  const [open,setOpen] = useState(initiallyOpen), [busy,setBusy] = useState(false);
  const [error,setError] = useState(""), [message,setMessage] = useState("");
  const questions = supplementQuestions(application,items);
  const pending = questions.filter(item=>item.status === "pending");
  const editable = questions.filter(item=>item.status === "pending" || editing.includes(item.key));
  const panelId = `supplement-${application.job_id}`;
  const save = async () => {
    if(busy) return;
    const payload = supplementPayload(questions,answers,skips,editing);
    if(!Object.keys(payload.answers).length && !Object.keys(payload.followupAnswers).length && !payload.skipIds.length && !payload.followupSkipIds.length) {setError("Svara på en fråga eller välj att avstå.");return;}
    setBusy(true);setError("");setMessage("");
    try {
      const result = await saveApplicationSupplement(application.job_id,payload.answers,payload.skipIds,payload.followupAnswers,payload.followupSkipIds);
      onSaved(result.application,result.followups);
      setAnswers({});setSkips([]);setEditing([]);setMessage("Kompletteringen är skickad. Din ansökan är fortfarande skickad.");
    } catch(reason) {setError(reason instanceof Error ? reason.message : "Kunde inte skicka svaren.");}
    finally {setBusy(false);}
  };
  if(!questions.length || application.status !== "submitted") return null;
  return <section className="application-followups" aria-label="Frivillig komplettering">
    <div className="application-supplement-summary"><span className="application-supplement-icon"><UiIcon name={pending.length ? "edit" : "check"}/></span><div><h3>{pending.length ? `${pending.length} ${pending.length === 1 ? "frivillig fråga" : "frivilliga frågor"}` : "Din komplettering"}</h3><p>Ansökan är redan skickad. {pending.length ? "Du kan svara när det passar dig." : "Här finns dina svar och val."}</p></div><button type="button" className="secondary-btn" aria-expanded={open} aria-controls={panelId} onClick={()=>setOpen(current=>!current)}>{open ? "Dölj" : pending.length ? "Komplettera" : "Visa svar"}</button></div>
    <div id={panelId} hidden={!open} className="application-supplement-body">
      <p className="application-completion-note">Svaren hjälper företaget att förstå din ansökan. De är frivilliga och skickas först när du trycker på Skicka komplettering.</p>
      {questions.map((item,index)=><div className="application-question" key={item.key}>
        {(item.status === "pending" || editing.includes(item.key)) ? <><label htmlFor={`followup-${item.key}`}><strong>{index+1}. {item.question}</strong></label><textarea id={`followup-${item.key}`} className="input-field" rows={3} maxLength={1500} disabled={busy || skips.includes(item.key)} value={answers[item.key] ?? ""} onChange={event=>setAnswers(current=>({...current,[item.key]:event.target.value}))} placeholder="Berätta med dina egna ord…"/>{item.status === "pending" && <label className="application-skip"><input type="checkbox" checked={skips.includes(item.key)} disabled={busy} onChange={event=>setSkips(current=>event.target.checked ? [...current,item.key] : current.filter(key=>key!==item.key))}/>Jag vill avstå från att svara</label>}{editing.includes(item.key) && <button type="button" className="application-answer-edit" disabled={busy} onClick={()=>setEditing(current=>current.filter(key=>key!==item.key))}>Avbryt ändringen</button>}</> : <><strong>{index+1}. {item.question}</strong><p className="application-published-answer">{item.status === "answered" ? item.answer : "Du valde att avstå från att svara"}</p><button type="button" className="application-answer-edit" disabled={busy} onClick={()=>{setAnswers(current=>({...current,[item.key]:item.answer}));setEditing(current=>[...current,item.key]);setMessage("");}}>{item.status === "answered" ? "Ändra mitt svar" : "Lägg till ett svar"}</button></>}
      </div>)}
      {error && <p role="alert" className="application-completion-error">{error}</p>}
      {editable.length>0 && <div className="application-completion-actions"><small>Ansökan är skickad även om du inte svarar.</small><button type="button" className="cta-btn" disabled={busy} onClick={()=>void save()}>{busy ? "Skickar…" : "Skicka komplettering"}</button></div>}
    </div>
    {message && <p role="status">{message}</p>}
  </section>;
}
