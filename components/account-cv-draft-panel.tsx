"use client";
import {useEffect,useRef,useState} from "react";
import {loadAccountCvDraft,saveAccountCvDraft,AccountCvDraftError} from "@/lib/account-cv-draft-client";
import {parseAccountCvDraft,cvDraftFingerprint,type AccountCvDraft,type AccountCvDraftRow} from "@/lib/account-cv-draft";
import styles from "./account-security-settings.module.css";
type Props={userId:string;snapshot:AccountCvDraft;disabled:boolean;completed:boolean;onRestore:(value:AccountCvDraft)=>void};
export function AccountCvDraftPanel(props:Props){return <DraftPanel key={props.userId} {...props}/>;}
function DraftPanel({userId,snapshot,disabled,completed,onRestore}:Props){
 const [row,setRow]=useState<AccountCvDraftRow|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState(""),[note,setNote]=useState("");
 const [mustRead,setMustRead]=useState(false),[uncertain,setUncertain]=useState(false);
 const active=useRef(false),lock=useRef(false),pending=useRef<AbortController|null>(null),attempt=useRef<{content:AccountCvDraft|null}|null>(null);
 const run=async(operation:(signal:AbortSignal)=>Promise<void>)=>{
  if(!active.current||lock.current)return;lock.current=true;setBusy(true);setError("");const request=new AbortController();pending.current=request;
  try{await operation(request.signal);}catch(reason){if(active.current&&!request.signal.aborted)setError(reason instanceof AccountCvDraftError?reason.message:"Utkastet kunde inte hanteras. Ditt lokala arbete finns kvar.");}
  finally{if(pending.current===request){pending.current=null;lock.current=false;if(active.current)setBusy(false);}}
 };
 const read=()=>void run(async signal=>{
  const value=await loadAccountCvDraft(userId,signal);if(!active.current||signal.aborted)return;
  setRow(value);setMustRead(false);setUncertain(false);
  if(attempt.current){const matched=!value.invalid&&cvDraftFingerprint(value.content)===cvDraftFingerprint(attempt.current.content);setNote(matched?"Sparningen är bekräftad på kontot.":"Aktuell version är hämtad. Ditt lokala arbete finns kvar. Granska versionerna innan du sparar igen.");attempt.current=null;}
 });
 useEffect(()=>{
  active.current=true;const request=new AbortController();pending.current=request;lock.current=true;setBusy(true);
  void loadAccountCvDraft(userId,request.signal).then(value=>{if(active.current&&!request.signal.aborted)setRow(value);}).catch(()=>{if(active.current&&!request.signal.aborted)setError("Utkastet på kontot kunde inte hämtas. Ditt lokala arbete finns kvar.");}).finally(()=>{if(pending.current===request){pending.current=null;lock.current=false;if(active.current)setBusy(false);}});
  return()=>{active.current=false;request.abort();pending.current?.abort();};
 },[userId]);
 const save=(clear=false)=>{
  if(disabled||!row||mustRead||lock.current||!active.current||completed&&!clear)return;
  let content:AccountCvDraft|null;
  try{content=clear?null:parseAccountCvDraft(snapshot);}catch{setError("Utkastet är för stort eller kan inte sparas i detta format. Det finns kvar på den här enheten.");return;}
  void run(async signal=>{
   attempt.current={content};setNote("");
   try{const value=await saveAccountCvDraft(userId,row.revision,content,signal);if(!active.current||signal.aborted)return;setRow(value);attempt.current=null;setNote(clear?"Arbetsutkastet är borttaget från kontot. Ditt färdiga CV och lokala arbete påverkas inte.":"Utkastet är sparat på kontot. Det kan öppnas på en annan enhet.");}
   catch(reason){if(active.current&&!signal.aborted){setMustRead(true);setUncertain(reason instanceof AccountCvDraftError&&reason.kind==="uncertain");}throw reason;}
  });
 };
 const hasChanges=!!row&&cvDraftFingerprint(snapshot)!==cvDraftFingerprint(row.content);
 return <section className={styles.form} aria-label="Privat CV-utkast på kontot">
  <h2>Fortsätt på en annan enhet</h2>
  <p>Utkastet är privat. Det ersätter inte ditt färdiga CV och används inte i ansökningar förrän du granskar och gör CV:t klart.</p>
  {busy&&<p role="status">Kontrollerar utkastet…</p>}
  {row?.updatedAt&&<p>Senast sparat på kontot: {new Date(row.updatedAt).toLocaleString("sv-SE")}.</p>}
  {row&&!completed&&hasChanges&&<p role="status">Utkastet på den här enheten har inte sparats på kontot i sin nuvarande version.</p>}
  {row?.invalid&&<p role="alert">Det sparade arbetsutkastet har ett format som inte kan öppnas. Ditt lokala arbete finns kvar; du kan ersätta eller ta bort arbetsutkastet på kontot.</p>}
  {row&&<button className="secondary-btn" type="button" disabled={busy||disabled||mustRead||completed} onClick={()=>save()}>Spara privat utkast på kontot</button>}
  {row?.content&&!completed&&<><p>Om du öppnar kontots utkast ersätter det arbetsutkastet som visas på den här enheten. Du behöver granska CV:t igen.</p><button className="secondary-btn" type="button" disabled={busy||disabled||mustRead} onClick={()=>{if(!active.current||lock.current||disabled||mustRead||!row.content)return;onRestore(structuredClone(row.content));setNote("Arbetsutkastet är öppnat. Granska och godkänn CV:t innan du gör det klart.");}}>Öppna sparat utkast</button></>}
  {(row?.content||row?.invalid)&&<button className="secondary-btn" type="button" disabled={busy||disabled||mustRead} onClick={()=>save(true)}>Ta bort arbetsutkast från kontot</button>}
  <button className="secondary-btn" type="button" disabled={busy||disabled} onClick={read}>{uncertain?"Kontrollera sparningen":mustRead||!row?"Läs aktuell utkastversion":"Uppdatera utkaststatus"}</button>
  {error&&<p role="alert">{error}</p>}{note&&<p role="status">{note}</p>}
 </section>;
}
