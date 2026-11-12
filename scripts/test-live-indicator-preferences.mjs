// Opt-in: fixed DevStaging, disposable accounts, no real recipients or emails.
import assert from 'node:assert/strict';
import {AsyncLocalStorage} from 'node:async_hooks';
import {randomBytes,randomUUID} from 'node:crypto';
import {readFileSync,writeFileSync} from 'node:fs';
import {createRequire,Module} from 'node:module';
import path from 'node:path';
import ts from 'typescript';
import {createClient} from '@supabase/supabase-js';
import {unzipSync,strFromU8} from 'fflate';
const base='https://vwcfjvwfeatvuisojwrh.supabase.co',app='https://youth-job-mvp-dev.vercel.app';
assert.equal(process.env.MNW_LIVE_INDICATORS_ALLOW_WRITES,'true','Explicit disposable-staging opt-in required');
assert.equal(process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/,''),base,'DevStaging only');
const key=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;assert.ok(key);
if(!key.startsWith('sb_publishable_')){const payload=JSON.parse(Buffer.from(key.split('.')[1],'base64url'));assert.equal(payload.role,'anon');assert.equal(payload.ref,'vwcfjvwfeatvuisojwrh');}
const network=globalThis.fetch,context=new AsyncLocalStorage(),as=(c,fn)=>context.run(c,fn),signal=()=>new AbortController().signal;
let dropReply=false,step='preflight',passed=0;
globalThis.fetch=async(url,init={})=>{const result=await network(url,{...init,signal:init.signal?AbortSignal.any([init.signal,AbortSignal.timeout(25000)]):AbortSignal.timeout(25000)});if(dropReply&&init.method==='PUT'&&String(url)===base+'/auth/v1/user'){dropReply=false;await result.arrayBuffer();throw Error('Intentionally lost completed PUT reply');}return result;};
const options={auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}},client=()=>createClient(base,key,options);
const require=createRequire(import.meta.url),original=Module._load,accounts=[],prefix='qa-indicator-'+Date.now()+'-'+randomUUID().slice(0,8),password=randomBytes(28).toString('base64url');
const fixture=()=>writeFileSync('/tmp/mnw-live-indicator-fixtures.json',JSON.stringify({prefix,ids:accounts.map(a=>a.id),remaining:accounts.filter(a=>!a.deleted).map(a=>a.id)}),{mode:0o600});
for(const ext of ['.ts','.tsx'])Module._extensions[ext]=(m,f)=>m._compile(ts.transpileModule(readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText,f);
Module._load=function(n,parent,...args){if(n==='server-only')return{};if(n==='@/lib/supabase')return{getSupabaseClient:()=>{const c=context.getStore();assert.ok(c);return c;}};if(n.startsWith('@/'))return original.call(this,path.resolve(n.slice(2)),parent,...args);return original.call(this,n,parent,...args);};
const {loadIndicatorPreferences:read,saveIndicatorPreferences:save}=require('../lib/notification-indicator-client.ts');
const {collectPersonalDataForReview:collect}=require('../lib/server/personal-data-collection.ts');
const {buildStructuredPersonalDataExport:build}=require('../lib/server/structured-personal-data-export.ts');
const check=(ok,label)=>{assert.ok(ok,label);passed++;console.log('PASS '+label);};
const deletion=a=>fetch(app+'/api/account',{method:'DELETE',headers:{Authorization:'Bearer '+a.token,'Content-Type':'application/json'},body:JSON.stringify({expectedUserId:a.id,password})});
try{
 const config=await fetch(base+'/auth/v1/settings',{headers:{apikey:key}});assert.ok(config.ok);const settings=await config.json();check(settings.mailer_autoconfirm===true&&settings.external?.email===true&&settings.disable_signup!==true,'auto-confirm preflight; no verification email requested');
 for(const role of ['youth','company']){step='signup '+role;const c=client(),email=`${prefix}-${accounts.length}@example.invalid`,r=await c.auth.signUp({email,password,options:{data:{role,qa_unrelated:'QA_UNRELATED_METADATA'}}});if(r.data.user?.id){accounts.push({id:r.data.user.id,email,c,token:r.data.session?.access_token,role,deleted:false});fixture();}check(!r.error&&!!r.data.session,'disposable '+role+' receives real session');}
 const [owner,other]=accounts;
 for(const a of accounts){step='read/save '+a.role;const before=await as(a.c,()=>read(a.id,signal()));check(!before.configured&&before.preferences.messages,'new '+a.role+' has unsaved default presentation');const prefs={version:1,messages:false,questions:a.role==='company',notifications:false};const saved=await as(a.c,()=>save(a.id,prefs,signal()));check(saved.configured&&JSON.stringify(saved.preferences)===JSON.stringify(prefs),'real '+a.role+' Auth PUT confirmed by fresh GET');const user=await a.c.auth.getUser();check(!user.error&&user.data.user.user_metadata.qa_unrelated==='QA_UNRELATED_METADATA'&&user.data.user.user_metadata.role===a.role,'metadata merge preserves unrelated values and original role');const profile=await a.c.from('profiles').select('role').eq('id',a.id).single();check(!profile.error&&profile.data.role===a.role,'database authorization role is unchanged');}
 step='second session';const second=client(),login=await second.auth.signInWithPassword({email:owner.email,password});check(!login.error&&!!login.data.session,'independent same-owner session');const resumed=await as(second,()=>read(owner.id,signal()));check(resumed.configured&&!resumed.preferences.messages&&!resumed.preferences.notifications,'second session resumes saved choices');
 step='lost completed response';dropReply=true;const next={version:1,messages:true,questions:false,notifications:false};await assert.rejects(()=>as(owner.c,()=>save(owner.id,next,signal())),e=>e.uncertain);passed++;console.log('PASS intentionally lost completed PUT is uncertain');const recovered=await as(second,()=>read(owner.id,signal()));check(recovered.configured&&recovered.preferences.messages&&!recovered.preferences.questions,'read-only recovery finds real committed choice without retrying PUT');
 step='account boundary';await assert.rejects(()=>as(other.c,()=>save(owner.id,next,signal())));passed++;console.log('PASS foreign session cannot write expected owner preferences');const ownOther=await as(other.c,()=>read(other.id,signal()));check(!ownOther.preferences.messages,'foreign account retains its own independent choice');
 step='own export projection';const collection=await collect(owner.c,owner.id,signal()),source=collection.categories.flatMap(c=>c.sources).find(s=>s.relation==='auth.users');check(source.status==='collected'&&source.rows.length===1&&source.rows[0].id===owner.id&&source.rows[0].indicator_messages===true,'real own Auth data enters closed collector projection');check(!JSON.stringify(collection).includes('QA_UNRELATED_METADATA'),'collector omits unrelated metadata');
 const now=new Date().toISOString(),info={controller:'QA',contact:'qa@example.invalid',purposes:['QA'],recipients:['QA'],retention:['QA'],sources:['QA'],rights:['QA'],automatedProcessing:['QA']};const out=build({subjectId:owner.id,reviewState:'pending',consistency:'non_transactional',collection,cv:null},{exportId:randomUUID(),createdAt:now,information:info}),entries=unzipSync(out.bytes),data=JSON.parse(strFromU8(entries['uppgifter/auth-identity.json']));check(data.records.length===1&&data.records[0].indicator_messages===true&&data.records[0].indicator_questions===false,'actual ZIP includes exact own bool choices');check(Object.values(entries).every(bytes=>!strFromU8(bytes).includes('QA_UNRELATED_METADATA')),'actual ZIP and readable HTML contain no unrelated metadata');check(out.manifest.coverage==='needs_completion','export retains incomplete-coverage disclosure');
 step='cleanup secondary session';check(!(await second.auth.signOut({scope:'local'})).error,'secondary QA session explicitly logged out');
 console.log('PASS '+passed+' live Auth/collector/ZIP checks; only session-context adapter and deliberate lost-return injection, no fabricated HTTP responses. Not browser/device acceptance.');
}catch(error){console.error(JSON.stringify({failedAt:step,errorType:error.name,message:error instanceof assert.AssertionError?error.message:undefined}));process.exitCode=1;}
finally{
 dropReply=false;
 for(const a of accounts){try{if(!a.token){const r=await a.c.auth.signInWithPassword({email:a.email,password});a.token=r.data.session?.access_token;}let response=await deletion(a);if(response.status!==204)response=await deletion(a);a.deleted=response.status===204;}catch{a.deleted=false;}}
 fixture();const remaining=accounts.filter(a=>!a.deleted).map(a=>a.id);console.log(JSON.stringify({passed,fixturePrefix:prefix,remainingFixtureIds:remaining}));if(remaining.length)process.exitCode=1;Module._load=original;globalThis.fetch=network;
}
