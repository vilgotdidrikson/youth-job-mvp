"use client";
import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { AdminShell } from "@/components/admin/admin-shell";
import { AuthGateMessage } from "@/components/auth-gate-message";
import { PasswordInput } from "@/components/password-input";
import { PrivacyCaseThread } from "@/components/privacy-case-thread";
import { useAdminAccess } from "@/hooks/use-admin-access";
import { adminPrivacyCases } from "@/lib/privacy-case-client";
import { PRIVACY_CASE_KINDS, PRIVACY_CASE_STATUSES, type CaseAction, type CaseCursor, type PrivacyCase, type PrivacyCasePage } from "@/lib/privacy-cases";
import styles from "../../account/privacy-requests/page.module.css";
export default function AdminPrivacyCasesPage() {
  const {user,status,error,adminReady,isAdmin,adminError,retryAdmin}=useAdminAccess();
  if(status!=="ready"||!adminReady)return <AuthGateMessage status={status==="ready"?"checking":status} error={error}/>;
  if(!isAdmin)return <main className="mobile-shell"><h1>Ingen ärendeåtkomst</h1><p>{adminError||"Logga in med ett behörigt adminkonto."}</p>{adminError&&<button type="button" onClick={retryAdmin}>Kontrollera åtkomst igen</button>}</main>;
  return <AdminShell title="Personuppgiftsärenden" email={user?.email}>{user&&<Workspace key={user.id} owner={user.id}/>}</AdminShell>;
}
function Workspace({owner}:{owner:string}) {
  const [items,setItems]=useState<PrivacyCase[]>([]),[next,setNext]=useState<CaseCursor|null>(null),[selected,setSelected]=useState<string|null>(null);
  const [busy,setBusy]=useState(false),[needsRead,setNeedsRead]=useState(true),[note,setNote]=useState("");
  const active=useRef(false),lock=useRef(false),task=useRef<AbortController|null>(null),idle=useRef<ReturnType<typeof setTimeout>|null>(null);
  const clear=()=>{setItems([]);setNext(null);setSelected(null);setNeedsRead(true);};
  useEffect(()=>{active.current=true;return()=>{active.current=false;task.current?.abort();if(idle.current)clearTimeout(idle.current);};},[]);
  const verify = (form:HTMLFormElement) => {
    const data=new FormData(form), password=String(data.get("password")||""),code=String(data.get("totpCode")||"");
    form.querySelectorAll<HTMLInputElement>('input[name="password"],input[name="totpCode"]').forEach(input=>{input.value="";});
    return {password,code};
  };
  const execute=async(form:HTMLFormElement,input:{action:"list";cursor:CaseCursor|null}|{action:CaseAction;id:string;revision:string;eventId:string;message:string})=>{
    if(lock.current||!active.current)return;
    const {password,code}=verify(form);lock.current=true;setBusy(true);setNote("");
    if(idle.current)clearTimeout(idle.current);
    const controller=new AbortController();task.current=controller;
    try{
      const result=await adminPrivacyCases(owner,input,password,code,controller.signal);if(!active.current||controller.signal.aborted)return;
      if(input.action==="list"){
        const page=result as PrivacyCasePage;setItems(current=>input.cursor?[...current,...page.cases.filter(c=>!current.some(x=>x.id===c.id))]:page.cases);setNext(page.next);setSelected(null);setNeedsRead(false);setNote("Aktuell ärendestatus är läst.");
      }else{const item=result as PrivacyCase;setItems(current=>current.map(c=>c.id===item.id?item:c));setNote("Åtgärden är sparad. Ett svar visas i användarens ärende; inget mejl skickas automatiskt.");}
      idle.current=setTimeout(()=>{if(active.current){clear();setNote("Ärendevyn har tömts efter fem minuter. Verifiera dig för att läsa igen.");}},300000);
    }catch(e){if(active.current&&!controller.signal.aborted){clear();setNote((e instanceof Error?e.message:"Åtgärden kunde inte bekräftas.")+" Läs ärendena igen före nästa åtgärd.");}}
    finally{if(task.current===controller){task.current=null;lock.current=false;if(active.current)setBusy(false);}}
  };
  const chosen=items.find(c=>c.id===selected);
  return <>
    <section className="admin-panel"><h2>Verifiera ärendeåtkomst</h2><p>Särskild handläggarbehörighet, bekräftad mejladress och autentiseringsapp krävs. Lösenord och aktuell kod kontrolleras vid varje läsning och ändring. <Link href="/admin/profile">Kontosäkerhet</Link>.</p>
      <form className={styles.form} onSubmit={e=>{e.preventDefault();void execute(e.currentTarget,{action:"list",cursor:null});}}>
        <Credentials disabled={busy}/><div className={styles.actions}><button className="primary-btn" disabled={busy}>{busy?"Verifierar…":"Läs aktuell ärendekö"}</button>{next&&!needsRead&&<button type="submit" className="secondary-btn" disabled={busy} onClick={e=>{e.preventDefault();const form=e.currentTarget.form;if(form?.reportValidity())void execute(form,{action:"list",cursor:next});}}>Visa nästa sida</button>}<button type="button" className="secondary-btn" disabled={busy} onClick={()=>{clear();if(idle.current)clearTimeout(idle.current);}}>Töm ärendevyn</button></div>
      </form>
    </section>
    {note&&<p role="status">{note}</p>}
    {!needsRead&&items.length===0&&<p>Det finns inga ärenden på den här sidan.</p>}
    <div className="admin-profile-grid"><section className={styles.list} aria-label="Ärendekö">{items.map(item=><button type="button" className="secondary-btn" key={item.id} disabled={busy} aria-pressed={selected===item.id} onClick={()=>setSelected(item.id)}><strong>{PRIVACY_CASE_KINDS[item.kind]}</strong><br/>{PRIVACY_CASE_STATUSES[item.status]} · {item.is_mine?"Du hanterar":item.assigned?"Tilldelat":"Ej tilldelat"}<br/>{new Date(item.created_at).toLocaleDateString("sv-SE")} · {item.id}</button>)}</section>
      {chosen&&<section className={styles.panel}><PrivacyCaseThread item={chosen} admin/>
        <ActionForm key={chosen.revision} item={chosen} disabled={busy||needsRead} execute={execute}/>
      </section>}
    </div>
    <p>Avslut sparar en planerad gallringsdag tolv månader senare. Automatisk ärendegallring, fristpåminnelser, bilagor och incidentflöde är ännu inte aktiverade i denna leverans. Ett ärendeavslut utför ingen export eller radering av konto.</p>
  </>;
}
function Credentials({disabled}:{disabled:boolean}) {return <><label>Lösenord<PasswordInput name="password" autoComplete="current-password" required disabled={disabled}/></label><label>Aktuell tvåfaktorskod<input name="totpCode" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} required disabled={disabled}/></label></>;}
function ActionForm({item,disabled,execute}:{item:PrivacyCase;disabled:boolean;execute:(form:HTMLFormElement,input:{action:CaseAction;id:string;revision:string;eventId:string;message:string})=>Promise<void>}) {
  const [action,setAction]=useState<CaseAction>(item.status==="closed"?"reopen":item.is_mine?"reply":"claim");const attempt=useRef<string|null>(null);
  const submit=(e:FormEvent<HTMLFormElement>)=>{e.preventDefault();if(disabled)return;attempt.current??=crypto.randomUUID();const form=e.currentTarget,data=new FormData(form);void execute(form,{action,id:item.id,revision:item.revision,eventId:attempt.current,message:String(data.get("message")||"")});};
  return <form className={styles.form} onSubmit={submit}>
    <label>Åtgärd<select value={action} disabled={disabled} onChange={e=>{setAction(e.target.value as CaseAction);}}>{item.status==="closed"?<option value="reopen">Återöppna och ta ärendet</option>:<><option value="claim">Jag hanterar detta / ta över</option>{item.is_mine&&<><option value="reply">Svara</option><option value="waiting">Svara och invänta komplettering</option><option value="close">Svara och avsluta</option></>}</>}</select></label>
    {["reply","waiting","close"].includes(action)&&<label>Svar till användaren<textarea name="message" required maxLength={4000} disabled={disabled}/><span>Texten visas för användaren. Lägg inga interna anteckningar eller onödiga personuppgifter här.</span></label>}
    <Credentials disabled={disabled}/><button className="primary-btn" disabled={disabled}>Verifiera och utför åtgärden</button>
  </form>;
}
