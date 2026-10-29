import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire,Module} from 'node:module';
import ts from 'typescript';
import {createClient} from '@supabase/supabase-js';
const require=createRequire(import.meta.url),oldLoad=Module._load,oldTs=Module._extensions['.ts'];
Module._load=function(name,...args){return name==='server-only'?{}:oldLoad.call(this,name,...args);};
Module._extensions['.ts']=(m,f)=>m._compile(ts.transpileModule(readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,f);
const {reauthenticateAccount:verify,AccountReauthenticationError}=require('../lib/server/account-reauthentication.ts');
const subject='11111111-1111-4111-8111-111111111111',other='22222222-2222-4222-8222-222222222222',canary='QA_PRIVATE_RESPONSE';
let passed=0;
async function test(name,fn){await fn();passed++;console.log('PASS '+name);}
function fixture({initial,final,signIn,signOut}={}){
 const calls=[];let reads=0;
 const identity={id:subject,email:'qa@example.invalid'};
 const user={auth:{getUser:async()=>{calls.push('identity');reads++;return (reads===1?initial:final)?.()??{data:{user:identity},error:null};},signOut:async()=>{throw Error('Original client must not sign out');}}};
 const isolated={auth:{signInWithPassword:async input=>{calls.push(['password',input]);return signIn?.()??{data:{user:identity},error:null};},signOut:async options=>{calls.push(['cleanup',options]);return signOut?.()??{error:null};}}};
 return{user,isolated,calls};
}
const reject=(f,status,password='qa-password',expected=subject)=>assert.rejects(()=>verify(f.user,f.isolated,expected,password),e=>e instanceof AccountReauthenticationError&&e.status===status&&!e.message.includes(canary));
try{
 await test('successful verification cleans only isolated session before confirming original identity',async()=>{const f=fixture(),u=await verify(f.user,f.isolated,subject,'qa-password');assert.equal(u.id,subject);assert.deepEqual(f.calls,['identity',['password',{email:'qa@example.invalid',password:'qa-password'}],['cleanup',{scope:'local'}],'identity']);});
 for(const password of ['',null,{},'x'.repeat(1025)])await test('invalid password never reaches Auth: '+typeof password,async()=>{const f=fixture();await reject(f,400,password);assert.equal(f.calls.length,0);});
 await test('same client is rejected before any request',async()=>{const f=fixture();await assert.rejects(()=>verify(f.user,f.user,subject,'qa'),e=>e.status===502);assert.equal(f.calls.length,0);});
 await test('two wrappers sharing the same Auth client are rejected',async()=>{const f=fixture();await assert.rejects(()=>verify(f.user,{auth:f.user.auth},subject,'qa'),e=>e.status===502);assert.equal(f.calls.length,0);});
 for(const [name,value,status] of [['missing',null,401],['anonymous',{id:subject,is_anonymous:true},401],['switched',{id:other},409],['no email',{id:subject},403]])await test('initial identity rejected: '+name,async()=>{const f=fixture({initial:()=>({data:{user:value},error:null})});await reject(f,status);assert.deepEqual(f.calls,['identity']);});
 for(const [status,expected] of [[400,403],[429,429],[503,502],[undefined,502]])await test('safe upstream password failure: '+status,async()=>{const f=fixture({signIn:()=>({data:{user:null},error:{status,message:canary}})});await reject(f,expected);assert.equal(f.calls.length,2);});
 await test('thrown password transport failure is sanitized',async()=>{const f=fixture({signIn:()=>{throw Error(canary);}});await reject(f,502);});
 await test('wrong verified identity still cleans temporary session',async()=>{const f=fixture({signIn:()=>({data:{user:{id:other}},error:null})});await reject(f,403);assert.deepEqual(f.calls.at(-1),['cleanup',{scope:'local'}]);});
 for(const mode of ['error','throw'])await test('cleanup failure stops authorization: '+mode,async()=>{const f=fixture({signOut:()=>{if(mode==='throw')throw Error(canary);return{error:{message:canary}};}});await reject(f,502);assert.equal(f.calls.filter(c=>c==='identity').length,1);});
 for(const [name,value,error,status] of [['deleted',null,null,401],['revoked',{id:subject},{message:canary},401],['switched',{id:other},null,409],['email changed',{id:subject,email:'changed@example.invalid'},null,409]])await test('post-password identity change blocks authorization: '+name,async()=>{const f=fixture({final:()=>({data:{user:value},error})});await reject(f,status);assert.deepEqual(f.calls[2],['cleanup',{scope:'local'}]);});
 await test('installed SDK uses temporary token and local scope; original token survives both checks',async()=>{
  const calls=[],identity={id:subject,email:'qa@example.invalid',aud:'authenticated',role:'authenticated'};
  const transport=async(input,options)=>{const u=new URL(input),authorization=new Headers(options.headers).get('authorization');calls.push({path:u.pathname,scope:u.searchParams.get('scope'),authorization});
   if(u.pathname==='/auth/v1/user'){assert.equal(authorization,'Bearer qa-original');return Response.json(identity);}
   if(u.pathname==='/auth/v1/token'){assert.notEqual(authorization,'Bearer qa-original');assert.deepEqual(JSON.parse(options.body),{email:'qa@example.invalid',password:'qa-password',gotrue_meta_security:{}});return Response.json({access_token:'qa-temporary',refresh_token:'qa-refresh',expires_in:3600,token_type:'bearer',user:identity});}
   assert.equal(u.pathname,'/auth/v1/logout');assert.equal(authorization,'Bearer qa-temporary');assert.equal(u.searchParams.get('scope'),'local');return new Response(null,{status:204});};
  const options={auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},global:{fetch:transport}};
  const user=createClient('https://qa.example.invalid','qa-public',{...options,global:{...options.global,headers:{Authorization:'Bearer qa-original'}}}),isolated=createClient('https://qa.example.invalid','qa-public',options);
  assert.equal((await verify(user,isolated,subject,'qa-password')).id,subject);
  assert.equal((await isolated.auth.getSession()).data.session,null);
  assert.deepEqual(calls.map(c=>c.path),['/auth/v1/user','/auth/v1/token','/auth/v1/logout','/auth/v1/user']);
 });
 console.log(`PASS ${passed} fresh-account checks. Auth/HTTP simulated, including installed SDK. No live sessions created.`);
}finally{Module._load=oldLoad;if(oldTs)Module._extensions['.ts']=oldTs;else delete Module._extensions['.ts'];}
