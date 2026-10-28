"use client";
import {getSupabaseClient} from './supabase';

export class AccountDeletionError extends Error {
 constructor(message:string,public readonly uncertain=false) {super(message);this.name='AccountDeletionError';}
}
/** A checked session snapshot supplies the token; the server independently checks
 * its user against expectedUserId before any reauthentication or destructive work. */
export async function deleteOwnAccount(expectedUserId:string,password:string,signal:AbortSignal):Promise<void> {
 signal.throwIfAborted();
 const {data,error}=await getSupabaseClient().auth.getSession();
 signal.throwIfAborted();
 const session=data.session;
 if(error||!session?.access_token||session.user?.id!==expectedUserId) throw new AccountDeletionError('Kontot eller sessionen har ändrats. Logga in på rätt konto igen.');
 let response:Response;
 try {
  response=await fetch('/api/account',{method:'DELETE',headers:{Authorization:`Bearer ${session.access_token}`,'Content-Type':'application/json'},body:JSON.stringify({password,expectedUserId}),signal});
 } catch {throw new AccountDeletionError('Raderingens resultat kunde inte bekräftas. Kontrollera kontot genom att logga in igen innan du gör ett nytt försök.',true);}
 signal.throwIfAborted();
 if(response.status===204) return;
 const result=await response.json().catch(()=>null) as {error?:unknown}|null;
 const message=typeof result?.error==='string'?result.error:'Kontot kunde inte raderas.';
 throw new AccountDeletionError(message,response.status>=500||response.status<400);
}
