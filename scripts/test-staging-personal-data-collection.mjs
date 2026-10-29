// Fixed DevStaging target. Only fictitious accounts; no service-role key or SQL.
import assert from 'node:assert/strict';
import {randomBytes,randomUUID} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {createRequire,Module} from 'node:module';
import ts from 'typescript';
import {createClient} from '@supabase/supabase-js';
const require=createRequire(import.meta.url),oldLoad=Module._load,oldTs=Module._extensions['.ts'];
Module._load=function(id,...rest){return id==='server-only'?{}:oldLoad.call(this,id,...rest);};
Module._extensions['.ts']=(m,f)=>m._compile(ts.transpileModule(readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText,f);
const {collectPersonalDataForReview:collect}=require('../lib/server/personal-data-collection.ts');
const base='https://vwcfjvwfeatvuisojwrh.supabase.co',app='https://youth-job-mvp-dev.vercel.app',key=process.env.MNW_COLLECTION_ANON_KEY;
assert.ok(key,'MNW_COLLECTION_ANON_KEY must contain the public DevStaging key.');
const legacy=key.startsWith('sb_publishable_')?null:JSON.parse(Buffer.from(key.split('.')[1]??'','base64url').toString());
assert.ok(key.startsWith('sb_publishable_')||(legacy?.role==='anon'&&legacy?.ref==='vwcfjvwfeatvuisojwrh'),'Only a public DevStaging key is permitted.');
const password=randomBytes(24).toString('base64url'),prefix=`qa-l13-collection-${Date.now()}-${randomUUID().slice(0,8)}`,accounts=[];
let passed=0,step='prepare';const observations=[];
const check=(ok,label)=>{assert.ok(ok,label);passed++;};
const source=(x,table)=>x.categories.flatMap(c=>c.sources).find(s=>s.relation==='public.'+table);
const timings=[];
const boundedFetch=async(url,options={})=>{const start=Date.now(),label=new URL(url).pathname.split('/').at(-1);try{const result=await fetch(url,{...options,signal:options.signal?AbortSignal.any([options.signal,AbortSignal.timeout(25000)]):AbortSignal.timeout(25000)});timings.push({source:label,status:result.status,ms:Date.now()-start});return result;}catch(error){timings.push({source:label,status:'transport_failed',ms:Date.now()-start});throw error;}};
const client=token=>createClient(base,key,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},global:{fetch:boundedFetch,...(token?{headers:{Authorization:`Bearer ${token}`}}:{})}});
async function request(url,method,body,token){return fetch(url,{method,headers:{apikey:key,'content-type':'application/json',...(token?{Authorization:`Bearer ${token}`}:{})},body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(25000)});}
try {
 for(const [i,role] of ['youth','youth','company'].entries()){
  step='create fixture '+i;const email=`${prefix}-${i}@example.invalid`,r=await request(base+'/auth/v1/signup','POST',{email,password,data:{role}}),data=await r.json();
  if(data.user?.id)accounts.push({id:data.user.id,token:data.access_token,email,role,deleted:false});
  check(r.ok&&!!data.access_token,'fictitious account created with session');
 }
 for(const [i,a] of accounts.entries()){
  step='seed own session '+i;a.client=client(a.token);
  if(a.role==='youth'){
   a.session=randomUUID();const s=await a.client.from('ai_onboarding_sessions').insert({id:a.session,youth_user_id:a.id,status:i===0?'completed':'in_progress'});check(!s.error,'own fictitious CV session inserted');
   const messages=Array.from({length:i===0?105:1},(_,n)=>({id:randomUUID(),session_id:a.session,sender:'user',message_text:`${i===0?'QA_OWN':'QA_OTHER'} ${n} Åsa kan inte måndagar 🧑‍🍳`}));
   const m=await a.client.from('ai_onboarding_messages').insert(messages);check(!m.error,'own fictitious CV messages inserted');
  } else {
   const r=await a.client.rpc('save_company_billing_details',{p_owner_id:a.id,p_expected_version:null,p_details:{invoice_email:'qa-billing@example.invalid',address_line1:'QA Testgatan 1',address_line2:'',postal_code:'12345',city:'QA Teststad',reference:'QA_OWN_BILLING'}});check(!r.error,'own fictitious billing inserted');
  }
 }
 for(const a of accounts){
  step='collect '+a.role;console.log('CHECK '+step);const started=Date.now(),x=await collect(a.client,a.id);observations.push({role:a.role,collectionMs:Date.now()-started,unavailable:x.categories.flatMap(c=>c.sources).filter(s=>s.status==='unavailable').map(s=>({relation:s.relation,reason:s.reason}))});check(x.subjectId===a.id&&x.reviewState==='pending','server-checked own identity and pending review');check(x.categories.length===24&&x.categories.flatMap(c=>c.sources).length===85,'all inventory categories/relations represented');
  check(source(x,'profiles').status==='collected'&&source(x,'profiles').rows.length===1&&source(x,'profiles').rows[0].id===a.id,'own role profile only');
  const sessions=source(x,'ai_onboarding_sessions'),messages=source(x,'ai_onboarding_messages');check(sessions.status==='collected'&&messages.status==='collected','CV source reads succeed under actual RLS');
  check(sessions.rows.length===(a.role==='youth'?1:0),'own session scope');check(messages.rows.length===(a===accounts[0]?105:a.role==='youth'?1:0),'full own CV message history including second page');
  if(a===accounts[0])check(messages.rows.every(r=>r.message_text.startsWith('QA_OWN')&&r.message_text.includes('kan inte måndagar 🧑‍🍳')),'own Unicode/negation preserved; foreign message excluded');
  if(a.role==='company'){const b=source(x,'company_billing_details');check(b.status==='collected'&&b.rows.length===1&&b.rows[0].reference==='QA_OWN_BILLING','own company billing retained');check(!JSON.stringify(x).includes('QA_OWN 0')&&!JSON.stringify(x).includes('QA_OTHER'),'company cannot collect private youth CV work');}
  else{const b=source(x,'company_billing_details');check(b.status==='collected'&&b.rows.length===0,'youth sees no company billing');}
  const other=accounts.find(b=>b.id!==a.id);await assert.rejects(()=>collect(a.client,other.id),e=>e.code==='account_changed');passed++;
 }
 step='anonymous collection';await assert.rejects(()=>collect(client(),accounts[0].id),e=>e.code==='unauthenticated');passed++;
 step='direct foreign CV request';const foreign=await accounts[0].client.from('ai_onboarding_messages').select('id').eq('session_id',accounts[1].session);check(!foreign.error&&foreign.data.length===0,'actual RLS hides foreign CV even with known session ID');
}catch(error){console.error(JSON.stringify({failedAt:step,errorType:error.name,code:error.code??null,timings}));process.exitCode=1;}
finally{
 for(const a of accounts.filter(a=>a.token&&!a.deleted)){try{a.deleted=(await request(app+'/api/account','DELETE',{password,expectedUserId:a.id},a.token)).status===204;}catch{/* Never log credentials or raw responses. */}}
 console.log(JSON.stringify({fixturePrefix:prefix,passed,observations,remainingFixtureIds:accounts.filter(a=>!a.deleted).map(a=>a.id)}));
 if(accounts.some(a=>!a.deleted))process.exitCode=1;
 Module._load=oldLoad;if(oldTs)Module._extensions['.ts']=oldTs;else delete Module._extensions['.ts'];
}
