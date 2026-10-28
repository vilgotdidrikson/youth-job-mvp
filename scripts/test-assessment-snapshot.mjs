import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire, Module} from 'node:module';
import path from 'node:path';
import ts from 'typescript';

// Execute the actual handler and source/evidence logic. Auth, DB, PDF transport
// and provider are controlled; this is not a live concurrency/RLS test.
const require=createRequire(import.meta.url), originalLoad=Module._load;
const oldTs=Module._extensions['.ts'];
Module._extensions['.ts']=(m,f)=>m._compile(ts.transpileModule(readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,f);
const envNames=['NEXT_PUBLIC_SUPABASE_URL','NEXT_PUBLIC_SUPABASE_ANON_KEY','SUPABASE_SERVICE_ROLE_KEY','OPENAI_API_KEY'];
const env=Object.fromEntries(envNames.map(k=>[k,process.env[k]]));
Object.assign(process.env,{NEXT_PUBLIC_SUPABASE_URL:'https://qa.supabase.co',NEXT_PUBLIC_SUPABASE_ANON_KEY:'qa-anon',SUPABASE_SERVICE_ROLE_KEY:'qa-service',OPENAI_API_KEY:'qa-provider'});
let state;
const copy=value=>structuredClone(value);
const reset=()=>state={revision:1,initialInputRevision:1,version:3,status:'approved',criteria:[{id:'c1',label:'React',category:'experience',weight:1,required:true}],context:{title:'Utvecklare'},providerCalls:0,pdfCalls:0,writes:[],followups:0,packetReads:0,inputReads:0,profileReads:0,cache:null,cacheError:null,denied:false,throwRead:false,onCache:()=>{},onPdf:()=>{},onProvider:()=>{},onInsert:()=>{},onFollowups:()=>{}};
const packet=()=>({revision:state.revision,identity:{full_name:'QA'},cv:{text:'Jag har arbetat med React.',structured:{},documents:[]},practical:{city:null,availability:{}},profile_items:[]});
const client=service=>({
 rpc:async name=>{
  if(name==='get_candidate_assessment_input')return{data:{source_updated_at:'2026-10-28T00:00:00Z'},error:null};
  if(state.throwRead)throw Error('QA transport');
  if(name==='get_application_disclosure'){state.packetReads++;return{data:state.denied?null:packet(),error:state.denied?{code:'42501'}:null};}
  assert.equal(name,'get_application_matching_input');assert.ok(service);
  state.inputReads++;
  return{data:state.denied?null:{disclosure_revision:state.inputReads===1?state.initialInputRevision:state.revision,cv_text:'Jag har arbetat med React.',documents:[],job_context:copy(state.context)},error:state.denied?{code:'42501'}:null};
 },
 from:table=>({select(){return this;},eq(){return this;},async maybeSingle(){
  if(table==='job_match_profiles'){state.profileReads++;return{data:copy({profile_version:state.version,status:state.status,weighted_criteria:state.criteria}),error:null};}
  assert.equal(table,'candidate_assessments');state.onCache();return{data:copy(state.cache),error:state.cacheError};
 },async insert(value){state.writes.push(copy(value));state.onInsert();return{error:null};}}),
});
Module._load=function(name,parent,...args){
 if(name==='@supabase/supabase-js')return{createClient:(_url,key)=>client(key==='qa-service')};
 if(name==='@/lib/api-auth')return{requireApiUser:async()=>({user:{id:'qa-company'},token:'qa-token'})};
 if(name==='@/lib/pdf-cv-source')return{pdfCvSource:async()=>{state.pdfCalls++;state.onPdf();return{status:state.pdfStatus??'none',text:''};}};
 if(name==='@/lib/matching-provider')return{requestMatchingEvidence:async()=>{state.providerCalls++;state.onProvider();if(state.offline)throw Error('QA outage');return{criteria:[],answers:[]};}};
 if(name==='@/lib/queue-application-followups')return{queueApplicationFollowups:async()=>{state.followups++;state.onFollowups();return{queued:0};}};
 if(name.startsWith('@/'))return originalLoad.call(this,path.resolve(name.slice(2)),parent,...args);
 return originalLoad.call(this,name,parent,...args);
};
const {POST}=require('../app/api/company/candidate-assessment/route.ts');
const {sameDisclosure,currentAssessment}=require('../lib/assessment-snapshot.ts');
const run=async()=>{const response=await POST(new Request('https://qa.example.invalid/api/company/candidate-assessment',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({jobId:'11111111-1111-4111-8111-111111111111',youthUserId:'22222222-2222-4222-8222-222222222222'})}));return{status:response.status,body:await response.json()};};
const changed=async()=>{const result=await run();assert.equal(result.status,409);assert.equal(result.body.assessment,undefined,'Conflict must contain no old assessment');};
let passed=0;
try {
 reset();let result=await run();assert.equal(result.status,200);assert.equal(state.providerCalls,1);assert.equal(state.writes.length,1);assert.equal(result.body.assessment.disclosureRevision,1);const validCache={result:result.body.assessment,created_at:'2026-10-28T00:00:00Z'};passed++;
 reset();state.initialInputRevision=2;await changed();assert.equal(state.pdfCalls,0);assert.equal(state.providerCalls,0);assert.equal(state.writes.length,0);passed++;
 reset();state.initialInputRevision=undefined;await changed();assert.equal(state.providerCalls,0);passed++;
 reset();state.onPdf=()=>state.revision++;await changed();assert.equal(state.providerCalls,0,'Revoked before provider call');passed++;
 reset();state.offline=true;state.onProvider=()=>state.revision++;await changed();assert.equal(state.writes.length,0);passed++;
 reset();state.offline=true;state.onProvider=()=>state.denied=true;await changed();passed++;
 reset();state.offline=true;result=await run();assert.equal(result.status,200);assert.equal(result.body.temporary,true);assert.equal(state.writes.length,0);passed++;
 reset();state.onProvider=()=>state.version++;await changed();assert.equal(state.writes.length,0);passed++;
 reset();state.onProvider=()=>state.criteria[0].label='TypeScript';await changed();assert.equal(state.writes.length,0);passed++;
 reset();state.onProvider=()=>state.context.title='Butiksarbete';await changed();assert.equal(state.writes.length,0);passed++;
 reset();state.onProvider=()=>state.status='draft';await changed();passed++;
 reset();state.onInsert=()=>state.revision++;await changed();assert.equal(state.writes.length,1,'Already begun storage is not rolled back by a response guard');passed++;
 reset();state.onFollowups=()=>state.denied=true;await changed();passed++;
 reset();state.cache=validCache;result=await run();assert.equal(result.status,200);assert.equal(result.body.cached,true);assert.equal(state.providerCalls,0);passed++;
 reset();state.cache=validCache;state.onCache=()=>state.version++;await changed();assert.equal(state.providerCalls,0);passed++;
 for(const corrupt of [{...validCache.result,disclosureRevision:2},{...validCache.result,policyVersion:9}]){reset();state.cache={result:corrupt};result=await run();assert.equal(result.status,200);assert.equal(result.body.cached,false);assert.equal(result.body.assessment.disclosureRevision,1);assert.equal(state.providerCalls,1);passed++;}
 reset();state.cacheError={code:'QA_UNAVAILABLE'};result=await run();assert.equal(result.status,503);assert.equal(state.providerCalls,0);assert.equal(state.writes.length,0);passed++;
 reset();state.offline=true;state.onProvider=()=>state.throwRead=true;await changed();passed++;
 reset();state.pdfStatus='unreadable';state.onProvider=()=>state.revision++;await changed();assert.equal(state.writes.length,0);passed++;
 for(const invalid of [null,undefined,0,-1,1.5,'1',NaN,Infinity,Number.MAX_SAFE_INTEGER+1]){assert.equal(sameDisclosure({revision:invalid},{disclosure_revision:invalid}),false);assert.equal(currentAssessment({policyVersion:10,disclosureRevision:invalid},invalid),false);}
 console.log(`PASS ${passed} actual handler scenarios: mixed snapshots before transport, corrections/revocation during provider success/outage, job criteria/context/status changes, cached result metadata, read failures, post-write/follow-up changes and unchanged normal/temporary paths. Auth/DB/provider simulated.`);
} finally {
 Module._load=originalLoad;if(oldTs)Module._extensions['.ts']=oldTs;else delete Module._extensions['.ts'];
 for(const key of envNames)if(env[key]===undefined)delete process.env[key];else process.env[key]=env[key];
}
