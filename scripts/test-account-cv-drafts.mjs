import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire,Module} from 'node:module';
import {createClient} from '@supabase/supabase-js';
import ts from 'typescript';
const require=createRequire(import.meta.url),original=Module._load;
Module._extensions['.ts']=(m,f)=>m._compile(ts.transpileModule(readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,f);
const {parseAccountCvDraft:parse,cvDraftFingerprint:fp,CV_DRAFT_FIELDS}=require('../lib/account-cv-draft.ts');
const {createEmptyStructuredCv}=require('../lib/structured-cv.ts');
const owner='11111111-1111-4111-8111-111111111111',other='22222222-2222-4222-8222-222222222222',revision='33333333-3333-4333-8333-333333333333',next='44444444-4444-4444-8444-444444444444';
const fixture=()=>({version:1,method:'manual',step:'about',draft:{...Object.fromEntries(CV_DRAFT_FIELDS.map(k=>[k,k==='about'?'Mitt osparade CV 🧑‍🍳':''])),noExperience:true},returnToReview:false,editedSections:[],generated:null,reviewSource:''});
const saved=content=>({user_id:owner,revision:next,content,updated_at:'2026-11-10T17:00:00.000Z'});
let passed=0,actor=owner,requests=[],response,identities=[];
async function test(name,fn){actor=owner;requests=[];identities=[];response=()=>new Response('null',{status:200,headers:{'content-type':'application/json'}});await fn();passed++;console.log('PASS '+name);}
const deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return{promise,resolve};};
const json=(value,status=200)=>new Response(JSON.stringify(value),{status,headers:{'content-type':'application/json'}});
const signal=()=>new AbortController().signal;
process.env.NEXT_PUBLIC_SUPABASE_URL='https://qa-draft.example.invalid';process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY='qa-public-key';
Module._load=function(n,parent,...args){
 if(n==='@/lib/supabase')return{getSupabaseClient:()=>({auth:{getUser:async()=>({data:{user:{id:actor,is_anonymous:false}},error:null}),getSession:async()=>({data:{session:{user:{id:actor},access_token:'qa-'+actor}},error:null})}})};
 if(n==='@supabase/supabase-js')return{createClient:(url,key,options)=>{assert.equal(options.auth.persistSession,false);assert.equal(options.auth.autoRefreshToken,false);return createClient(url,key,{...options,global:{...options.global,fetch:async(input,init)=>{const url=new URL(input),headers=new Headers(init.headers);assert.equal(headers.get('authorization'),'Bearer qa-'+owner,'Request stays bound to captured owner');if(url.pathname==='/auth/v1/user'){identities.push(url);return json({id:owner,aud:'authenticated',is_anonymous:false});}requests.push({url,init});return response(url,init);}}});}};
 return original.call(this,n,parent,...args);
};
const {loadAccountCvDraft:read,saveAccountCvDraft:write,AccountCvDraftError}=require('../lib/account-cv-draft-client.ts');
try{
 await test('manual and complete generated draft preserve all work, with a cloned snapshot',()=>{const f=fixture(),x=parse(f);assert.deepEqual(x,f);x.draft.about='changed';assert.notEqual(f.draft.about,x.draft.about);const cv=createEmptyStructuredCv({name:'QA',sourceNotes:['Egen anteckning']});cv.education.push({school:'QA skola',courses:['Kemi'],projects:[],achievements:[],sourceNotes:[]});f.generated={text:'Granskas igen',structured:cv};f.step='preview';f.method='ai';f.reviewSource='eget underlag';assert.deepEqual(parse(f),f);assert.equal(fp(f),fp(Object.fromEntries(Object.entries(f).reverse())));});
 for(const [name,change] of [
 ['approval',f=>f.approvedSnapshot='not allowed'],['nested approval',f=>f.draft.approval=true],['unknown version',f=>f.version=2],['missing text',f=>delete f.draft.about],['oversize field',f=>f.draft.about='x'.repeat(12001)],['oversize total',f=>CV_DRAFT_FIELDS.forEach(k=>f.draft[k]='å'.repeat(12000))],['unknown step',f=>f.step='done'],['preview without result',f=>f.step='preview'],['duplicate sections',f=>f.editedSections=['about','about']],['invalid structured result',f=>f.generated={text:'x',structured:{}}],['array instead of draft',f=>f.draft=[]],['null method',f=>f.method=null],['file reference',f=>f.file={url:'private'}],
 ])await test('reject '+name,()=>{const f=fixture();change(f);assert.throws(()=>parse(f));});
 await test('read is owner filtered with a closed projection, and never writes',async()=>{response=()=>json(saved(fixture()));const x=await read(owner,signal());assert.equal(x.content.draft.about,fixture().draft.about);assert.equal(requests.length,1);assert.equal(requests[0].url.searchParams.get('user_id'),'eq.'+owner);assert.equal(requests[0].url.searchParams.get('select'),'user_id,revision,content,updated_at');assert.equal(requests[0].init.method,'GET');});
 await test('no row is an unsaved account draft; malformed own content can be cleared',async()=>{const x=await read(owner,signal());assert.equal(x.revision,null);response=()=>json(saved({unsafe:'QA_PRIVATE'}));const bad=await read(owner,signal());assert.equal(bad.invalid,true);assert.equal(bad.content,null);assert.equal(bad.revision,next);});
 await test('foreign owner and invalid revision cannot be accepted',async()=>{for(const bad of [{...saved(fixture()),user_id:other},{...saved(fixture()),revision:'bad'}]){response=()=>json(bad);await assert.rejects(()=>read(owner,signal()),AccountCvDraftError);}});
 await test('save sends exact expected revision and cloned content; clear uses tombstone RPC',async()=>{const f=fixture();response=(url,init)=>{assert.equal(url.pathname,'/rest/v1/rpc/save_my_cv_draft');assert.deepEqual(JSON.parse(init.body),{p_expected_revision:revision,p_content:f});return json([saved(f)]);};const x=await write(owner,revision,f,signal());assert.equal(x.revision,next);assert.equal(requests.length,1);response=(_,init)=>{assert.deepEqual(JSON.parse(init.body),{p_expected_revision:next,p_content:null});return json([{...saved(null),revision}]);};assert.equal((await write(owner,next,null,signal())).content,null);});
 await test('stale version is a conflict; no automatic retry',async()=>{response=()=>json({code:'PT409',message:'QA_PRIVATE'},409);await assert.rejects(()=>write(owner,revision,fixture(),signal()),e=>e.kind==='conflict'&&!e.message.includes('QA_PRIVATE'));assert.equal(requests.length,1);});
 for(const [name,reply]of [['missing receipt',()=>json([])],['wrong content',()=>json([saved({...fixture(),reviewSource:'other'})])],['unchanged revision',()=>json([{...saved(fixture()),revision}])],['lost reply',()=>{throw Error('QA_PRIVATE');}]])await test(name+' is uncertain, not a confirmed save',async()=>{response=reply;await assert.rejects(()=>write(owner,revision,fixture(),signal()),e=>e.kind==='uncertain'&&!e.message.includes('QA_PRIVATE'));assert.equal(requests.length,1);});
 await test('account change before read/write prevents requests',async()=>{actor=other;await assert.rejects(()=>read(owner,signal()));await assert.rejects(()=>write(owner,null,fixture(),signal()));assert.equal(requests.length,0);assert.equal(identities.length,0);});
 await test('account change after response cannot confirm save for new account',async()=>{response=()=>{actor=other;return json([saved(fixture())]);};await assert.rejects(()=>write(owner,null,fixture(),signal()));assert.equal(requests.length,1);});
 await test('aborting an in-flight write produces uncertainty without another write',async()=>{const pending=deferred(),abort=new AbortController();response=()=>pending.promise;const promise=write(owner,null,fixture(),abort.signal);while(!requests.length)await Promise.resolve();abort.abort();await assert.rejects(()=>promise,e=>e.kind==='uncertain');pending.resolve(json([saved(fixture())]));assert.equal(requests.length,1);});
 console.log(`PASS ${passed} draft model/client checks; actual installed Supabase SDK over simulated Auth/Data API, no browser or hosted identity claim.`);
}finally{Module._load=original;}
