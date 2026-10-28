"use client";
import {useEffect,useRef,useState,type FormEvent} from 'react';
import Link from "next/link";
import {ModalDialog} from '@/components/modal-dialog';
import {PasswordInput} from '@/components/password-input';
import {AccountDeletionError,deleteOwnAccount} from '@/lib/account-deletion';
import type {Role} from '@/lib/types';
import styles from './delete-account-control.module.css';

function Control({userId,role,className,email}:{userId:string;role:Role;className?:string;email?:string}) {
 const [open,setOpen]=useState(false),[password,setPassword]=useState(''),[confirmed,setConfirmed]=useState(false);
 const [busy,setBusy]=useState(false),[done,setDone]=useState(false),[error,setError]=useState(''),[uncertain,setUncertain]=useState(false);
 const active=useRef(false),sending=useRef(false),completed=useRef(false),request=useRef<AbortController|null>(null);
 useEffect(()=>{active.current=true;return()=>{active.current=false;request.current?.abort();};},[]);
 const close=()=>{if(sending.current||completed.current)return;setPassword('');setConfirmed(false);setError('');setUncertain(false);setOpen(false);};
 const submit=async(event:FormEvent<HTMLFormElement>)=>{
  event.preventDefault();
  if(sending.current||completed.current||!active.current)return;
  const values=new FormData(event.currentTarget),submittedPassword=String(values.get('password')??'');
  if(!submittedPassword||submittedPassword.length>1024||values.get('confirmDeletion')!=='yes'){setError('Ange ditt lösenord och bekräfta att du vill radera kontot.');return;}
  sending.current=true;setBusy(true);setError('');setUncertain(false);
  const controller=new AbortController();request.current=controller;
  let onAbort=()=>{};
  const aborted=new Promise<never>((_,reject)=>{onAbort=()=>reject(new AccountDeletionError('Raderingens resultat kunde inte bekräftas. Logga in igen för att kontrollera kontot innan nästa försök.',true));controller.signal.addEventListener('abort',onAbort,{once:true});});
  const timer=setTimeout(()=>controller.abort(),30000);
  try {
   await Promise.race([deleteOwnAccount(userId,submittedPassword,controller.signal),aborted]);
   if(!active.current||controller.signal.aborted)return;
   completed.current=true;setDone(true);
   // No shared signOut here: a late completion must never sign out a new account.
  } catch(failure) {
   if(active.current){setError(failure instanceof Error?failure.message:'Kontot kunde inte raderas.');setUncertain(failure instanceof AccountDeletionError&&failure.uncertain);}
  } finally {
   clearTimeout(timer);controller.signal.removeEventListener('abort',onAbort);sending.current=false;
   if(request.current===controller)request.current=null;
   if(active.current){setBusy(false);setPassword('');setConfirmed(false);}
  }
 };
 return <><button type="button" className={className} onClick={()=>{if(!completed.current)setOpen(true);}}>Radera konto permanent</button>
 {open&&<ModalDialog labelledBy="delete-account-title" onClose={close} busy={busy||done} className={styles.dialog}>
  <h2 id="delete-account-title">{done?'Kontot är raderat':'Radera ditt konto'}</h2>
  {done?<><p role="status">Raderingen är bekräftad.</p><Link href="/" prefetch={false} className="cta-btn" onClick={event=>{event.preventDefault();window.location.assign("/");}}>Till startsidan</Link></>:<form onSubmit={submit}>
   <p>{role==='company'?'Kontot, företagsprofilen, fakturauppgifterna, annonserna och deras bilder samt tillhörande ansökningar, matchningar och chattar raderas.':'Kontot, profilen, ansökningarna, matchningarna, chattarna och filerna raderas.'}</p>
   <p>Personer du har chattat med får information om att chatten stängts. Anmälningar och anmält innehåll kan bevaras för säkerhetsgranskning.</p>
   <p>Du bekräftar raderingen för <strong>{email||(role==='company'?'ditt företagskonto':'ditt konto')}</strong>. Åtgärden kan inte ångras.</p>
   <fieldset disabled={busy||uncertain} className={styles.fields}>
    <label>Ditt nuvarande lösenord<PasswordInput name="password" value={password} onChange={event=>setPassword(event.target.value)} autoComplete="current-password" required maxLength={1024}/></label>
    <label className={styles.confirm}><input type="checkbox" name="confirmDeletion" value="yes" checked={confirmed} onChange={event=>setConfirmed(event.target.checked)} required/>Jag förstår vad som raderas och vill avsluta kontot permanent.</label>
   </fieldset>
   {error&&<p role="alert" className={styles.error}>{error}</p>}
   {uncertain?<a href="/login" className="secondary-btn">Till inloggning för att kontrollera kontot</a>:<div className={styles.actions}><button type="button" className="secondary-btn" disabled={busy} onClick={close}>Avbryt</button><button type="submit" className={styles.danger} disabled={busy}>{busy?'Raderar…':'Radera kontot permanent'}</button></div>}
  </form>}
 </ModalDialog>}</>;
}
/** Switching accounts destroys passwords, confirmation and pending UI callbacks. */
export function DeleteAccountControl(props:{userId:string;role:Role;className?:string;email?:string}) {return <Control key={props.userId} {...props}/>;}
