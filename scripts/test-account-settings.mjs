import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire, Module } from 'node:module';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import ts from 'typescript';
import { createClient } from '@supabase/supabase-js';
const require=createRequire(import.meta.url),originalLoad=Module._load,originalFetch=globalThis.fetch,originalWindow=globalThis.window;
const originalConsoleError=console.error,sdkLogs=[];console.error=(...args)=>sdkLogs.push(args);
const oldUrl=process.env.NEXT_PUBLIC_SUPABASE_URL,oldKey=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
process.env.NEXT_PUBLIC_SUPABASE_URL='https://qa.invalid';process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY='test-only-public-key';
for(const ext of ['.ts','.tsx'])Module._extensions[ext]=(mod,file)=>mod._compile(ts.transpileModule(process.env.ACCOUNT_AUTH_REF&&file.endsWith('/lib/auth.ts')?execFileSync('git',['show',`${process.env.ACCOUNT_AUTH_REF}:lib/auth.ts`],{encoding:'utf8'}):readFileSync(file,'utf8'),{fileName:file,compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText,file);
const owner='11111111-1111-4111-8111-111111111111',other='22222222-2222-4222-8222-222222222222';
const user={id:owner,email:'qa@example.invalid',email_confirmed_at:'2026-01-01T00:00:00Z',app_metadata:{provider:'email'},user_metadata:{}};
const jwt=['eyJhbGciOiJIUzI1NiJ9',Buffer.from(JSON.stringify({sub:owner,exp:Math.floor(Date.now()/1000)+3600})).toString('base64url'),'test-only-signature'].join('.');
let actor=user,hook,signInStatus=200,updateStatus=200,cleanupStatus=204,wrongIdentity=false,readFails=false,throws=false;
let calls=[],clientOptions=[],sharedWrites=0;
const shared={auth:{getUser:async()=>{hook?.('identity');return{data:{user:actor},error:readFails?{status:503}:null};},signOut:async()=>{sharedWrites++;},signInWithPassword:async()=>{sharedWrites++;},updateUser:async()=>{sharedWrites++;}}};
globalThis.window={location:{origin:'https://dev.example.invalid'}};
globalThis.fetch=async(url,options)=>{
 const path=new URL(url),body=options.body?JSON.parse(options.body):undefined;calls.push({url:path,method:options.method,body,headers:new Headers(options.headers),signal:options.signal});
 const stage=path.pathname.endsWith('/token')?'verify':path.pathname.endsWith('/logout')?'cleanup':'update';hook?.(stage);
 if(throws&&stage==='verify')throw Error('PRIVATE TRANSPORT DETAIL');
 if(options.signal?.aborted&&stage!=='cleanup')throw new DOMException('Aborted','AbortError');
 const status=stage==='verify'?signInStatus:stage==='cleanup'?cleanupStatus:updateStatus;
 if(status>=400)return new Response(JSON.stringify({code:'unexpected_failure',msg:'PRIVATE AUTH DETAIL'}),{status,headers:{'Content-Type':'application/json'}});
 if(stage==='cleanup')return new Response(null,{status});
 const current={...user,id:wrongIdentity&&stage==='verify'?other:owner};
 const data=stage==='verify'?{access_token:jwt,refresh_token:'test-only-refresh',token_type:'bearer',expires_in:3600,user:current}:{...current,...(body.email?{new_email:body.email}:{})};
 return new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json','x-supabase-api-version':'2024-01-01'}});
};
Module._load=function(name,parent,...rest){
 if(name==='@/lib/supabase')return{getSupabaseClient:()=>shared};
 if(name==='@supabase/supabase-js')return{createClient:(url,key,options)=>{clientOptions.push(options);return createClient(url,key,options);}};
 return originalLoad.call(this,name.startsWith('@/')?path.resolve(name.slice(2)):name,parent,...rest);
};
const reset=()=>{actor=user;hook=undefined;signInStatus=200;updateStatus=200;cleanupStatus=204;wrongIdentity=false;readFails=false;throws=false;calls=[];clientOptions=[];};
const count=path=>calls.filter(c=>c.url.pathname.endsWith(path)).length;
try{
 const auth=require('../lib/auth.ts'),account=require('../lib/account-settings.ts');
 reset();const password=await auth.changePassword('test-only-current','test-only-new',{expectedUserId:owner});
 assert.equal(count('/logout'),1,'Successful password change must close its temporary verification session');assert.equal(password.cleanup,null);assert.equal(sharedWrites,0);
 assert.deepEqual(calls.find(c=>c.url.pathname.endsWith('/user')).body,{password:'test-only-new',code_challenge:null,code_challenge_method:null});assert.equal(calls.at(-1).url.searchParams.get('scope'),'local');
 assert.equal(clientOptions[0].auth.persistSession,false);assert.equal(clientOptions[0].auth.autoRefreshToken,false);assert.equal(clientOptions[0].auth.detectSessionInUrl,false);assert.ok(clientOptions[0].auth.storageKey.startsWith('mnw-account-check-'));
 for(const origin of ['https://dev.example.invalid','https://main.example.invalid','http://localhost:3000']){
  reset();globalThis.window.location.origin=origin;await account.requestAccountEmailChange('test-only-current',' NEW@EXAMPLE.INVALID ',{expectedUserId:owner});
  const request=calls.find(c=>c.url.pathname.endsWith('/user'));assert.deepEqual(request.body,{email:'new@example.invalid',code_challenge:null,code_challenge_method:null});assert.equal(request.url.searchParams.get('redirect_to'),origin+'/login');assert.equal(count('/logout'),1);
 }
 reset();hook=stage=>{if(stage==='verify')actor={...user,id:other};};await assert.rejects(account.changeAccountPassword('test-only-current','test-only-new',{expectedUserId:owner}),/Kontot har ändrats/);assert.equal(count('/user'),0);assert.equal(count('/logout'),1);
 reset();actor={...user,id:other};await assert.rejects(account.changeAccountPassword('test-only-current','test-only-new',{expectedUserId:owner}));assert.equal(calls.length,0);
 reset();wrongIdentity=true;await assert.rejects(account.changeAccountPassword('test-only-current','test-only-new'),/nuvarande/);assert.equal(count('/user'),0);assert.equal(count('/logout'),1);
 reset();signInStatus=400;await assert.rejects(account.changeAccountPassword('wrong','test-only-new'),err=>!err.message.includes('PRIVATE'));assert.equal(count('/user'),0);
 reset();readFails=true;await assert.rejects(account.changeAccountPassword('test-only-current','test-only-new'));assert.equal(calls.length,0);
 reset();await assert.rejects(account.requestAccountEmailChange('test-only-current','qa@example.invalid'),/annan e-post/);assert.equal(calls.length,0);
 for(const value of ['bad','x\ny@example.invalid','x@example.invalid '.repeat(50)]){reset();await assert.rejects(account.requestAccountEmailChange('test-only-current',value));assert.equal(calls.length,0);}
 reset();cleanupStatus=503;const partial=await account.changeAccountPassword('test-only-current','test-only-new');assert.ok(partial.cleanup);assert.equal(count('/user'),1);cleanupStatus=204;assert.equal(await partial.cleanup(),true);assert.equal(count('/user'),1,'Cleanup retry never repeats mutation');assert.equal(count('/logout'),2);
 reset();updateStatus=503;cleanupStatus=503;let failure;try{await account.requestAccountEmailChange('test-only-current','new@example.invalid');}catch(error){failure=error;}assert.ok(failure instanceof account.AccountSettingsError);assert.equal(failure.unconfirmed,true);assert.ok(failure.cleanup);assert.ok(!failure.message.includes('PRIVATE'));cleanupStatus=204;await failure.cleanup();assert.equal(count('/user'),1);
 reset();const cancelled=new AbortController();hook=stage=>{if(stage==='verify')cancelled.abort();};await assert.rejects(account.changeAccountPassword('test-only-current','test-only-new',{signal:cancelled.signal}));assert.equal(count('/user'),0); // SDK may return no session when token transport was cancelled.
 reset();const afterWrite=new AbortController();hook=stage=>{if(stage==='update')afterWrite.abort();};await assert.rejects(account.changeAccountPassword('test-only-current','test-only-new',{signal:afterWrite.signal}),err=>err.unconfirmed===true);assert.equal(count('/logout'),1);assert.equal(calls.at(-1).signal.aborted,false,'Local cleanup has an independent deadline after cancellation');
 reset();assert.deepEqual(await account.readAccountEmail(owner,new AbortController().signal),{email:user.email,pendingEmail:''});actor={...user,id:other,new_email:'PRIVATE@example.invalid'};await assert.rejects(account.readAccountEmail(owner,new AbortController().signal));assert.equal(sharedWrites,0);
 assert.ok(sdkLogs.every(args=>args.every(value=>!String(value).includes('PRIVATE'))),'SDK transport errors must be sanitized before its logging boundary');
 console.log('PASS actual account services + installed SDK with simulated HTTP: isolated password/email updates, same-account checks, pending-email request/redirects in three environments, denied/invalid/aborted/uncertain writes, local session cleanup and cleanup-only retries. No live email/settings claim.');
}finally{console.error=originalConsoleError;Module._load=originalLoad;globalThis.fetch=originalFetch;if(originalWindow===undefined)delete globalThis.window;else globalThis.window=originalWindow;if(oldUrl===undefined)delete process.env.NEXT_PUBLIC_SUPABASE_URL;else process.env.NEXT_PUBLIC_SUPABASE_URL=oldUrl;if(oldKey===undefined)delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;else process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY=oldKey;}
