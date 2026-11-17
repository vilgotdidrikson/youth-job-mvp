"use client";
import {useEffect,useRef,useState,type ReactNode} from "react";
import {PRIVACY_CASE_KINDS,caseContactEmail,localCasePastTime,caseText,matchesEmailCase,type CaseActionResult,type EmailCaseInput,type PrivacyCase,type PrivacyCaseKind} from "@/lib/privacy-cases";
import styles from "@/app/account/privacy-requests/page.module.css";
export function PrivacyEmailCaseForm({disabled,items,readTick,credentials,send}:{disabled:boolean;items:PrivacyCase[];readTick:number;credentials:ReactNode;send:(form:HTMLFormElement,input:EmailCaseInput)=>Promise<CaseActionResult>}) {
 const [kind,setKind]=useState<PrivacyCaseKind>("access"),[body,setBody]=useState(""),[email,setEmail]=useState(""),[received,setReceived]=useState("");
 const [pending,setPending]=useState<EmailCaseInput|null>(null),[check,setCheck]=useState(false),[note,setNote]=useState("");
 const attempt=useRef<EmailCaseInput|null>(null),locked=useRef(false),active=useRef(false);
 const reset=()=>{attempt.current=null;setPending(null);setBody("");setEmail("");setReceived("");setCheck(false);};
 useEffect(()=>{active.current=true;return()=>{active.current=false;attempt.current=null;};},[]);
 useEffect(()=>{setCheck(false);},[readTick]);
 useEffect(()=>{if(attempt.current&&items.some(item=>matchesEmailCase(item,attempt.current!))){reset();setNote("Mejlärendet finns registrerat. Inget nytt ärende skickades vid kontrollen.");}},[items,readTick]);
 return <section className={styles.panel}><h2>Registrera inkommet mejl</h2><p>För över bara relevant innehåll. Registreringen bekräftar ingen identitetskontroll och skickar inget mejl.</p>
  <form className={styles.form} aria-label="Registrera mejlärende" onSubmit={async e=>{e.preventDefault();if(disabled||check||locked.current)return;let input:EmailCaseInput;try{input=attempt.current??{action:"email_create",id:crypto.randomUUID(),kind,body:caseText(body),contactEmail:caseContactEmail(email),receivedAt:localCasePastTime(received)};}catch(error){setNote(error instanceof Error?error.message:"Kontrollera uppgifterna.");return;}attempt.current=input;setPending(input);locked.current=true;setNote("");try{const result=await send(e.currentTarget,input);if(!active.current)return;if(result.ok)reset();else if(result.rejected){attempt.current=null;setPending(null);}else setCheck(true);}finally{locked.current=false;}}}>
   <label>Vad gäller begäran?<select value={kind} disabled={disabled||!!pending} onChange={e=>{if(!attempt.current)setKind(e.target.value as PrivacyCaseKind);}}>{Object.entries(PRIVACY_CASE_KINDS).map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></label>
   <label>Kontaktadress<input type="email" value={email} maxLength={254} required autoComplete="off" disabled={disabled||!!pending} onChange={e=>{if(!attempt.current)setEmail(e.target.value);}}/></label>
   <label>Mejlet mottogs (din lokala tid)<input type="datetime-local" value={received} required disabled={disabled||!!pending} onChange={e=>{if(!attempt.current)setReceived(e.target.value);}}/><span>Den ursprungliga mottagningstiden används för ärendets datum.</span></label>
   <label>Relevant begäran<textarea value={body} required maxLength={4000} disabled={disabled||!!pending} onChange={e=>{if(!attempt.current)setBody(e.target.value);}}/></label>
   {credentials}<button className="primary-btn" disabled={disabled||check}>{pending?"Försök registrera samma mejlärende":"Verifiera och registrera mejlärendet"}</button>
  </form>{note&&<p role="status">{note}</p>}{pending&&<p>Ärendenummer för kontroll: {pending.id}.{check&&" Läs ärendekön eller öppna ärendenumret före nytt försök."}</p>}
 </section>;
}
