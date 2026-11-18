import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire, Module } from 'node:module';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import ts from 'typescript';
import { createClient } from '@supabase/supabase-js';
const require=createRequire(import.meta.url),originalLoad=Module._load,oldFetch=globalThis.fetch,oldConsole=console.error;
const oldUrl=process.env.NEXT_PUBLIC_SUPABASE_URL,oldKey=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
process.env.NEXT_PUBLIC_SUPABASE_URL='https://qa.invalid';process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY='test-only-public-key';
for(const ext of ['.ts','.tsx'])Module._extensions[ext]=(mod,file)=>mod._compile(ts.transpileModule(process.env.TOTP_BASELINE&&file.endsWith('/lib/account-settings.ts')?execFileSync('git',['show',`${process.env.TOTP_BASELINE}:lib/account-settings.ts`],{encoding:'utf8'}):readFileSync(file,'utf8'),{fileName:file,compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText,file);
const owner='11111111-1111-4111-8111-111111111111',other='22222222-2222-4222-8222-222222222222',factorId='33333333-3333-4333-8333-333333333333',sessionId='44444444-4444-4444-8444-444444444444';
const tokenExpiry=Math.floor(Date.now()/1000)+3600;
const temporarySessionId='55555555-5555-4555-8555-555555555555';
const token=(aal,id=sessionId)=>['eyJhbGciOiJIUzI1NiJ9',Buffer.from(JSON.stringify({sub:owner,session_id:id,aal,exp:tokenExpiry})).toString('base64url'),'test-only-signature'].join('.');
let actor=owner,factors=[],calls=[],hook,secretOutput,verifyFails=false,loseVerifyReply=false,deleteFails=false,closeFails=false,serverOK=true,sharedWrites=0,sharedRevoked=false,sharedClient;
const user=()=>({id:owner,email:'qa@example.invalid',factors:[...factors]});
const shared={auth:{
 getUser:async()=>sharedRevoked?{data:{user:null},error:{status:401}}:{data:{user:{...user(),id:actor}},error:null},
 getSession:()=>sharedClient.auth.getSession(),
 get mfa(){return sharedClient.auth.mfa;},
 updateUser:(...args)=>sharedClient.auth.updateUser(...args),
 setSession:async()=>{sharedWrites++;},signOut:async()=>{sharedWrites++;}
}};
const logs=[];console.error=(...args)=>logs.push(args);
globalThis.fetch=async(url,init={})=>{
 const address=String(url);const parsed=address.startsWith('/')?new URL(address,'https://app.invalid'):new URL(address);const body=init.body?JSON.parse(init.body):null;
 calls.push({path:parsed.pathname,method:init.method??'GET',body,headers:new Headers(init.headers),signal:init.signal,query:parsed.searchParams});
 hook?.(parsed.pathname,init);
 let result,status=200;
 if(parsed.pathname==='/api/account/mfa-session')return new Response(JSON.stringify({verified:serverOK}),{status:serverOK?200:503});
 if(parsed.pathname.endsWith('/token'))result={access_token:token('aal1',temporarySessionId),refresh_token:'test-only-refresh',expires_in:3600,token_type:'bearer',user:user()};
 else if(parsed.pathname.endsWith('/factors')&&init.method==='POST'){factors.push({id:factorId,factor_type:'totp',status:'unverified',friendly_name:'QA'});result={id:factorId,type:'totp',totp:{secret:'TESTONLYBASE32SECRET',qr_code:'<svg xmlns="http://www.w3.org/2000/svg"></svg>',uri:'otpauth://totp/test-only'}};}
 else if(parsed.pathname.endsWith('/challenge'))result={id:'qa-challenge',expires_at:Math.floor(Date.now()/1000)+60,type:'totp'};
 else if(parsed.pathname.endsWith('/verify')){
  if(verifyFails||body.code!=='123456'){status=422;result={code:'mfa_verification_failed',msg:'PRIVATE OTP DETAIL'};}
  else{const caller=new Headers(init.headers).get('authorization');
   // GoTrue revokes other lower-assurance sessions when this one is upgraded.
   if(caller===`Bearer ${token('aal1',temporarySessionId)}`)sharedRevoked=true;
   factors=factors.map(f=>f.id===factorId?{...f,status:'verified'}:f);
   result={access_token:token('aal2',sharedRevoked?temporarySessionId:sessionId),refresh_token:'test-only-refresh-2',expires_in:3600,token_type:'bearer',user:user()};if(loseVerifyReply)throw new TypeError('Failed to fetch');}
 }
 else if(parsed.pathname.endsWith('/logout')){status=closeFails?503:204;result={};}
 else if(init.method==='DELETE'){if(deleteFails){status=503;result={msg:'PRIVATE DELETE'};}else{factors=factors.filter(f=>f.id!==factorId);result={id:factorId};}}
 else if(parsed.pathname.endsWith('/user')&&init.method==='PUT')result=user();
 else if(parsed.pathname.endsWith('/user'))result=user();
 else throw Error('Unexpected fake endpoint '+parsed.pathname);
 return new Response(status===204?null:JSON.stringify(result),{status,headers:{'Content-Type':'application/json','x-supabase-api-version':'2024-01-01'}});
};
Module._load=function(name,parent,...rest){if(name==='@/lib/supabase')return{getSupabaseClient:()=>shared};if(name==='@supabase/supabase-js')return{createClient};return originalLoad.call(this,name.startsWith('@/')?path.resolve(name.slice(2)):name,parent,...rest);};
const reset=async()=>{actor=owner;factors=[];calls=[];hook=undefined;verifyFails=false;loseVerifyReply=false;deleteFails=false;closeFails=false;serverOK=true;sharedRevoked=false;
 sharedClient=createClient('https://qa.invalid','test-only-public-key',{auth:{persistSession:false,autoRefreshToken:false,storageKey:'shared-test-session'}});
 const result=await sharedClient.auth.setSession({access_token:token('aal1'),refresh_token:'test-only-current-refresh'});
 assert.equal(result.error,null);
 calls=[];
};
const count=part=>calls.filter(c=>c.path.endsWith(part)).length;
try{
 const {createTotpInstallation,readAccountTotp}=require('../lib/account-mfa.ts');const {changeAccountPassword,requestAccountEmailChange}=require('../lib/account-settings.ts');
 if(process.env.TOTP_BASELINE){await reset();factors=[{id:factorId,factor_type:'totp',status:'verified'}];await assert.rejects(changeAccountPassword('test-only-password','test-only-new-password',{expectedUserId:owner}),/sexsiffrig/);}
 await reset();const installing=createTotpInstallation(owner);const pending=await installing.begin('test-only-password');secretOutput=pending;assert.ok(pending.qrCode.startsWith('data:image/svg+xml;utf-8,'));assert.equal(pending.secret,'TESTONLYBASE32SECRET');assert.equal(factors[0].status,'unverified');assert.equal(calls.find(c=>c.path.endsWith('/factors')).body.factor_type,'totp');assert.equal(sharedWrites,0);
 const confirmed=await installing.confirm('123456');assert.equal(confirmed.cleanup,null);assert.equal(confirmed.serverVerified,true);assert.equal(factors[0].status,'verified');assert.equal(calls.find(c=>c.path.endsWith('/logout')).query.get('scope'),'local');assert.equal(count('/logout'),1);assert.equal(sharedRevoked,false);assert.equal(calls.filter(c=>c.method==='DELETE').length,0);const proof=calls.find(c=>c.path==='/api/account/mfa-session');assert.equal(proof.headers.get('x-account-id'),owner);assert.ok(proof.headers.get('authorization').endsWith(token('aal2')));assert.equal(sharedWrites,0,'Never replace/sign out the shared session');installing.stop();
 await reset();const cancelled=createTotpInstallation(owner);await cancelled.begin('test-only-password');assert.equal(await cancelled.cancel(),true);assert.equal(factors.length,0);assert.equal(calls.filter(c=>c.method==='DELETE').length,1);cancelled.stop();
 await reset();const failed=createTotpInstallation(owner);await failed.begin('test-only-password');verifyFails=true;await assert.rejects(failed.confirm('000000'));await failed.cancel();assert.equal(calls.filter(c=>c.method==='DELETE').length,0,'Once verification has been attempted, cleanup must not risk deleting a verified factor');failed.stop();
 await reset();const lost=createTotpInstallation(owner);await lost.begin('test-only-password');loseVerifyReply=true;await assert.rejects(lost.confirm('123456'));assert.equal(factors[0].status,'verified');await lost.cancel();assert.equal(factors[0].status,'verified');assert.equal(calls.filter(c=>c.method==='DELETE').length,0);lost.stop();
 await reset();const closed=createTotpInstallation(owner);closeFails=true;let blockedCleanup;await assert.rejects(closed.begin('test-only-password'),err=>{blockedCleanup=err.cleanup;return Boolean(blockedCleanup);});assert.equal(count('/factors'),0);closeFails=false;assert.equal(await blockedCleanup(),true);closed.stop();
 await reset();const blocked=createTotpInstallation(owner);actor=other;await assert.rejects(blocked.begin('test-only-password'));assert.equal(count('/factors'),0);blocked.stop();
 await reset();const changed=createTotpInstallation(owner);await changed.begin('test-only-password');actor=other;await assert.rejects(changed.confirm('123456'));assert.equal(count('/challenge'),0);await changed.cancel();changed.stop();
 await reset();const stop=createTotpInstallation(owner);hook=path=>{if(path.endsWith('/token'))stop.stop();};await assert.rejects(stop.begin('test-only-password'));assert.equal(count('/factors'),0,'Stopped proof cannot start enrollment');assert.equal(sharedWrites,0);
 await reset();factors=[{id:factorId,factor_type:'totp',status:'verified'}];await assert.rejects(changeAccountPassword('test-only-password','test-only-new-password',{expectedUserId:owner}),/sexsiffrig/);assert.equal(calls.some(c=>c.method==='PUT'),false);assert.equal(count('/logout'),1);
 calls=[];await changeAccountPassword('test-only-password','test-only-new-password',{expectedUserId:owner,totpCode:'123456'});assert.equal(count('/verify'),1);assert.equal(calls.filter(c=>c.method==='PUT').length,1);assert.ok(calls.find(c=>c.method==='PUT').headers.get('authorization').endsWith(token('aal2')));assert.equal(sharedWrites,0);assert.equal(sharedRevoked,false);
 await reset();factors=[{id:factorId,factor_type:'totp',status:'verified'}];
 await requestAccountEmailChange('test-only-password','new@example.invalid',{expectedUserId:owner,totpCode:'123456'});
 assert.equal(sharedRevoked,false);assert.equal(count('/logout'),1);
 assert.equal(calls.find(c=>c.method==='PUT').body.email,'new@example.invalid');
 assert.equal(calls.find(c=>c.method==='PUT').headers.get('authorization'),`Bearer ${token('aal2')}`);
 assert.ok(calls.findIndex(c=>c.path.endsWith('/logout')) < calls.findIndex(c=>c.path.endsWith('/verify')));
 const sig=new AbortController().signal;assert.equal(await readAccountTotp(owner,sig),true);actor=other;await assert.rejects(readAccountTotp(owner,sig));
 assert.ok(logs.every(args=>args.every(value=>!String(value).includes('PRIVATE')&&!String(value).includes(secretOutput.secret))));
 console.log('PASS actual TOTP/controller/account services through installed SDK with simulated HTTP: password-bound enrollment/QR, own code confirmation, active-session AAL2 and email/password updates, cancellation, owner/stop guards, lost verification reply, no verified-factor deletion, local cleanup retries and server-proof request. No real factors/secrets/accounts created.');
}finally{Module._load=originalLoad;globalThis.fetch=oldFetch;console.error=oldConsole;if(oldUrl===undefined)delete process.env.NEXT_PUBLIC_SUPABASE_URL;else process.env.NEXT_PUBLIC_SUPABASE_URL=oldUrl;if(oldKey===undefined)delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;else process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY=oldKey;}
