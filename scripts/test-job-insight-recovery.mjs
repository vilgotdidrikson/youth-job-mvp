import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire,Module} from 'node:module';
import ts from 'typescript';
import {createClient} from '@supabase/supabase-js';
const require=createRequire(import.meta.url),original=Module._load;
Module._extensions['.ts']=(m,f)=>m._compile(ts.transpileModule(readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,f);
const {parseJobInsight:parse,JobInsightError}=require('../lib/job-requirements-information.ts');
const owner='11111111-1111-4111-8111-111111111111',other='22222222-2222-4222-8222-222222222222',job='33333333-3333-4333-8333-333333333333';
let actor=owner,requests=[],reply,identityReply;
const row={job_id:job,title:'QA café',description:'Servering',requirements:'Kundkontakt',criteria:[{private:'QA_PRIVATE'}],role_summary:'QA_PRIVATE',score:99};
process.env.NEXT_PUBLIC_SUPABASE_URL='https://qa-insight.example.invalid';process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY='qa-public-only';
Module._load=function(n,parent,...args){if(n==='@/lib/supabase')return{getSupabaseClient:()=>({auth:{getUser:async()=>({data:{user:{id:actor,is_anonymous:false}},error:null}),getSession:async()=>({data:{session:{user:{id:actor},access_token:'qa-'+actor}},error:null})}})};if(n==='@supabase/supabase-js')return{createClient:(url,key,opts)=>{assert.equal(opts.auth.persistSession,false);assert.equal(opts.auth.autoRefreshToken,false);return createClient(url,key,{...opts,global:{...opts.global,fetch:async(input,init)=>{const url=new URL(input);assert.equal(new Headers(init.headers).get('authorization'),'Bearer qa-'+owner);if(url.pathname.endsWith('/auth/v1/user'))return identityReply?.()??Response.json({id:owner});requests.push({url,init});assert.equal(url.pathname,'/rest/v1/rpc/get_job_requirement_insight');assert.deepEqual(JSON.parse(init.body),{p_job_id:job});return reply();}}});}};return original.call(this,n,parent,...args);};
const {loadJobInsight:read}=require('../lib/job-requirements-insight.ts');let passed=0;
const test=async(name,fn)=>{actor=owner;requests=[];identityReply=null;reply=()=>Response.json(row);await fn();passed++;console.log('PASS '+name);};
const signal=()=>new AbortController().signal;
try{
 await test('closed public-field projection excludes rubric and scores',()=>{assert.deepEqual(parse(row,job),{title:row.title,description:row.description,requirements:row.requirements});assert.equal(parse({...row,requirements:null},job).requirements,'');});
 for(const [name,change]of [['wrong job',r=>r.job_id=other],['missing title',r=>delete r.title],['blank title',r=>r.title=' '],['object text',r=>r.description={}],['missing requirements',r=>delete r.requirements],['over limit',r=>r.requirements='x'.repeat(30001)]])await test('reject '+name,()=>{const r={...row};change(r);assert.throws(()=>parse(r,job),JobInsightError);});
 await test('installed SDK reads exact job with pinned identity; never writes another RPC',async()=>{assert.deepEqual(await read(owner,job,signal()),{title:row.title,description:row.description,requirements:row.requirements});assert.equal(requests.length,1);assert.ok(requests[0].init.signal instanceof AbortSignal);});
 for(const name of ['throw','denied','wrong job'])await test('sanitized failure: '+name,async()=>{reply=()=>{if(name==='throw')throw Error('QA_PRIVATE');return Response.json(name==='denied'?{message:'QA_PRIVATE',code:'42501'}:{...row,job_id:other},{status:name==='denied'?403:200});};await assert.rejects(()=>read(owner,job,signal()),e=>e instanceof JobInsightError&&!e.message.includes('QA_PRIVATE'));assert.equal(requests.length,1);});
 await test('account switch before or during binding starts no listing read',async()=>{actor=other;await assert.rejects(()=>read(owner,job,signal()));assert.equal(requests.length,0);actor=owner;identityReply=()=>{actor=other;return Response.json({id:owner});};await assert.rejects(()=>read(owner,job,signal()));assert.equal(requests.length,0);});
 await test('account switch after response discards result',async()=>{reply=()=>{actor=other;return Response.json(row);};await assert.rejects(()=>read(owner,job,signal()));assert.equal(requests.length,1);});
 await test('pre-aborted operation never reads listing',async()=>{const c=new AbortController();c.abort();await assert.rejects(()=>read(owner,job,c.signal));assert.equal(requests.length,0);});
 await test('hung transport times out and cannot return late listing data',async()=>{const old=AbortSignal.timeout;AbortSignal.timeout=ms=>{assert.equal(ms,15000);const c=new AbortController();setTimeout(()=>c.abort(),8);return c.signal;};try{reply=()=>new Promise(()=>{});await assert.rejects(()=>read(owner,job,signal()),JobInsightError);assert.equal(requests.length,1);assert.equal(requests[0].init.signal.aborted,true);}finally{AbortSignal.timeout=old;}});
 console.log(`PASS ${passed} insight model/installed-SDK checks; simulated Auth/Data API. No live account or rubric read.`);
}finally{Module._load=original;}
