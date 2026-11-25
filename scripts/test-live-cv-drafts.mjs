// Explicit opt-in. ONLY disposable accounts in fixed MatchnWork DevStaging.
import assert from 'node:assert/strict';
import {AsyncLocalStorage} from 'node:async_hooks';
import {randomBytes,randomUUID,createHash} from 'node:crypto';
import {readFileSync,writeFileSync} from 'node:fs';
import {createRequire,Module} from 'node:module';
import path from 'node:path';
import ts from 'typescript';
import {createClient} from '@supabase/supabase-js';
const base='https://vwcfjvwfeatvuisojwrh.supabase.co',app='https://youth-job-mvp-dev.vercel.app';
assert.equal(process.env.MNW_LIVE_CV_ALLOW_WRITES,'true','Explicit disposable-staging opt-in required');
assert.equal(process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/,''),base,'DevStaging only');
const key=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;assert.ok(key);
if(!key.startsWith('sb_publishable_')){const p=JSON.parse(Buffer.from(key.split('.')[1],'base64url'));assert.equal(p.role,'anon');assert.equal(p.ref,'vwcfjvwfeatvuisojwrh');}
let lastApiFailure=null;
const request=async(url,init={})=>{const r=await fetch(url,{...init,signal:init.signal?AbortSignal.any([init.signal,AbortSignal.timeout(25000)]):AbortSignal.timeout(25000)});if(!r.ok){let code;try{const v=await r.clone().json();if(typeof v.code==='string'&&/^[A-Za-z0-9_]{1,64}$/.test(v.code))code=v.code;}catch{}lastApiFailure={step,status:r.status,path:new URL(typeof url==='string'?url:url.url).pathname.split('/').slice(0,4).join('/'),code};}return r;};
const options={auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},global:{fetch:request}};
const client=()=>createClient(base,key,options),context=new AsyncLocalStorage(),as=(c,fn)=>context.run(c,fn),signal=()=>new AbortController().signal;
const require=createRequire(import.meta.url),original=Module._load,accounts=[],prefix='qa-cv-session-'+Date.now()+'-'+randomUUID().slice(0,8),password=randomBytes(28).toString('base64url');
const fixtureFile='/tmp/mnw-live-cv-session-fixtures.json';
let step='preflight',passed=0;
const check=(ok,label)=>{assert.ok(ok,label);passed++;console.log('PASS '+label);};
const fixture=()=>writeFileSync(fixtureFile,JSON.stringify({prefix,ids:accounts.map(a=>a.id),paths:accounts.flatMap(a=>a.path?[a.path]:[]),remaining:accounts.filter(a=>!a.deleted).map(a=>a.id)}),{mode:0o600});
const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
for(const ext of ['.ts','.tsx'])Module._extensions[ext]=(m,f)=>m._compile(ts.transpileModule(readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText,f);
Module._load=function(n,parent,...args){if(n==='@/lib/supabase')return{getSupabaseClient:()=>{const c=context.getStore();assert.ok(c,'Explicit real session required');return c;}};if(n.startsWith('@/'))return original.call(this,path.resolve(n.slice(2)),parent,...args);return original.call(this,n,parent,...args);};
const {CV_DRAFT_FIELDS,cvDraftFingerprint:fp}=require('../lib/account-cv-draft.ts');
const {loadAccountCvDraft:read,saveAccountCvDraft:save}=require('../lib/account-cv-draft-client.ts');
const {createEmptyStructuredCv}=require('../lib/structured-cv.ts');
const {uploadOwnedCvPdf,createCvSave,CvWorkflowError}=require('../lib/cv-save-workflow.ts');
const {getYouthDocumentSignedUrl}=require('../lib/storage.ts');
const {Font}=require('@react-pdf/renderer'),register=Font.register;Font.register=definition=>register.call(Font,{...definition,fonts:definition.fonts.map(f=>({...f,src:f.src.startsWith('/fonts/')?path.join(process.cwd(),'public',f.src):f.src}))});
const {createCvPdfFile}=require('../lib/cv-pdf.tsx');
const deletion=(account,expectedUserId=account.id,secret=password)=>request(app+'/api/account',{method:'DELETE',headers:{Authorization:'Bearer '+account.token,'Content-Type':'application/json'},body:JSON.stringify({expectedUserId,password:secret})});
try{
 const config=await request(base+'/auth/v1/settings',{headers:{apikey:key}});assert.ok(config.ok);const settings=await config.json();
 check(settings.mailer_autoconfirm===true&&settings.external?.email===true&&settings.disable_signup!==true,'dev auto-confirm enabled before signup; no verification email requested');
 for(const role of ['youth','youth','company']){
  step='signup '+role;const c=client(),email=`${prefix}-${accounts.length}@example.invalid`,r=await c.auth.signUp({email,password,options:{data:{role}}});
  if(r.data.user?.id){accounts.push({id:r.data.user.id,email,c,token:r.data.session?.access_token,deleted:false});fixture();}
  check(!r.error&&!!r.data.session,'disposable '+role+' receives real Auth session');
 }
 const [owner,other,company]=accounts;
 step='basic QA profile';const basic=await owner.c.from('youth_profiles').update({full_name:'QA Fiktiv Öberg',city:'QA Teststad',age:18,short_onboarding_completed:true}).eq('user_id',owner.id);check(!basic.error,'ordinary fictitious youth profile completed before CV flow');
 const initialProfile=await owner.c.from('youth_profiles').select('cv_text,cv_structured').eq('user_id',owner.id).single();check(!initialProfile.error,'own initial profile read');
 const second=client();step='second session';const login=await second.auth.signInWithPassword({email:owner.email,password});check(!login.error&&!!login.data.session,'second independent login for same owner');
 const sessionId=token=>JSON.parse(Buffer.from(token.split('.')[1],'base64url')).session_id;
 check(sessionId(owner.token)!==sessionId(login.data.session.access_token),'sessions have different server session IDs');
 const make=about=>({version:1,method:'manual',step:'education',draft:{...Object.fromEntries(CV_DRAFT_FIELDS.map(k=>[k,k==='about'?about:k==='school'?'QA testskola':''])),noExperience:true},returnToReview:false,editedSections:['education'],generated:null,reviewSource:''});
 step='parallel first saves';
 const empty=await Promise.all([as(owner.c,()=>read(owner.id,signal())),as(second,()=>read(owner.id,signal()))]);check(empty.every(r=>r.revision===null),'both sessions see no initial draft');
 const results=await Promise.allSettled([as(owner.c,()=>save(owner.id,null,make('QA version A'),signal())),as(second,()=>save(owner.id,null,make('QA version B'),signal()))]);
 check(results.filter(r=>r.status==='fulfilled').length===1&&results.filter(r=>r.status==='rejected'&&r.reason.kind==='conflict').length===1,'simultaneous first saves: exactly one wins, other conflicts');
 let current=results.find(r=>r.status==='fulfilled').value;
 const resumed=await as(second,()=>read(owner.id,signal()));check(resumed.revision===current.revision&&fp(resumed.content)===fp(current.content),'second session resumes exact content and guide step');
 const structured=createEmptyStructuredCv({name:'QA Åsa Öberg'});structured.profile.summary='Fiktivt prov. Jag kan inte arbeta måndagar.';
 const preview={...make('QA privat arbetsmaterial'),method:'ai',step:'preview',generated:{text:'Fiktiv Åsa Öberg – inte måndagar',structured},reviewSource:'Fiktiv källa'};
 step='reviewed draft snapshot';const older=current.revision;current=await as(second,()=>save(owner.id,current.revision,preview,signal()));
 const exact=await as(owner.c,()=>read(owner.id,signal()));check(fp(exact.content)===fp(preview)&&!('approvedSnapshot' in exact.content),'generated text/facts preserved without approval, no generation request');
 await assert.rejects(()=>as(owner.c,()=>save(owner.id,older,make('stale'),signal())),e=>e.kind==='conflict');passed++;console.log('PASS stale update cannot overwrite newer draft');
 step='parallel updates';const updated=await Promise.allSettled([as(owner.c,()=>save(owner.id,current.revision,make('QA samtidig A'),signal())),as(second,()=>save(owner.id,current.revision,make('QA samtidig B'),signal()))]);
 check(updated.filter(r=>r.status==='fulfilled').length===1&&updated.filter(r=>r.status==='rejected'&&r.reason.kind==='conflict').length===1,'simultaneous existing-version updates: exactly one wins');current=updated.find(r=>r.status==='fulfilled').value;
 step='clear and recreate';const cleared=await as(owner.c,()=>save(owner.id,current.revision,null,signal()));check(cleared.content===null&&cleared.revision!==current.revision,'clearing retains a new revision marker');
 await assert.rejects(()=>as(second,()=>save(owner.id,null,make('stale recreate'),signal())),e=>e.kind==='conflict');passed++;console.log('PASS old empty revision cannot recreate cleared draft');
 current=await as(second,()=>save(owner.id,cleared.revision,preview,signal()));check(fp(current.content)===fp(preview),'explicit new version can resume after clear');
 step='foreign draft denial';for(const a of [other,company]){const r=await a.c.from('youth_cv_drafts').select('user_id,content').eq('user_id',owner.id);check(!r.error&&r.data.length===0,'foreign '+(a===other?'youth':'company')+' cannot read draft');}
 const denied=await company.c.rpc('save_my_cv_draft',{p_expected_revision:null,p_content:make('forbidden')});check(!!denied.error,'company cannot create youth draft');
 const direct=await owner.c.from('youth_cv_drafts').update({content:null}).eq('user_id',owner.id);check(!!direct.error,'direct table update is denied');
 const unchanged=await owner.c.from('youth_profiles').select('cv_text,cv_structured').eq('user_id',owner.id).single();check(!unchanged.error&&fp(unchanged.data)===fp(initialProfile.data),'all draft operations leave finished CV unchanged');
 step='real PDF generation';const text='PROFIL\nFiktiv Åsa Öberg. Jag kan inte arbeta måndagar.\n\nSPRÅK\nSvenska – flytande\nSLUTMARKÖR';
 const file=await as(owner.c,()=>createCvPdfFile(text,'QA Åsa Öberg')),bytes=new Uint8Array(await file.arrayBuffer());
 const {getDocument}=await import('pdfjs-dist/legacy/build/pdf.mjs'),pdf=await getDocument({data:bytes.slice(),useSystemFonts:true}).promise;let rendered='';for(let i=1;i<=pdf.numPages;i++)rendered+=(await(await pdf.getPage(i)).getTextContent()).items.map(x=>x.str??'').join(' ');
 check(pdf.numPages<=2&&rendered.includes('Öberg')&&rendered.includes('inte arbeta')&&rendered.includes('SLUTMARKÖR'),'actual product PDF parser preserves Swedish, negation and end marker');await pdf.destroy();
 step='real private PDF upload';const document=await as(owner.c,()=>uploadOwnedCvPdf(owner.id,file,signal()));owner.path=document.url;fixture();
 check(document.url.startsWith(owner.id+'/'),'actual owned upload helper scopes private PDF to owner');
 step='persist PDF reference';const task=createCvSave(owner.id,{kind:'uploaded',document});await as(owner.c,()=>task.save(signal()));const confirmed=await as(owner.c,()=>task.read(signal()));check(confirmed.confirmed&&confirmed.profile.documents.some(d=>d.url===document.url),'actual CV save/read confirms exact uploaded reference');
 const accountDraft=await as(second,()=>read(owner.id,signal()));check(accountDraft.revision===current.revision&&fp(accountDraft.content)===fp(preview),'finished CV save does not replace another session draft');
 const signed=await as(owner.c,()=>getYouthDocumentSignedUrl(document.url)),download=await request(signed);check(download.ok&&digest(new Uint8Array(await download.arrayBuffer()))===digest(bytes),'owner downloads byte-identical private PDF');
 for(const a of [other,company]){const r=await a.c.storage.from('youth-documents').download(document.url);check(!!r.error&&!r.data,'foreign account cannot download known private path');const u=await a.c.storage.from('youth-documents').createSignedUrl(document.url,60);check(!!u.error&&!u.data?.signedUrl,'foreign account cannot sign private PDF');}
 const anonymous=await client().storage.from('youth-documents').download(document.url);check(!!anonymous.error&&!anonymous.data,'anonymous private PDF denied');
 step='wrong account deletion';check((await deletion(owner,other.id)).status===409,'deletion rejects mismatched expected account');check((await deletion(owner,owner.id,'QA-wrong-password')).status===403,'wrong password cannot delete account');
 check(!(await owner.c.auth.getUser()).error&&!(await other.c.auth.getUser()).error,'both accounts remain after denied deletion');
 step='local logout';const refresh=login.data.session.refresh_token;check(!(await second.auth.signOut({scope:'local'})).error,'second session logout succeeds');const refreshResult=await client().auth.refreshSession({refresh_token:refresh});check(!!refreshResult.error,'logged-out refresh token cannot open new session');check(!(await owner.c.auth.getUser()).error,'local logout preserves first independent session');
 step='owner deletion';check((await deletion(owner)).status===204,'actual account endpoint deletes owned account with PDF/draft');owner.deleted=true;fixture();
 const old=createClient(base,key,{...options,global:{fetch:request,headers:{Authorization:'Bearer '+owner.token}}});
 const remaining=await old.from('youth_cv_drafts').select('user_id').eq('user_id',owner.id);check(!!remaining.error||remaining.data.length===0,'old token cannot read deleted draft');
 const recreated=await old.rpc('save_my_cv_draft',{p_expected_revision:null,p_content:make('after deletion')});check(!!recreated.error,'old token cannot recreate draft after account deletion');
 const missing=await old.storage.from('youth-documents').download(document.url);check(!!missing.error&&!missing.data,'deleted private PDF no longer downloadable with old token');
 const rejectedLogin=await client().auth.signInWithPassword({email:owner.email,password});check(!!rejectedLogin.error,'deleted account cannot sign in again');
 console.log('PASS '+passed+' actual DevStaging/Auth/Storage/dev-HTTP checks; session-context adapter only, no transport mocks, AI, applications or email sends. Not physical-device/browser acceptance.');
}catch(error){console.error(JSON.stringify({failedAt:step,errorType:error.name,message:error instanceof assert.AssertionError||error instanceof CvWorkflowError?error.message:undefined,api:lastApiFailure?.step===step?lastApiFailure:undefined}));process.exitCode=1;}
finally{
 for(const a of accounts){if(a.deleted)continue;try{if(!a.token){const login=await a.c.auth.signInWithPassword({email:a.email,password});a.token=login.data.session?.access_token;}let response=await deletion(a);if(response.status!==204)response=await deletion(a);a.deleted=response.status===204;}catch{a.deleted=false;}}
 fixture();const remaining=accounts.filter(a=>!a.deleted).map(a=>a.id);console.log(JSON.stringify({passed,fixturePrefix:prefix,remainingFixtureIds:remaining}));if(remaining.length)process.exitCode=1;Module._load=original;
}
