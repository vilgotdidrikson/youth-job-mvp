import assert from 'node:assert/strict';
import {generateKeyPairSync,sign} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {createRequire,Module} from 'node:module';
import ts from 'typescript';
const require=createRequire(import.meta.url),oldLoad=Module._load,oldTs=Module._extensions['.ts'];
Module._load=function(n,...args){return n==='server-only'?{}:oldLoad.call(this,n,...args);};
Module._extensions['.ts']=(m,f)=>m._compile(ts.transpileModule(readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText,f);
const {verifyPersonalDataSession:verify,PersonalDataSessionError}=require('../lib/server/personal-data-session.ts');
const {createClient}=require('@supabase/supabase-js');
const subject='11111111-1111-4111-8111-111111111111',session='22222222-2222-4222-8222-222222222222',other='33333333-3333-4333-8333-333333333333';
let passed=0;
function fixture(){
 const calls=[],claims={sub:subject,session_id:session,role:'authenticated',exp:Math.floor(Date.now()/1000)+3600},user={id:subject};
 const state={claims,user,active:true,claimsError:null,userError:null,rpcError:null};
 const client={auth:{getClaims:async token=>{calls.push('claims');assert.equal(token,'qa-token');return{data:{claims:state.claims},error:state.claimsError};},getUser:async token=>{calls.push('user');assert.equal(token,'qa-token');return{data:{user:state.user},error:state.userError};}}};
 const privileged={auth:{},rpc(name,args){calls.push('rpc');assert.equal(name,'is_personal_data_session_active');assert.deepEqual(args,{p_subject_id:subject,p_session_id:session});return{abortSignal(signal){assert.ok(signal instanceof AbortSignal);return Promise.resolve({data:state.active,error:state.rpcError});}};}};
 return{state,calls,client,privileged,run:signal=>verify(client,privileged,subject,'qa-token',signal)};
}
async function test(name,fn){await fn();passed++;console.log('PASS '+name);}
try{
 await test('valid live session returns only session ID and runs signature, identity, row checks in order',async()=>{const f=fixture();assert.equal(await f.run(),session);assert.deepEqual(f.calls,['claims','user','rpc']);});
 for(const [field,value] of [['sub',other],['session_id',null],['session_id','QA_PRIVATE'],['role','service_role'],['is_anonymous',true],['exp',0],['exp',Infinity],['exp','9999999999']])await test('unsafe verified claims block later reads: '+field+'/'+value,async()=>{const f=fixture();f.state.claims[field]=value;await assert.rejects(f.run(),e=>e.code==='invalid_session');assert.deepEqual(f.calls,['claims']);});
 for(const mode of ['no claims','signature error','different live user','anonymous user','deleted user','Auth error'])await test('claims/live identity failure: '+mode,async()=>{
  const f=fixture();if(mode==='no claims')f.state.claims=null;if(mode==='signature error')f.state.claimsError={message:'QA_PRIVATE'};if(mode==='different live user')f.state.user.id=other;if(mode==='anonymous user')f.state.user.is_anonymous=true;if(mode==='deleted user')f.state.user=null;if(mode==='Auth error')f.state.userError={message:'QA_PRIVATE'};
  await assert.rejects(f.run(),e=>e instanceof PersonalDataSessionError&&!e.message.includes('QA_PRIVATE'));assert.ok(!f.calls.includes('rpc'));
 });
 for(const response of [false,null,'true',1,{},[true]])await test('only literal true from service RPC permits export: '+JSON.stringify(response),async()=>{const f=fixture();f.state.active=response;await assert.rejects(f.run(),e=>e.code==='invalid_session');});
 await test('database error is sanitized and blocks export',async()=>{const f=fixture();f.state.rpcError={message:'QA_PRIVATE'};await assert.rejects(f.run(),e=>e.code==='unavailable'&&!e.message.includes('QA_PRIVATE'));});
 await test('throwing Auth transport is sanitized',async()=>{const f=fixture();f.client.auth.getClaims=async()=>{throw Error('QA_PRIVATE');};await assert.rejects(f.run(),e=>e.code==='unavailable'&&!e.message.includes('QA_PRIVATE'));});
 for(const mode of ['same client','same auth','missing service'])await test('service separation enforced: '+mode,async()=>{const f=fixture(),service=mode==='same client'?f.client:mode==='same auth'?{...f.privileged,auth:f.client.auth}:undefined;await assert.rejects(verify(f.client,service,subject,'qa-token'),e=>e.code==='unavailable');assert.equal(f.calls.length,0);});
 for(const [id,token] of [['bad','qa-token'],[subject,''],[subject,'x'.repeat(16385)]])await test('invalid input performs no requests: '+id+'/'+token.length,async()=>{const f=fixture();await assert.rejects(verify(f.client,f.privileged,id,token),e=>e.code==='invalid_session');assert.equal(f.calls.length,0);});
 await test('pre-cancelled check does no work',async()=>{const f=fixture(),c=new AbortController();c.abort();await assert.rejects(f.run(c.signal),e=>e.code==='cancelled');assert.equal(f.calls.length,0);});
 for(const stage of ['claims','user','rpc'])await test('cancellation discards hanging/late '+stage+' response',async()=>{
  const f=fixture(),c=new AbortController();let release;
  const hanging=()=>new Promise(resolve=>{release=resolve;setTimeout(()=>c.abort(),1);});
  if(stage==='claims')f.client.auth.getClaims=hanging;if(stage==='user')f.client.auth.getUser=hanging;if(stage==='rpc')f.privileged.rpc=()=>({abortSignal:hanging});
  await assert.rejects(f.run(c.signal),e=>e.code==='cancelled');release({data:true,error:null});await Promise.resolve();if(stage!=='rpc')assert.ok(!f.calls.includes('rpc'));
 });
 const keys=generateKeyPairSync('ec',{namedCurve:'P-256'}),jwk={...keys.publicKey.export({format:'jwk'}),kid:'qa-session-key',alg:'ES256',use:'sig'};
 function jwt(payload,key=keys.privateKey){const part=x=>Buffer.from(JSON.stringify(x)).toString('base64url'),data=part({alg:'ES256',kid:jwk.kid,typ:'JWT'})+'.'+part(payload);return data+'.'+sign('sha256',Buffer.from(data),{key,dsaEncoding:'ieee-p1363'}).toString('base64url');}
 async function sdkRun({badSignature=false,revoked=false,expired=false}={}){
  const claims={sub:subject,session_id:session,role:'authenticated',aud:'authenticated',iss:'https://qa.invalid/auth/v1',exp:Math.floor(Date.now()/1000)+(expired?-1:3600)},foreignKeys=badSignature?generateKeyPairSync('ec',{namedCurve:'P-256'}):null,token=jwt(claims,foreignKeys?.privateKey),calls=[];
  const transport=async(input,init)=>{
   const url=String(input),headers=new Headers(init?.headers);calls.push(url);
   if(url.endsWith('/.well-known/jwks.json'))return Response.json({keys:[jwk]});
   if(url.endsWith('/auth/v1/user')){assert.equal(headers.get('authorization'),'Bearer '+token);return Response.json({id:subject,email:'qa@example.invalid',aud:'authenticated'});}
   if(url.endsWith('/rest/v1/rpc/is_personal_data_session_active')){assert.equal(headers.get('authorization'),'Bearer qa-service');assert.deepEqual(JSON.parse(init.body),{p_subject_id:subject,p_session_id:session});assert.ok(init.signal instanceof AbortSignal);return Response.json(!revoked);}
   throw Error('Unexpected URL '+url);
  };
  const client=createClient('https://qa.invalid','qa-public',{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},global:{headers:{Authorization:'Bearer '+token},fetch:transport}}),service=createClient('https://qa.invalid','qa-service',{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},global:{fetch:transport}});
  return{result:verify(client,service,subject,token),calls};
 }
 await test('installed SDK verifies actual ES256 signature and sends explicit request token plus fixed service RPC',async()=>{const f=await sdkRun();assert.equal(await f.result,session);assert.equal(f.calls.filter(u=>u.endsWith('/auth/v1/user')).length,1);assert.equal(f.calls.filter(u=>u.includes('/rpc/')).length,1);});
 await test('installed SDK rejects cryptographically wrong signature before identity/database read',async()=>{const f=await sdkRun({badSignature:true});await assert.rejects(f.result);assert.ok(!f.calls.some(u=>u.endsWith('/auth/v1/user')||u.includes('/rpc/')));});
 await test('installed SDK rejects expired signed token without any request',async()=>{const f=await sdkRun({expired:true});await assert.rejects(f.result);assert.equal(f.calls.length,0);});
 await test('correctly signed unexpired JWT still fails when database session is revoked',async()=>{const f=await sdkRun({revoked:true});await assert.rejects(f.result,e=>e.code==='invalid_session');assert.ok(f.calls.some(u=>u.includes('/rpc/')));});
 console.log(`PASS ${passed} export session checks. Local cryptographic verification and simulated HTTP; no real Auth sessions.`);
}finally{Module._load=oldLoad;if(oldTs)Module._extensions['.ts']=oldTs;else delete Module._extensions['.ts'];}
