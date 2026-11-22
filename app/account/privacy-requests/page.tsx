"use client";
import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useSession } from "@/hooks/use-session";
import { AuthGateMessage } from "@/components/auth-gate-message";
import { PrivacyCaseDelivery } from "@/components/privacy-case-delivery";
import { PrivacyCaseThread } from "@/components/privacy-case-thread";
import { PRIVACY_CASE_KINDS, caseText, isUuid, type CaseCursor, type PrivacyCase, type PrivacyCaseKind } from "@/lib/privacy-cases";
import { PrivacyCaseRequestError, findOwnPrivacyCase, createOwnPrivacyCase, readOwnPrivacyCases, replyToOwnPrivacyCase } from "@/lib/privacy-case-client";
import { CONTACT_EMAIL } from "@/lib/product-copy";
import { PRIVACY_REQUESTS_LOGIN } from "@/lib/login-destination";
import styles from "./page.module.css";
export default function PrivacyRequestsPage() {
  const { user, loading, error } = useSession();
  if (loading) return <AuthGateMessage status="checking"/>;
  return <main className={styles.page}><Link href="/help#privacy-requests">Hjälp med personuppgifter</Link><h1>Mina personuppgiftsärenden</h1>
    {user && !error ? <Workspace key={user.id} owner={user.id}/> : <section className={styles.panel}>{error && <p role="alert">Sessionen kunde inte kontrolleras.</p>}<p>Logga in för att skapa och följa ett eget ärende. Du kan också kontakta oss utan konto.</p><Link href={PRIVACY_REQUESTS_LOGIN}>Logga in till mina ärenden</Link><p><a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a></p></section>}
  </main>;
}
type ReplyDraft = { text: string; id: string | null };
function Workspace({ owner }: { owner: string }) {
  const [items,setItems] = useState<PrivacyCase[]>([]), [next,setNext] = useState<CaseCursor|null>(null);
  const [available,setAvailable] = useState(false), [loaded,setLoaded] = useState(false), [busy,setBusy] = useState(false), [check,setCheck] = useState(false), [note,setNote] = useState("");
  const [caseId,setCaseId]=useState("");
  const [kind,setKind] = useState<PrivacyCaseKind>("access"), [body,setBody] = useState("");
  const drafts=useRef(new Map<string,ReplyDraft>());
  const pending = useRef<{id:string;kind:PrivacyCaseKind;body:string}|null>(null), active = useRef(false), lock = useRef(false), task = useRef<AbortController|null>(null);
  useEffect(() => { active.current=true; return () => {active.current=false;task.current?.abort();lock.current=false;}; },[]);
  const run = async (operation: (signal:AbortSignal)=>Promise<void>, writes=false) => {
    if(lock.current||!active.current)return false;lock.current=true;setBusy(true);setNote("");const c=new AbortController();task.current=c;
    try {await operation(c.signal);return active.current&&!c.signal.aborted;} catch(e) {if(active.current&&!c.signal.aborted){setNote(e instanceof Error?e.message:"Begäran kunde inte slutföras.");if(writes)setCheck(!(e instanceof PrivacyCaseRequestError)||e.uncertain||e.status===409);}return false;}
    finally {if(task.current===c){task.current=null;lock.current=false;if(active.current)setBusy(false);}}
  };
  const read = (cursor:CaseCursor|null=null) => run(async signal => {
    const page=await readOwnPrivacyCases(owner,cursor,signal);if(!active.current||signal.aborted)return;
    let combined=cursor?[...items,...page.cases.filter(c=>!items.some(x=>x.id===c.id))]:page.cases;
    const request=pending.current;
    let saved=request && combined.find(item=>item.id===request.id);
    if (request && check && !cursor && !saved) {
      try {
        saved=await findOwnPrivacyCase(owner,request.id,signal);
      } catch (reason) {
        if (!(reason instanceof PrivacyCaseRequestError) || reason.status!==404) throw reason;
      }
      if (!active.current || signal.aborted) return;
      if (saved) combined=[saved,...combined];
    }
    setItems(combined);setNext(page.next);setAvailable(page.available);setLoaded(true);
    if (request && saved && (saved.kind!==request.kind || saved.body!==request.body)) {
      setCheck(true);
      setNote("Ärendenumret stämmer men innehållet skiljer sig. Kontakta oss innan du försöker skicka igen.");
      return;
    }
    setCheck(false);
    if(saved){pending.current=null;setBody("");setNote("Ärendet finns sparat. Inget nytt ärende skickades vid kontrollen.");}
  });
  // First read has no writes. A keyed workspace prevents cross-account state reuse.
  useEffect(() => {void read();},[]); // eslint-disable-line react-hooks/exhaustive-deps
  const create = (event:FormEvent<HTMLFormElement>) => {
    event.preventDefault();if(!loaded||!available||check||lock.current)return;
    try{caseText(body);}catch(e){setNote(e instanceof Error?e.message:"Kontrollera beskrivningen.");return;}
    pending.current??={id:crypto.randomUUID(),kind,body:body.trim()};const input=pending.current;
    void run(async signal=>{let item:PrivacyCase;try{item=await createOwnPrivacyCase(owner,input.id,input.kind,input.body,signal);}catch(e){if(e instanceof PrivacyCaseRequestError&&!e.uncertain&&e.status!==409)pending.current=null;throw e;}if(!active.current||signal.aborted)return;pending.current=null;setItems(current=>[item,...current.filter(c=>c.id!==item.id)]);setBody("");setCheck(false);setNote("Ditt ärende är mottaget. Följ svaret här; inget mejl skickas automatiskt.");},true);
  };
  const reply = (item:PrivacyCase,text:string,id:string)=>run(async signal=>{const result=await replyToOwnPrivacyCase(owner,item,text,id,signal);if(!active.current||signal.aborted)return;setItems(current=>current.map(c=>c.id===result.id?result:c));setNote("Din komplettering är sparad.");},true);
  return <>
    <p>Be om tillgång, rättelse eller annan hjälp med dina personuppgifter. Ett ärende utför inte automatiskt export, profiländring eller kontoradering. <Link href="/profile">Öppna kontoinställningar</Link>.</p>
    <p>Skicka bara det vi behöver för att förstå frågan. Lägg inte in lösenord, personnummer, hela CV:n eller känsliga uppgifter. Kontakt utan konto: <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.</p>
    <div className={styles.actions}><button type="button" className="secondary-btn" disabled={busy} onClick={()=>void read()}>{busy?"Arbetar…":check?"Kontrollera ärenden före nytt försök":"Läs aktuell status"}</button></div>
    {note&&<p role={check?"alert":"status"}>{note}</p>}
    {loaded&&!available&&<p role="status">Nya ärenden kan inte tas emot här just nu. Kontakta oss via mejl. Tidigare ärenden kan fortfarande läsas.</p>}
    {loaded&&available&&<section className={styles.panel}><h2>Nytt ärende</h2><form className={styles.form} onSubmit={create}>
      <label>Vad gäller din begäran?<select value={kind} disabled={busy||check||!!pending.current} onChange={e=>setKind(e.target.value as PrivacyCaseKind)}>{Object.entries(PRIVACY_CASE_KINDS).map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></label>
      <label>Beskriv din begäran<textarea value={body} maxLength={4000} required disabled={busy||check||!!pending.current} onChange={e=>setBody(e.target.value)}/></label>
      <button className="primary-btn" disabled={busy||check||!body.trim()}>{pending.current?"Försök spara samma ärende":"Skicka begäran"}</button>
    </form></section>}
    {loaded&&items.length===0&&<p>Du har inga sparade ärenden.</p>}
    <form className={styles.form} onSubmit={e=>{e.preventDefault();const id=caseId.trim().toLowerCase();if(!isUuid(id)){setNote("Ange ett fullständigt ärendenummer.");return;}void run(async signal=>{const item=await findOwnPrivacyCase(owner,id,signal);if(!active.current||signal.aborted)return;setItems(current=>[item,...current.filter(c=>c.id!==item.id)]);setNote("Ärendet är läst.");});}}>
      <label>Ärendenummer<input value={caseId} onChange={e=>setCaseId(e.target.value)} maxLength={36} autoComplete="off" required disabled={busy}/></label><button className="secondary-btn" disabled={busy}>Öppna mitt ärende</button>
    </form>
    {items.map(item=><section key={item.id} className={styles.panel}><PrivacyCaseThread item={item} owner={owner}/>{(item.kind==="access" || item.kind==="portability")&&<PrivacyCaseDelivery owner={owner} id={item.id}/>}<ReplyForm key={item.id} drafts={drafts.current} item={item} disabled={busy||check||item.status==="closed"} send={reply}/></section>)}
    {next&&!check&&<div className={styles.actions}><button type="button" className="secondary-btn" disabled={busy} onClick={()=>void read(next)}>Visa äldre ärenden</button></div>}
    <p>Ärendeunderlag kan behöva bevaras efter att kontot raderats för att handlägga din begäran. Läs <Link href="/privacy">integritetsinformationen</Link> eller fråga oss om vad som gäller för ditt ärende.</p>
  </>;
}
function ReplyForm({item,disabled,send,drafts}:{item:PrivacyCase;disabled:boolean;drafts:Map<string,ReplyDraft>;send:(item:PrivacyCase,text:string,id:string)=>Promise<boolean>}) {
  const [text,setText]=useState(()=>drafts.get(item.id)?.text??"");const id=useRef<string|null>(drafts.get(item.id)?.id??null),active=useRef(false),locked=useRef(false);
  useEffect(()=>{active.current=true;return()=>{active.current=false;};},[]);
  useEffect(()=>{if(id.current&&item.events.some(event=>event.id===id.current&&event.action==="user_reply"&&event.public_message===text.trim())){setText("");id.current=null;drafts.delete(item.id);}},[item,drafts,text]);
  if(item.status==="closed"&&!text)return null;
  return <form className={styles.form} onSubmit={async e=>{e.preventDefault();if(disabled||locked.current||!text.trim())return;locked.current=true;id.current??=crypto.randomUUID();drafts.set(item.id,{text,id:id.current});try{if(await send(item,text,id.current)&&active.current){setText("");id.current=null;drafts.delete(item.id);}}finally{locked.current=false;}}}><label>Komplettera ärendet<textarea required maxLength={4000} value={text} readOnly={item.status==="closed"} disabled={disabled&&item.status!=="closed"} onChange={e=>{setText(e.target.value);id.current=null;drafts.set(item.id,{text:e.target.value,id:null});}}/></label>{item.status==="closed"&&text&&<p role="status">Ärendet har avslutats. Din oskickade text finns kvar här för att du ska kunna kopiera den och kontakta oss.</p>}<button className="secondary-btn" disabled={disabled||!text.trim()}>Skicka komplettering</button></form>;
}
