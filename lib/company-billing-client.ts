"use client";
import {getSupabaseClient} from './supabase';
import {parseBillingRecord,validateBilling,type BillingValues} from './company-billing';
const columns='user_id,invoice_email,address_line1,address_line2,postal_code,city,reference,country_code,version';
export async function loadCompanyBilling(userId:string,signal:AbortSignal) {
 signal.throwIfAborted();
 const {data,error}=await getSupabaseClient().from('company_billing_details').select(columns).eq('user_id',userId).abortSignal(signal).maybeSingle();
 signal.throwIfAborted();
 if(error) throw new Error('Fakturauppgifterna kunde inte hämtas.');
 return data===null?null:parseBillingRecord(data,userId);
}
export async function saveCompanyBilling(userId:string,version:number|null,input:BillingValues,signal:AbortSignal) {
 signal.throwIfAborted();
 if(version!==null&&(!Number.isInteger(version)||version<1)) throw new Error('Läs in de sparade uppgifterna först.');
 const {value,errors}=validateBilling(input);
 if(Object.keys(errors).length) throw new Error('Kontrollera fakturauppgifterna.');
 const {data,error}=await getSupabaseClient().rpc('save_company_billing_details',{p_owner_id:userId,p_expected_version:version,p_details:value}).abortSignal(signal);
 signal.throwIfAborted();
 if(error) throw new Error(error.code==='40001'?'Uppgifterna har ändrats. Läs in de sparade uppgifterna innan du sparar igen.':'Sparandet kunde inte bekräftas. Läs in de sparade uppgifterna innan du försöker igen.');
 if(!Array.isArray(data)||data.length!==1) throw new Error('Sparandet kunde inte bekräftas.');
 const row=parseBillingRecord(data[0],userId);
 if(row.version!==(version??0)+1) throw new Error('Sparandet kunde inte bekräftas.');
 return row;
}
