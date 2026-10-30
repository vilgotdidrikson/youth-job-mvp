import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire,Module} from 'node:module';
import ts from 'typescript';
const require=createRequire(import.meta.url),oldLoad=Module._load,oldTs=Module._extensions['.ts'];
Module._extensions['.ts']=(m,f)=>m._compile(ts.transpileModule(readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText,f);
const id='11111111-1111-4111-8111-111111111111',other='22222222-2222-4222-8222-222222222222';
let calls=[],role='youth',reauth,collect,cv,session,finalUser,passed=0;
const sid='33333333-3333-4333-8333-333333333333';
const client={auth:{getUser:async()=>{calls.push('final');return{data:{user:finalUser},error:null};}}},verification={},privileged={};
const pending=()=>({subjectId:id,reviewState:'pending',categories:[{sources:[{relation:'public.profiles',status:'collected',rows:[{id,role}]}]}]});
Module._load=function(name,parent,...args){if(name==='server-only')return{};if(parent?.filename.endsWith('personal-data-review.ts')){
 if(name==='./personal-data-session')return{verifyPersonalDataSession:async(u,p,subject,token,signal)=>{calls.push('session');assert.equal(u,client);assert.equal(p,privileged);assert.equal(subject,id);assert.equal(token,'qa-token');assert.ok(signal instanceof AbortSignal);return session?.()??sid;},PersonalDataSessionError:class extends Error{}};
 if(name==='./account-reauthentication')return{reauthenticateAccount:async(...args)=>{calls.push('reauth');assert.equal(args[0],client);assert.equal(args[1],verification);assert.equal(args[2],id);return reauth?.();},AccountReauthenticationError:class extends Error{}};
 if(name==='./personal-data-collection')return{collectPersonalDataForReview:async(u,subject,signal,review)=>{calls.push('collect');assert.equal(u,client);assert.equal(subject,id);assert.ok(signal instanceof AbortSignal);assert.equal(review,privileged);return collect?.()??pending();}};
 if(name==='./personal-data-cv-binding')return{collectAccountCvFiles:async(u,subject,signal)=>{calls.push('cv');assert.equal(u,client);assert.equal(subject,id);assert.ok(signal instanceof AbortSignal);return cv?.()??{files:[],reviewState:'pending'};}};
 }return oldLoad.call(this,name,parent,...args);};
const modulePath=require.resolve('../lib/server/personal-data-review.ts');
const {preparePersonalDataReview:prepare,PersonalDataReviewError}=require(modulePath);
const reset=()=>{calls=[];role='youth';reauth=collect=cv=session=undefined;finalUser={id};};
const run=signal=>prepare(client,verification,id,'qa-password',{reviewClient:privileged,sessionClient:privileged,accessToken:'qa-token',signal});
async function test(name,fn){reset();await fn();passed++;console.log('PASS '+name);}
try{
 await test('authentication gates collection, CV and final check; material remains pending',async()=>{const r=await run();assert.deepEqual(calls,['session','reauth','collect','cv','final','session']);assert.equal(r.reviewState,'pending');assert.equal(r.consistency,'non_transactional');assert.equal(r.cvScope,'account_cv_references');});
 for(const r of ['company','private'])await test('no youth CV query for role '+r,async()=>{role=r;const result=await run();assert.equal(result.cv,null);assert.equal(result.cvScope,'not_requested_for_role');assert.deepEqual(calls,['session','reauth','collect','final','session']);});
 for(const stage of ['session','reauth','collect','cv'])await test('failed '+stage+' blocks later stages and sanitizes raw errors',async()=>{const fail=()=>{throw Error('QA_PRIVATE');};if(stage==='session')session=fail;if(stage==='reauth')reauth=fail;if(stage==='collect')collect=fail;if(stage==='cv')cv=fail;await assert.rejects(run(),e=>e instanceof PersonalDataReviewError&&!e.message.includes('QA_PRIVATE'));assert.equal(calls.at(-1),stage);});
 for(const mode of ['other subject','no profile','bad role'])await test('invalid collected identity/role stops CV: '+mode,async()=>{collect=()=>{const p=pending();if(mode==='other subject')p.subjectId=other;if(mode==='no profile')p.categories=[];if(mode==='bad role')p.categories[0].sources[0].rows[0].role='admin';return p;};await assert.rejects(run());assert.deepEqual(calls,['session','reauth','collect']);});
 for(const value of [null,{id:other},{id,is_anonymous:true}])await test('final invalid identity discards assembled bytes',async()=>{finalUser=value;await assert.rejects(run(),e=>e.code==='identity_changed');});
 await test('pre-cancelled operation does no work',async()=>{const c=new AbortController();c.abort();await assert.rejects(run(c.signal),e=>e.code==='cancelled');assert.equal(calls.length,0);});
 await test('late session verification result after cancellation never starts collection',async()=>{let resolve;session=()=>new Promise(r=>{resolve=r;});const c=new AbortController(),p=run(c.signal);c.abort();await assert.rejects(p,e=>e.code==='cancelled');resolve();await Promise.resolve();assert.deepEqual(calls,['session']);});
 await test('cancelling a hanging file read returns no partial bundle',async()=>{cv=()=>new Promise(()=>{});const c=new AbortController(),p=run(c.signal);setTimeout(()=>c.abort(),5);await assert.rejects(p,e=>e.code==='cancelled');assert.ok(!calls.includes('final'));});
 await test('session revoked after collection discards completed bundle',async()=>{let n=0;session=()=>{if(++n===2)throw Error('QA_PRIVATE');return sid;};await assert.rejects(run());assert.equal(calls.at(-1),'session');});
 await test('session identity changes during collection discard bundle',async()=>{let n=0;session=()=>++n===1?sid:other;await assert.rejects(run(),e=>e.code==='identity_changed');});
 // Run the actual orchestrator AND all its actual helpers with simulated Auth/Data/Storage.
 await test('real helper integration assembles actual own profile and PDF after password cleanup',async()=>{
  Module._load=function(name,...args){return name==='server-only'?{}:oldLoad.call(this,name,...args);};delete require.cache[modulePath];
  const real=require(modulePath).preparePersonalDataReview,steps=[],docs=[{type:'cv',url:id+'/cv.pdf'}];
  const user={auth:{getClaims:async token=>{assert.equal(token,'qa-token');return{data:{claims:{sub:id,session_id:sid,role:'authenticated',exp:Math.floor(Date.now()/1000)+3600}},error:null};},getUser:async()=>({data:{user:{id,email:'qa@example.invalid'}},error:null})},from(table){const q={columns:'',single:false};return{select(v){q.columns=v;return this;},eq(){return this;},or(){return this;},order(){return this;},limit(){return this;},gt(){return this;},abortSignal(){return this;},maybeSingle(){q.single=true;return this;},then(resolve,reject){steps.push(table);let rows=[];if(table==='profiles')rows=[{id,role:'youth'}];if(table==='youth_profiles')rows=[Object.fromEntries(q.columns.split(',').map(k=>[k,k==='user_id'?id:k==='documents'?docs:null]))];return Promise.resolve({data:q.single?rows[0]??null:rows,error:null}).then(resolve,reject);}};},storage:{from(bucket){assert.equal(bucket,'youth-documents');return{download:async path=>{assert.equal(path,id+'/cv.pdf');steps.push('download');return{data:new Blob(['%PDF-1.7\nÅsa']),error:null};}};}}};
  const isolated={auth:{signInWithPassword:async()=>{steps.push('password');return{data:{user:{id}},error:null};},signOut:async options=>{assert.equal(options.scope,'local');steps.push('cleanup');return{error:null};}}};
  const sessionClient={rpc(name,args){assert.equal(name,'is_personal_data_session_active');assert.deepEqual(args,{p_subject_id:id,p_session_id:sid});return{abortSignal:()=>Promise.resolve({data:true,error:null})};}};
  const r=await real(user,isolated,id,'qa-password',{sessionClient,accessToken:'qa-token'});assert.deepEqual(steps.slice(0,2),['password','cleanup']);assert.equal(r.collection.categories.flatMap(c=>c.sources).filter(s=>s.status==='collected').length,34);assert.equal(r.cv.files[0].status,'included');assert.equal(new TextDecoder().decode(r.cv.files[0].bytes),'%PDF-1.7\nÅsa');assert.equal(r.reviewState,'pending');
 });
 console.log(`PASS ${passed} review orchestration checks; no live accounts or storage used.`);
}finally{Module._load=oldLoad;if(oldTs)Module._extensions['.ts']=oldTs;else delete Module._extensions['.ts'];}
