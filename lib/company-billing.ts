/** Shared with future clients. Billing details never belong in public company projections. */
export const billingFields = [
 {key:'invoice_email',label:'E-post för fakturor',type:'email',max:254,required:true,autoComplete:'email'},
 {key:'address_line1',label:'Gatuadress eller box',type:'text',max:150,required:true,autoComplete:'address-line1'},
 {key:'address_line2',label:'Adressrad 2 (valfritt)',type:'text',max:150,required:false,autoComplete:'address-line2'},
 {key:'postal_code',label:'Postnummer',type:'text',max:6,required:true,autoComplete:'postal-code'},
 {key:'city',label:'Ort',type:'text',max:100,required:true,autoComplete:'address-level2'},
 {key:'reference',label:'Fakturareferens (valfritt)',type:'text',max:100,required:false,autoComplete:'off'},
] as const;
export type BillingKey = typeof billingFields[number]['key'];
export type BillingValues = Record<BillingKey,string>;
export type BillingErrors = Partial<Record<BillingKey,string>>;
export const emptyBilling: BillingValues = {invoice_email:'',address_line1:'',address_line2:'',postal_code:'',city:'',reference:''};
export function validateBilling(input: BillingValues): {value:BillingValues;errors:BillingErrors} {
 const value = {...emptyBilling},errors:BillingErrors = {};
 for (const field of billingFields) {
  const raw = input[field.key];
  if (typeof raw !== 'string' || /[\u0000-\u001f\u007f]/u.test(raw)) {errors[field.key]='Ange en giltig uppgift på en rad.';continue;}
  value[field.key]=raw.trim();
  if (value[field.key].length>field.max || (field.required&&!value[field.key])) errors[field.key]=field.required?'Fyll i en giltig uppgift.':'Uppgiften är för lång.';
 }
 value.invoice_email=value.invoice_email.toLowerCase();
 value.postal_code=value.postal_code.replace(/ /g,'');
 if (!/^[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+$/u.test(value.invoice_email)) errors.invoice_email='Ange en giltig e-postadress.';
 if (!/^\d{5}$/u.test(value.postal_code)) errors.postal_code='Ange fem siffror, exempelvis 123 45.';
 return {value,errors};
}
export type BillingRecord = {user_id:string;version:number;country_code:'SE'} & BillingValues;
export function parseBillingRecord(raw:unknown,userId:string):BillingRecord {
 if (!raw || typeof raw!=='object' || Array.isArray(raw)) throw new Error('Ogiltigt fakturaunderlag.');
 const row=raw as Record<string,unknown>;
 if(row.user_id!==userId || row.country_code!=='SE' || !Number.isInteger(row.version) || Number(row.version)<1 || Number(row.version)>2147483647) throw new Error('Ogiltigt fakturaunderlag.');
 const {value,errors}=validateBilling(row as BillingValues);
 if(Object.keys(errors).length) throw new Error('Ogiltigt fakturaunderlag.');
 return {...value,user_id:userId,version:Number(row.version),country_code:'SE'};
}
