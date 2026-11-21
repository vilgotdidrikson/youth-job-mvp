"use client";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { AdminShell } from "@/components/admin/admin-shell";
import { AuthGateMessage } from "@/components/auth-gate-message";
import { PasswordInput } from "@/components/password-input";
import { PrivacyEmailCaseForm } from "@/components/privacy-email-case-form";
import { PrivacyCaseThread } from "@/components/privacy-case-thread";
import { useAdminAccess } from "@/hooks/use-admin-access";
import { PrivacyCaseRequestError, adminPrivacyCases } from "@/lib/privacy-case-client";
import { PRIVACY_CASE_KINDS, PRIVACY_CASE_STATUSES, CASE_QUEUE_FILTERS, isUuid, matchesCaseQueue, firstPrivacyCaseResponse, privacyCaseFollowup, reviewTime,localCaseTime,localCasePastTime,type AdminCaseInput,type CaseWriteInput,type CaseActionResult, type CaseQueueFilter, type CaseAction, type CaseCursor, type PrivacyCase, type PrivacyCasePage } from "@/lib/privacy-cases";
import styles from "../../account/privacy-requests/page.module.css";
export default function AdminPrivacyCasesPage() {
  const {user,status,error,adminReady,isAdmin,adminError,retryAdmin}=useAdminAccess();
  if(status!=="ready"||!adminReady)return <AuthGateMessage status={status==="ready"?"checking":status} error={error}/>;
  if(!isAdmin)return <main className="mobile-shell"><h1>Ingen ärendeåtkomst</h1><p>{adminError||"Logga in med ett behörigt adminkonto."}</p>{adminError&&<button type="button" onClick={retryAdmin}>Kontrollera åtkomst igen</button>}</main>;
  return <AdminShell title="Personuppgiftsärenden" email={user?.email}>{user&&<Workspace key={user.id} owner={user.id}/>}</AdminShell>;
}
type ActionDraft={action:CaseAction;text:string;eventId:string|null;reviewAfter?:string;externalSentAt?:string};
function Workspace({owner}:{owner:string}) {
  const [items,setItems]=useState<PrivacyCase[]>([]),[next,setNext]=useState<CaseCursor|null>(null),[selected,setSelected]=useState<string|null>(null);
  const [busy,setBusy]=useState(false),[needsRead,setNeedsRead]=useState(true),[note,setNote]=useState("");
  const [filter,setFilter]=useState<CaseQueueFilter>("all"),[lookup,setLookup]=useState(false);
  const [manualOpen,setManualOpen]=useState(false),[readTick,setReadTick]=useState(0);
  const [now,setNow]=useState(Date.now);
  useEffect(()=>{const clock=setInterval(()=>setNow(Date.now()),30000);return()=>clearInterval(clock);},[]);
  const active=useRef(false),lock=useRef(false),task=useRef<AbortController|null>(null),idle=useRef<ReturnType<typeof setTimeout>|null>(null);
  const drafts=useRef(new Map<string,ActionDraft>());
  const confirmDraft=(item:PrivacyCase)=>{const draft=drafts.current.get(item.id);if(draft?.eventId&&item.events.some(e=>e.id===draft.eventId&&e.action===draft.action&&(["review","schedule_review"].includes(draft.action)?e.review_after!=null&&!!draft.reviewAfter&&Date.parse(e.review_after)===new Date(draft.reviewAfter).getTime():["reply","waiting","close"].includes(draft.action)&&e.public_message===draft.text.trim()&&(item.intake_source!=="email"||e.external_sent_at!=null&&!!draft.externalSentAt&&Date.parse(e.external_sent_at)===new Date(draft.externalSentAt).getTime())))){if(["review","schedule_review"].includes(draft.action)&&draft.text)drafts.current.set(item.id,{action:"reply",text:draft.text,eventId:null,externalSentAt:draft.externalSentAt});else drafts.current.delete(item.id);}};
  const clear=useCallback((keepDrafts=false)=>{setItems([]);setNext(null);setSelected(null);setLookup(false);setNeedsRead(true);if(!keepDrafts){drafts.current.clear();setManualOpen(false);}},[]);
  const expiresAt = useRef(0);
  const checkExpiry = useCallback(() => {
    if (!active.current || !expiresAt.current || Date.now() < expiresAt.current) return false;
    expiresAt.current = 0;
    task.current?.abort();
    task.current = null;
    lock.current = false;
    setBusy(false);
    clear();
    setNote("Ärendevyn och oskickade svar har tömts efter fem minuter. Verifiera dig för att läsa igen.");
    return true;
  }, [clear]);
  const expire = () => {
    if (idle.current) clearTimeout(idle.current);
    expiresAt.current = Date.now() + 300000;
    idle.current = setTimeout(checkExpiry, 300000);
  };
  useEffect(() => {
    const memory = drafts.current;
    const onReturn = () => { checkExpiry(); };
    active.current = true;
    document.addEventListener("visibilitychange", onReturn);
    window.addEventListener("focus", onReturn);
    return () => {
      active.current = false;
      expiresAt.current = 0;
      memory.clear();
      task.current?.abort();
      if (idle.current) clearTimeout(idle.current);
      document.removeEventListener("visibilitychange", onReturn);
      window.removeEventListener("focus", onReturn);
    };
  }, [checkExpiry]);
  const verify = (form:HTMLFormElement) => {
    const data=new FormData(form), password=String(data.get("password")||""),code=String(data.get("totpCode")||"");
    form.querySelectorAll<HTMLInputElement>('input[name="password"],input[name="totpCode"]').forEach(input=>{input.value="";});
    return {password,code};
  };
  const execute=async(form:HTMLFormElement,input:AdminCaseInput):Promise<CaseActionResult>=>{
    if(checkExpiry()||lock.current||!active.current)return {ok:false,rejected:false};
    const {password,code}=verify(form);lock.current=true;setBusy(true);setNote("");
    const controller=new AbortController();task.current=controller;
    try{
      const result=await adminPrivacyCases(owner,input,password,code,controller.signal);if(!active.current||controller.signal.aborted)return {ok:false,rejected:false};
      if(input.action==="list"){
        const page=result as PrivacyCasePage;for(const item of page.cases)confirmDraft(item);setItems(current=>input.cursor?[...current,...page.cases.filter(c=>!current.some(x=>x.id===c.id))]:page.cases);setNext(page.next);setSelected(null);setLookup(false);setNeedsRead(false);setReadTick(n=>n+1);setNote("Aktuell ärendestatus är läst.");
      }else if(input.action==="find"){const item=result as PrivacyCase;confirmDraft(item);setItems([item]);setNext(null);setSelected(item.id);setLookup(true);setNeedsRead(false);setReadTick(n=>n+1);setNote("Ärendet är läst.");
      }else if(input.action==="email_create"){const item=result as PrivacyCase;setItems([item]);setNext(null);setSelected(item.id);setLookup(true);setNeedsRead(false);setManualOpen(false);setNote("Mejlärendet är registrerat. Ta ärendet för att börja handlägga.");
      }else{const item=result as PrivacyCase;const draft=drafts.current.get(item.id);if(["claim","reopen","review","schedule_review"].includes(input.action)&&draft?.text)drafts.current.set(item.id,{action:"reply",text:draft.text,eventId:null,externalSentAt:draft.externalSentAt});else drafts.current.delete(item.id);setItems(current=>current.map(c=>c.id===item.id?item:c).filter(c=>lookup||matchesCaseQueue(c,filter,Date.parse(item.updated_at))));if(!lookup&&!matchesCaseQueue(item,filter,Date.parse(item.updated_at)))setSelected(null);setNote(["review","schedule_review"].includes(input.action)?"Uppföljningen är sparad. Användarens svarsfrist är oförändrad.":item.intake_source==="email"?"Åtgärden är registrerad. Inget mejl har skickats av formuläret.":"Åtgärden är sparad. Ett svar visas i användarens ärende; inget mejl skickas automatiskt.");}
      expire();return {ok:true};
    }catch(e){if(active.current&&!controller.signal.aborted){const keep=e instanceof PrivacyCaseRequestError&&(e.uncertain||e.status===400||e.status===409||e.status===429)&&e.status!==401&&e.status!==403;clear(keep);if(keep)expire();setNote((e instanceof Error?e.message:"Åtgärden kunde inte bekräftas.")+" Läs ärendena igen före nästa åtgärd."+(keep?input.action==="email_create"?" Registreringsunderlaget finns kvar i mejlformuläret.":" Ditt oskickade svar finns kvar när du öppnar ärendet igen.":""));}return {ok:false,rejected:e instanceof PrivacyCaseRequestError&&!e.uncertain&&(e.status===400||e.status===429)};}
    finally{if(task.current===controller){task.current=null;lock.current=false;if(active.current)setBusy(false);}}
  };
  const ordered=[...items].sort((a,b)=>(privacyCaseFollowup(a,now)?.due??Infinity)-(privacyCaseFollowup(b,now)?.due??Infinity)||a.id.localeCompare(b.id));
  const chosen=items.find(c=>c.id===selected);
  return <>
    <section className="admin-panel"><h2>Verifiera ärendeåtkomst</h2><p>Särskild handläggarbehörighet, bekräftad mejladress och autentiseringsapp krävs. Lösenord och aktuell kod kontrolleras vid varje läsning och ändring. <Link href="/admin/profile">Kontosäkerhet</Link>.</p>
      <form className={styles.form} onSubmit={e=>{e.preventDefault();void execute(e.currentTarget,{action:"list",cursor:null,filter});}}>
        <label>Visa ärenden<select value={filter} disabled={busy} onChange={e=>{if(lock.current)return;setFilter(e.target.value as CaseQueueFilter);clear(true);setLookup(false);}}>{Object.entries(CASE_QUEUE_FILTERS).map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></label>
        <label>Ärendenummer<input name="caseId" maxLength={36} autoComplete="off" disabled={busy}/></label>
        <Credentials disabled={busy}/><div className={styles.actions}><button className="primary-btn" disabled={busy}>{busy?"Verifierar…":"Läs aktuell ärendekö"}</button>{next&&!needsRead&&!lookup&&<button type="submit" className="secondary-btn" disabled={busy} onClick={e=>{e.preventDefault();const form=e.currentTarget.form;if(form?.reportValidity())void execute(form,{action:"list",cursor:next,filter});}}>Visa nästa sida</button>}<button type="button" className="secondary-btn" disabled={busy} onClick={()=>{clear();if(idle.current)clearTimeout(idle.current);expiresAt.current=0;}}>Töm ärendevyn</button><button type="button" className="secondary-btn" disabled={busy} onClick={e=>{const form=e.currentTarget.form;if(!form?.reportValidity())return;const id=String(new FormData(form).get("caseId")||"").trim().toLowerCase();if(!isUuid(id)){setNote("Ange ett fullständigt ärendenummer.");return;}void execute(form,{action:"find",id});}}>Öppna ärendenummer</button></div>
      </form>
    </section>
    <button type="button" className="secondary-btn" disabled={busy} onClick={()=>{if(!checkExpiry()){setManualOpen(v=>!v);if(!expiresAt.current)expire();}}}>{manualOpen?"Stäng mejlregistrering":"Registrera inkommet mejl"}</button>
    {manualOpen&&<PrivacyEmailCaseForm disabled={busy} items={items} readTick={readTick} credentials={<Credentials disabled={busy}/>} send={execute}/>}
    {note&&<p role="status">{note}</p>}
    {!needsRead&&items.length===0&&<p>Det finns inga ärenden på den här sidan.</p>}
    <p>{lookup?"Visar uppslaget ärende.":`Urval: ${CASE_QUEUE_FILTERS[filter]}. Inlästa öppna ärenden visas efter närmast återkopplings-, svars- eller uppföljningsdatum. Avslutade visas sist.`}{next&&" Det finns fler ärenden: läs nästa sida för att ta med dem i översikten."}</p>
    <div className="admin-profile-grid"><section className={styles.list} aria-label="Ärendekö">{ordered.map(item=><button type="button" className="secondary-btn" key={item.id} disabled={busy} aria-pressed={selected===item.id} onClick={()=>setSelected(item.id)}><strong>{PRIVACY_CASE_KINDS[item.kind]}</strong><br/>{PRIVACY_CASE_STATUSES[item.status]} · {item.is_mine?"Du hanterar":item.assigned?"Tilldelat":"Ej tilldelat"}<br/>{new Date(item.created_at).toLocaleDateString("sv-SE",{timeZone:"Europe/Stockholm"})} · {item.id}{item.intake_source==="email"&&" · Mejlärende"}<Followup item={item} now={now}/></button>)}</section>
      {chosen&&<section className={styles.panel}><PrivacyCaseThread item={chosen} owner={owner} admin/>
        <ActionForm key={chosen.id+":"+chosen.revision} drafts={drafts.current} item={chosen} disabled={busy||needsRead} execute={execute}/>
      </section>}
    </div>
    <p>Första återkoppling har ett internt mål på fem arbetsdagar. Målet ändrar inte ärendets svarsfrist.</p>
    <p>Avslut sparar en planerad gallringsdag tolv månader senare. Automatisk ärendegallring, fristpåminnelser, bilagor och incidentflöde är ännu inte aktiverade i denna leverans. Ett ärendeavslut utför ingen export eller radering av konto.</p>
  </>;
}
function Followup({item,now}:{item:PrivacyCase;now:number}) {
  const due=privacyCaseFollowup(item,now);if(!due)return null;
  const first=firstPrivacyCaseResponse(item,now);
  const date=(v:string)=>new Date(v).toLocaleDateString("sv-SE",{timeZone:"Europe/Stockholm"});
  return <span className={styles.followup}>{first&&<>{first.responded?`Första återkoppling: ${date(item.first_reply_at!)}`:`Första återkoppling senast: ${date(new Date(first.due).toISOString())}`}{first.overdue&&(first.responded?" – efter internt mål":" – internt mål passerat")}<br/></>}Svarsdatum: {date(item.reply_due_at)}{due.replyOverdue&&" – passerat"}{item.review_after&&<><br/>Uppföljning: {date(item.review_after)}{due.reviewOverdue&&" – behöver följas upp"}</>}</span>;
}
function Credentials({disabled}:{disabled:boolean}) {return <><label>Lösenord<PasswordInput name="password" autoComplete="current-password" required disabled={disabled}/></label><label>Aktuell tvåfaktorskod<input name="totpCode" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} required disabled={disabled}/></label></>;}
function ActionForm({item,disabled,execute,drafts}:{drafts:Map<string,ActionDraft>;item:PrivacyCase;disabled:boolean;execute:(form:HTMLFormElement,input:CaseWriteInput)=>Promise<CaseActionResult>}) {
  const saved=drafts.get(item.id),fallback=item.status==="closed"?"reopen":item.is_mine?"reply":"claim";
  const [action,setAction]=useState<CaseAction>(()=>saved&&(item.status==="closed"?saved.action==="reopen":saved.action!=="reopen"&&(item.is_mine||saved.action==="claim"))?saved.action:fallback);
  const [externalSentAt,setExternalSentAt]=useState(saved?.externalSentAt??""),[externalConfirmed,setExternalConfirmed]=useState(false);
  const [reviewAfter,setReviewAfter]=useState(saved?.reviewAfter??""),[fieldError,setFieldError]=useState("");
  const [text,setText]=useState(saved?.text??"");const attempt=useRef<string|null>(saved?.action===action?saved.eventId:null),locked=useRef(false);
  const remember=(nextAction:CaseAction,nextText:string,nextReview=reviewAfter,nextSent=externalSentAt)=>{attempt.current=null;setExternalConfirmed(false);setFieldError("");drafts.set(item.id,{action:nextAction,text:nextText,eventId:null,reviewAfter:nextReview,externalSentAt:nextSent});};
  const submit=async(e:FormEvent<HTMLFormElement>)=>{e.preventDefault();if(disabled||locked.current)return;let target:string|undefined,sent:string|undefined;if(item.intake_source==="email"&&["reply","waiting","close"].includes(action)){try{if(!externalConfirmed)throw Error("Bekräfta att svaret redan har skickats via mejl.");sent=localCasePastTime(externalSentAt,item.created_at);}catch(error){setFieldError(error instanceof Error?error.message:"Kontrollera sändningstiden.");return;}}if(["review","schedule_review"].includes(action)){try{target=reviewTime(localCaseTime(reviewAfter));}catch{setFieldError("Välj en framtida uppföljning inom 30 dygn.");return;}}locked.current=true;attempt.current??=crypto.randomUUID();const message=["reply","waiting","close"].includes(action)?text:"";drafts.set(item.id,{action,text,eventId:attempt.current,reviewAfter,externalSentAt});try{await execute(e.currentTarget,{action,id:item.id,revision:item.revision,eventId:attempt.current,message,...(target?{reviewAfter:target}:{}),...(sent?{externalReplyConfirmed:true,externalSentAt:sent}:{})});}finally{locked.current=false;}};
  return <form className={styles.form} onSubmit={submit}>
    <label>Åtgärd<select value={action} disabled={disabled} onChange={e=>{const value=e.target.value as CaseAction;setAction(value);remember(value,text);}}>{item.status==="closed"?<option value="reopen">Återöppna och ta ärendet</option>:<><option value="claim">Jag hanterar detta / ta över</option>{item.is_mine&&<><option value="reply">{item.intake_source==="email"?"Registrera skickat svar":"Svara"}</option><option value="waiting">{item.intake_source==="email"?"Registrera svar och invänta komplettering":"Svara och invänta komplettering"}</option><option value="close">{item.intake_source==="email"?"Registrera svar och avsluta":"Svara och avsluta"}</option><option value="schedule_review">Planera nästa uppföljning</option><option value="review">Registrera genomförd uppföljning</option></>}</>}</select></label>
    {["reply","waiting","close"].includes(action)&&<label>{item.intake_source==="email"?"Redan skickat mejlsvar":"Svar till användaren"}<textarea name="message" value={text} onChange={e=>{setText(e.target.value);remember(action,e.target.value);}} required maxLength={4000} disabled={disabled}/><span>{item.intake_source==="email"?"Spara nödvändig korrespondens efter att svaret skickats. Detta formulär skickar inget mejl.":"Texten visas för användaren. Lägg inga interna anteckningar eller onödiga personuppgifter här."}</span></label>}
    {!["reply","waiting","close"].includes(action)&&text&&<label>Oskickat svar<textarea value={text} readOnly/><span>Texten skickas inte med den valda åtgärden. Du kan kopiera den eller välja Svara.</span></label>}
    {["review","schedule_review"].includes(action)&&<label>Nästa uppföljning (din lokala tid)<input type="datetime-local" value={reviewAfter} required disabled={disabled} onChange={e=>{setReviewAfter(e.target.value);remember(action,text,e.target.value);}}/><span>Välj en framtida tid inom 30 dygn. Åtgärden skickar inget användarsvar.</span></label>}
    {item.intake_source==="email"&&["reply","waiting","close"].includes(action)&&<><label>Svaret skickades (din lokala tid)<input type="datetime-local" required value={externalSentAt} disabled={disabled} onChange={e=>{setExternalSentAt(e.target.value);remember(action,text,reviewAfter,e.target.value);}}/></label><label className={styles.checkbox}><input type="checkbox" required checked={externalConfirmed} disabled={disabled} onChange={e=>setExternalConfirmed(e.target.checked)}/>Jag bekräftar att svaret redan har skickats till kontaktadressen.</label></>}
    {fieldError&&<p role="alert">{fieldError}</p>}
    <Credentials disabled={disabled}/><button className="primary-btn" disabled={disabled}>Verifiera och utför åtgärden</button>
  </form>;
}
