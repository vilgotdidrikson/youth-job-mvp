import assert from'node:assert/strict';import{readFileSync}from'node:fs';import{createRequire,Module}from'node:module';import ts from'typescript';
const require=createRequire(import.meta.url),load=Module._load,network=globalThis.fetch;
for(const ext of ['.ts','.tsx'])Module._extensions[ext]=(m,f)=>m._compile(ts.transpileModule(readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,f);
const A='11111111-1111-4111-8111-111111111111',B='22222222-2222-4222-8222-222222222222',id='77777777-7777-4777-8777-777777777777',rev='88888888-8888-4888-8888-888888888888';
let user=A,hanging=false,requests=[],onFetch=null;
const auth={getUser:()=>hanging?new Promise(()=>{}):Promise.resolve({data:{user:{id:user}},error:null}),getSession:async()=>({data:{session:{user:{id:user},access_token:'TOKEN_'+user}},error:null})};
Module._load=function(n,parent,...args){if(n==='./supabase')return{getSupabaseClient:()=>({auth})};return load.call(this,n,parent,...args);};
const client=require('../lib/privacy-case-client.ts'),model=require('../lib/privacy-cases.ts');
const record=()=>({id,revision:rev,requester_id:A,kind:'access',body:'QA',status:'new',created_at:'2026-11-12T09:00:00Z',updated_at:'2026-11-12T09:00:00Z',reply_due_at:'2026-12-12T09:00:00Z',closed_at:null,assigned:false,is_mine:false,events:[],events_truncated:false});
globalThis.fetch=async(url,init)=>{requests.push({url,...init});return onFetch?onFetch(url,init):Response.json({available:true,cases:[record()],next:null});};
let count=0;const ok=(v,m)=>{assert.ok(v,m);console.log('PASS '+m);count++;};const signal=()=>new AbortController().signal;const reset=()=>{user=A;hanging=false;requests=[];onFetch=null;};
try{
 let v=model.parsePrivacyCase({...record(),secret:'MUST_DROP'},A);ok(!('secret'in v),'closed record projection omits extra values');
 for(const bad of [null,{...record(),requester_id:B},{...record(),kind:'__proto__'},{...record(),revision:'bad'},{...record(),events:[{id,action:'leak',created_at:'2026-11-12T09:00:00Z',public_message:'QA'}]}]){assert.throws(()=>model.parsePrivacyCase(bad,A));count++;}
 ok(model.caseText('  Åäö\nQA  ')==='Åäö\nQA','text preserves content and trims edges');assert.throws(()=>model.caseText('\u0001bad'));count++;
 reset();v=await client.readOwnPrivacyCases(A,null,signal());ok(v.cases.length===1&&requests.length===1,'own list performs no write');ok(requests[0].headers['X-Account-Id']===A&&requests[0].headers.Authorization==='Bearer TOKEN_'+A,'captured account token binds the request');
 reset();user=B;await assert.rejects(()=>client.readOwnPrivacyCases(A,null,signal()));ok(requests.length===0,'wrong current account prevents dispatch');
 reset();onFetch=()=>{user=B;return Response.json({available:true,cases:[record()],next:null});};await assert.rejects(()=>client.readOwnPrivacyCases(A,null,signal()));ok(requests.length===1,'late response is discarded after account switch');
 reset();onFetch=()=>Response.json(record());await client.createOwnPrivacyCase(A,id,'access','QA',signal());ok(JSON.parse(requests[0].body).id===id,'create preserves caller request UUID');
 reset();onFetch=()=>{throw Error('Lost completed reply');};await assert.rejects(()=>client.createOwnPrivacyCase(A,id,'access','QA',signal()),e=>e.uncertain===true);ok(requests.length===1,'uncertain create never automatically writes twice');
 reset();onFetch=()=>Response.json({...record(),id:B});await assert.rejects(()=>client.createOwnPrivacyCase(A,id,'access','QA',signal()),e=>e.uncertain===true);ok(requests.length===1,'wrong write receipt requires read-back');
 reset();hanging=true;const controller=new AbortController();const pending=client.readOwnPrivacyCases(A,null,controller.signal);controller.abort();await assert.rejects(()=>pending);ok(requests.length===0,'aborted hanging Auth is bounded before any case request');
 reset();onFetch=()=>Response.json({error:'SECRET_SERVER_ERROR'},{status:503});await assert.rejects(()=>client.createOwnPrivacyCase(A,id,'access','QA',signal()),e=>e.uncertain&&!e.message.includes('SECRET_SERVER_ERROR'));ok(requests.length===1,'backend failure is sanitized and treated as uncertain');
 const before={id:rev,created_at:'2026-11-12T09:00:00.123456Z'},old={id:B,action:'reply',public_message:'QA äldre',created_at:'2026-11-12T09:00:00.123455Z'};
 reset();onFetch=()=>Response.json({id,revision:rev,events:[{...old,private_actor:'DROP'}],next:null});v=await client.readPrivacyCaseHistory(A,record(),before,signal());ok(v.events.length===1&&!JSON.stringify(v).includes('DROP'),'history preserves microsecond ordering and strips private extra fields');
 for(const bad of [{id:B,revision:rev,events:[old],next:null},{id,revision:B,events:[old],next:null},{id,revision:rev,events:[old,old],next:null},{id,revision:rev,events:[{...old,created_at:before.created_at,id:rev}],next:null},{id,revision:rev,events:[old],next:{id:rev,created_at:old.created_at}}]){assert.throws(()=>model.parsePrivacyCaseHistory(bad,record(),before));count++;}
 ok(model.privacyCaseFollowup({...record(),status:'closed'})===null,'closed cases have no active deadline prompt');
 v=model.privacyCaseFollowup({...record(),review_after:'2026-11-11T09:00:00Z'},Date.parse('2026-11-12T09:00:00Z'));ok(v.reviewOverdue&&!v.replyOverdue&&v.due===Date.parse('2026-11-11T09:00:00Z'),'review date and reply deadline remain separate');
 ok(model.parsePrivacyCase({...record(),review_after:old.created_at},A).review_after===null,'own parser never exposes the internal review date');
 reset();onFetch=()=>Response.json({...record(),id:B});await assert.rejects(()=>client.replyToOwnPrivacyCase(A,record(),'QA',B,signal()),e=>e.uncertain===true);ok(requests.length===1,'foreign reply receipt is discarded without another write');
 console.log('PASS '+count+' model/client checks; simulated Auth and fetch. No live account or browser claim.');
}finally{Module._load=load;globalThis.fetch=network;}
