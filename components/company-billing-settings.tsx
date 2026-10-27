"use client";
import {useEffect,useRef,useState,type FormEvent} from 'react';
import {billingFields,emptyBilling,validateBilling,type BillingErrors,type BillingRecord,type BillingValues} from '@/lib/company-billing';
import {loadCompanyBilling,saveCompanyBilling} from '@/lib/company-billing-client';
import {createLatestRead,type ReadState} from '@/lib/latest-read';
import styles from './company-billing-settings.module.css';

function BillingForm({userId}:{userId:string}) {
 const [state,setState]=useState<ReadState<BillingRecord|null>>({status:'loading'});
 const [form,setForm]=useState<BillingValues>({...emptyBilling});
 const [errors,setErrors]=useState<BillingErrors>({});
 const [notice,setNotice]=useState('');
 const [saveError,setSaveError]=useState('');
 const [saving,setSaving]=useState(false);
 const [mustReload,setMustReload]=useState(false);
 const readable=useRef(false),versionRef=useRef<number|null>(null);
 const active=useRef(false),busy=useRef(false),write=useRef<AbortController|null>(null);
 const reader=useRef<ReturnType<typeof createLatestRead<BillingRecord|null>>|null>(null);
 useEffect(()=>{
  active.current=true;
  const read=createLatestRead<BillingRecord|null>({read:(_,signal)=>loadCompanyBilling(userId,signal),errorMessage:'Fakturauppgifterna kunde inte hämtas.',update:next=>{
   readable.current=next.status==='ready';
   setState(next);
   if(next.status==='ready') {versionRef.current=next.value?.version??null;setForm(next.value?validateBilling(next.value).value:{...emptyBilling});setMustReload(false);setErrors({});setSaveError('');setNotice('');}
  }});
  reader.current=read;void read.load();
  return()=>{active.current=false;readable.current=false;read.stop();write.current?.abort();};
 },[userId]);
 const submit=async(event:FormEvent<HTMLFormElement>)=>{
  event.preventDefault();
  if(busy.current||!active.current||!readable.current||mustReload) return;
  const submitted=new FormData(event.currentTarget),input={...emptyBilling};
  for(const field of billingFields) input[field.key]=String(submitted.get(field.key)??'');
  setForm(input);
  const checked=validateBilling(input);setErrors(checked.errors);setNotice('');setSaveError('');
  if(Object.keys(checked.errors).length) return;
  busy.current=true;setSaving(true);
  const controller=new AbortController();write.current=controller;
  let onAbort=()=>{};
  const aborted=new Promise<never>((_,reject)=>{onAbort=()=>reject(new Error('Sparandet kunde inte bekräftas. Läs in de sparade uppgifterna innan du försöker igen.'));controller.signal.addEventListener('abort',onAbort,{once:true});});
  const timer=setTimeout(()=>controller.abort(),15000);
  try {
   const row=await Promise.race([saveCompanyBilling(userId,versionRef.current,checked.value,controller.signal),aborted]);
   if(!active.current||controller.signal.aborted) return;
   versionRef.current=row.version;setForm(validateBilling(row).value);setNotice('Fakturauppgifterna är sparade.');
  } catch(error) {
   if(active.current) {readable.current=false;setMustReload(true);setSaveError(error instanceof Error?error.message:'Sparandet kunde inte bekräftas.');}
  } finally {
   clearTimeout(timer);controller.signal.removeEventListener('abort',onAbort);busy.current=false;
   if(write.current===controller) write.current=null;
   if(active.current) setSaving(false);
  }
 };
 return <section className={styles.card} aria-labelledby="company-billing-title">
  <h2 id="company-billing-title">Fakturauppgifter</h2>
  <p className={styles.intro}>För kommande fakturering. Att spara uppgifterna skapar ingen faktura och ändrar inte din inloggningsadress.</p>
  {state.status==='loading'&&<p role="status">Hämtar fakturauppgifter…</p>}
  {state.status==='error'&&<p role="alert">{state.message}</p>}
  <form onSubmit={submit} noValidate>
   <fieldset className={styles.fields} disabled={saving||state.status!=='ready'||mustReload}>
    <legend>Fakturaadress i Sverige</legend>
    {billingFields.map(field=><label key={field.key} className={styles.field}>{field.label}
     <input name={field.key} type={field.type} value={form[field.key]} required={field.required} maxLength={field.max} autoComplete={field.autoComplete} inputMode={field.key==='postal_code'?'numeric':undefined} aria-invalid={Boolean(errors[field.key])} aria-describedby={errors[field.key]?`billing-${field.key}-error`:undefined} onChange={event=>{setForm(current=>({...current,[field.key]:event.target.value}));setErrors(current=>({...current,[field.key]:undefined}));setNotice('');}}/>
     {errors[field.key]&&<span id={`billing-${field.key}-error`} className={styles.error}>{errors[field.key]}</span>}
    </label>)}
   </fieldset>
   {saveError&&<p role="alert" className={styles.error}>{saveError}</p>}
   {notice&&<p role="status">{notice}</p>}
   <div className={styles.actions}>
    <button className="cta-btn" type="submit" disabled={saving||state.status!=='ready'||mustReload}>{saving?'Sparar…':'Spara fakturauppgifter'}</button>
    <button className="secondary-btn" type="button" disabled={saving||state.status==='loading'} onClick={()=>{if(!busy.current)void reader.current?.load();}}>Läs in sparade uppgifter</button>
   </div>
  </form>
 </section>;
}
/** A keyed form prevents one account's drafts/late responses reaching another. */
export function CompanyBillingSettings({userId}:{userId:string}) {return <BillingForm key={userId} userId={userId}/>;}
