import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire,Module} from 'node:module';
import path from 'node:path';
import ts from 'typescript';
const require=createRequire(import.meta.url),load=Module._load,fetchOriginal=globalThis.fetch;
const owner='11111111-1111-4111-8111-111111111111',other='22222222-2222-4222-8222-222222222222',job='33333333-3333-4333-8333-333333333333';
const env={url:process.env.NEXT_PUBLIC_SUPABASE_URL,key:process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY};
process.env.NEXT_PUBLIC_SUPABASE_URL='https://qa.invalid';process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY='test-only-public';
let currentToken='qa-owner-token';
let actor=owner,mode='',saved=false,calls=[],reads=0,rpcStarted=false;
const app=()=>({job_id:job,youth_user_id:mode==='foreign'?other:owner,status:mode==='withdrawn'||mode==='latewithdrawn'&&saved?'withdrawn':'submitted',questions:[{id:'q',question:'Tider?'}],answers:saved?{q:'Helger'}:{},omitted_question_ids:saved?['s']:[]});
const rows=()=>[{id:'f',job_id:job,youth_user_id:mode==='foreignfollowups'?other:owner,status:saved?'answered':'pending',answer:saved?'Kassa':''},{id:'skip',job_id:job,youth_user_id:owner,status:saved?'skipped':'pending',answer:''}];
const payload={answers:{q:'Helger'},skipIds:['s'],followupAnswers:{f:'Kassa'},followupSkipIds:['skip']};
const shared={auth:{getUser:async()=>({data:{user:actor?{id:actor}:null},error:null}),getSession:async()=>({data:{session:{user:{id:actor},access_token:currentToken}},error:null})}};
Module._extensions['.ts']=(m,f)=>m._compile(ts.transpileModule(readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,f);
Module._load=function(n,parent,...args){if(n==='@/lib/supabase')return{getSupabaseClient:()=>shared};if(n.startsWith('@/'))return load.call(this,path.resolve(n.slice(2)),parent,...args);return load.call(this,n,parent,...args);};
globalThis.fetch=async(input,init)=>{
 const url=new URL(input);assert.ok(['Bearer qa-owner-token','Bearer qa-owner-token-refreshed'].includes(new Headers(init.headers).get('authorization')),'Every request uses a checked token from the same owner');calls.push({url,method:init.method??'GET',body:init.body&&JSON.parse(init.body)});
 if(url.pathname==='/auth/v1/user')return Response.json({id:owner,email:'qa@example.invalid'});
 assert.equal(url.searchParams.get('job_id'),url.pathname.includes('/rpc/')?null:'eq.'+job);
 if(url.pathname.endsWith('/application_completions')){reads++;assert.equal(url.searchParams.get('youth_user_id'),'eq.'+owner);if(mode==='readfail'&&reads>1)return Response.json({message:'QA_PRIVATE'},{status:503});return Response.json(app());}
 if(url.pathname.endsWith('/application_followups')){assert.equal(url.searchParams.get('youth_user_id'),'eq.'+owner);return Response.json(rows());}
 assert.ok(url.pathname.endsWith('/save_my_application_supplement'));rpcStarted=true;
 assert.deepEqual(JSON.parse(init.body),{p_job_id:job,p_answers:payload.answers,p_skip_ids:payload.skipIds,p_followup_answers:payload.followupAnswers,p_followup_skip_ids:payload.followupSkipIds});
 if(mode==='hang')return new Promise(()=>{});
 if(mode==='switch')actor=other;
 if(mode==='rpcfail')return Response.json({message:'QA_PRIVATE'},{status:500});
 saved=true;return Response.json(mode==='malformed'?{}:{updated:true});
};
const {submitOwnedSupplement:submit,SupplementWriteError}=require('../lib/owned-application-supplement.ts');
const {supplementQuestionText:text}=require('../lib/supplement-question-text.ts');
const reset=()=>{currentToken='qa-owner-token';actor=owner;mode='';saved=false;calls=[];reads=0;rpcStarted=false;};
const write=signal=>submit(owner,job,payload,signal??new AbortController().signal);
const writes=()=>calls.filter(c=>c.method==='POST').length;
try{
 reset();const receipt=await write();assert.equal(writes(),1);assert.equal((await receipt.read(new AbortController().signal)).confirmed,true);await receipt.read(new AbortController().signal);assert.equal(writes(),1,'Repeated recovery only reads');
 reset();const rotate=await write();currentToken='qa-owner-token-refreshed';assert.equal((await rotate.read(new AbortController().signal)).confirmed,true);assert.equal(writes(),1,'Refreshed same-account session recovers without writing');
 reset();mode='readfail';const failedRead=await write();await assert.rejects(failedRead.read(new AbortController().signal));mode='';assert.equal((await failedRead.read(new AbortController().signal)).confirmed,true);assert.equal(writes(),1);
 reset();mode='malformed';let malformed;await assert.rejects(write(),error=>{malformed=error.receipt;return error instanceof SupplementWriteError;});assert.equal((await malformed.read(new AbortController().signal)).confirmed,true);assert.equal(writes(),1);
 reset();mode='rpcfail';let uncertain;await assert.rejects(write(),error=>{uncertain=error.receipt;return error instanceof SupplementWriteError&&!error.message.includes('QA_PRIVATE');});assert.equal((await uncertain.read(new AbortController().signal)).confirmed,false);assert.equal(writes(),1,'Unknown write recovery cannot send twice');saved=true;assert.equal((await uncertain.read(new AbortController().signal)).confirmed,true);
 for(const scenario of ['foreign','withdrawn']){reset();mode=scenario;await assert.rejects(write());assert.equal(writes(),0,scenario+' rejected before write');}
 reset();actor=other;await assert.rejects(write());assert.equal(calls.length,0);
 reset();mode='switch';const switched=await write();await assert.rejects(switched.read(new AbortController().signal));assert.equal(writes(),1);assert.equal(reads,1,'Other account cannot refresh old application');
 reset();mode='foreignfollowups';const foreign=await write();await assert.rejects(foreign.read(new AbortController().signal));
 reset();mode='latewithdrawn';const withdrawn=await write();assert.equal((await withdrawn.read(new AbortController().signal)).application.status,'withdrawn');
 reset();const stop=new AbortController();stop.abort();await assert.rejects(write(stop.signal));assert.equal(calls.length,0);
 reset();mode='hang';const abort=new AbortController(),pending=write(abort.signal);while(!rpcStarted)await new Promise(setImmediate);abort.abort();await assert.rejects(pending,error=>error instanceof SupplementWriteError);assert.equal(writes(),1);
 const template=label=>`Hur beskriver du dina kunskaper i ${label}? Ange gärna din nivå och om du kan använda språket i tal och skrift.`;
 for(const label of ['Svenska för kundkontakt','Flytande engelska i telefon','Svenska och engelska','Språk för kundkontakt']){const out=text(template(label),label,'pending','automatic');assert.ok(!out.includes('kunskaper i '+label+'?'));assert.ok(out.toLocaleLowerCase('sv-SE').includes(label.toLocaleLowerCase('sv-SE')),'Job-specific context remains visible');}
 assert.equal(text(template('Svenska'),'Svenska','pending'), 'Hur beskriver du dina kunskaper i svenska? Ange gärna din nivå i tal och skrift.');
 for(const status of ['answered','skipped'])assert.equal(text(template('Svenska för kundkontakt'),'Svenska för kundkontakt',status),template('Svenska för kundkontakt'));
 assert.equal(text(template('Svenska för kundkontakt'),'Svenska för kundkontakt','pending','company'),template('Svenska för kundkontakt'));
 assert.equal(text('Egen formulering?', 'Svenska','pending'), 'Egen formulering?');assert.equal(text(template('svenskaliknande'),'svenskaliknande','pending'),template('svenskaliknande'));
 console.log('PASS real supplement service and installed SDK over simulated HTTP: bound token/owner filters, confirmed/unknown write, read-only recovery, wrong account/row, withdrawn, foreign followups, abort and late status. Language repair preserves company wording, answered history, whole-word matching and job context. No live writes.');
}finally{Module._load=load;globalThis.fetch=fetchOriginal;if(env.url===undefined)delete process.env.NEXT_PUBLIC_SUPABASE_URL;else process.env.NEXT_PUBLIC_SUPABASE_URL=env.url;if(env.key===undefined)delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;else process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY=env.key;}
