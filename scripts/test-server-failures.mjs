import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {createRequire,Module} from 'node:module';
import path from 'node:path';
import ts from 'typescript';
const require=createRequire(import.meta.url),load=Module._load,oldTs=Module._extensions['.ts'];
Module._extensions['.ts']=(m,f)=>m._compile(ts.transpileModule(readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,f);
const {reportServerFailure,failureCategory,applicationSubmissionFailure}=require('../lib/server-failures.ts');
const {default:RealOpenAI}=require('openai');
const canary='QA_PRIVATE_PAYLOAD_MUST_NOT_LEAVE_ERROR_BOUNDARY',uuid=/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/;
const upstream=Object.assign(new Error(canary),{name:canary,code:canary,status:502,headers:{authorization:canary},request:{body:canary},cause:{cv:canary},request_id:canary});
const original={error:console.error,warn:console.warn,fetch:globalThis.fetch};let logs=[],passed=0;
const safe=()=>{assert.ok(!JSON.stringify(logs).includes(canary),'Captured log arguments must contain no private marker');for(const row of logs){assert.equal(row[0],'MatchnWork server failure');assert.ok(uuid.test(row[1].incidentId));assert.deepEqual(Object.keys(row[1]).sort(),(row[1].status===undefined?['event','incidentId','category']:['event','incidentId','category','status']).sort());}};
console.error=(...args)=>logs.push(args);console.warn=(...args)=>logs.push(args);
const envNames=['OPENAI_API_KEY','NEXT_PUBLIC_SUPABASE_URL','NEXT_PUBLIC_SUPABASE_ANON_KEY','SUPABASE_SERVICE_ROLE_KEY'];
const env=Object.fromEntries(envNames.map(k=>[k,process.env[k]]));
Object.assign(process.env,{OPENAI_API_KEY:'qa-provider',NEXT_PUBLIC_SUPABASE_URL:'https://qa.supabase.co',NEXT_PUBLIC_SUPABASE_ANON_KEY:'qa-anon',SUPABASE_SERVICE_ROLE_KEY:'qa-service'});
let state;
const reset=()=>{logs=[];state={enabled:true,authorized:true,providerFails:true,after:[],rpcError:null,rpcThrows:false,storageError:false,recipientError:false,notificationError:false,deletes:0,rpcCalls:[]};};
const db={
 auth:{getUser:async()=>({data:{user:{id:'qa-user',email:'qa@example.invalid'}},error:null}),signInWithPassword:async()=>({data:{user:{id:'qa-user'}},error:null}),admin:{deleteUser:async()=>{state.deletes++;return{error:null};}}},
 rpc:async(name,args)=>{state.rpcCalls.push([name,args]);if(state.rpcThrows)throw upstream;return{data:{status:'submitted'},error:state.rpcError};},
 from:table=>({select(){return this;},eq(){return this;},maybeSingle:async()=>({data:table==='admin_users'?null:table==='profiles'?{role:'youth'}:null,error:table==='profiles'&&state.recipientError?upstream:null}),or:async()=>({data:[{youth_user_id:'qa-user',company_user_id:'qa-other'}],error:null}),insert:async()=>({error:state.notificationError?upstream:null})}),
 storage:{from:()=>({list:async()=>({data:[],error:state.storageError?upstream:null})})},
};
class FakeOpenAI {
 constructor(){this.chat={completions:{create:async()=>{if(state.providerFails)throw upstream;return{choices:[{message:{content:'{}'}}]};}}};this.audio={transcriptions:{create:async()=>{throw upstream;}}};}
}
Module._load=function(name,parent,...args){
 if(name==='openai')return{__esModule:true,default:FakeOpenAI};
 if(name==='@supabase/supabase-js')return{createClient:()=>db};
 if(name==='@/lib/api-auth')return{requireApiUser:async()=>state.authorized?{user:{id:'qa-user'},token:'qa-token'}:{response:Response.json({error:'Inloggning krävs.'},{status:401})}};
 if(name==='@/lib/feature-flags')return{get VOICE_CV_ENABLED(){return state.enabled;}};
 if(name==='@/lib/cv-generation')return{writeCv:async()=>{throw upstream;}};
 if(name==='@/lib/analyze-application-followups')return{analyzeApplicationFollowups:async()=>{}};
 if(name==='next/server')return{...load.call(this,name,parent,...args),after:fn=>state.after.push(fn)};
 if(name.startsWith('@/'))return load.call(this,path.resolve(name.slice(2)),parent,...args);
 return load.call(this,name,parent,...args);
};
const req=(url,body,method='POST')=>new Request('https://qa.example.invalid'+url,{method,headers:body instanceof FormData?{}:{'Content-Type':'application/json',authorization:'Bearer qa-token'},body:body instanceof FormData?body:typeof body==='string'?body:JSON.stringify(body)});
const noPrivate=async response=>{const text=await response.text();assert.ok(!text.includes(canary),'API response must contain no upstream marker');safe();passed++;return text?JSON.parse(text):null;};
try {
 reset();const first=reportServerFailure('job_generation_failed',upstream);assert.ok(uuid.test(first));assert.equal(logs[0][1].category,'upstream');safe();passed++;
 const sdk=new RealOpenAI({apiKey:'qa-key',maxRetries:0,fetch:async()=>Response.json({error:{message:canary,type:'api_error',code:'rate_limit_exceeded'}},{status:429})});
 await assert.rejects(sdk.chat.completions.create({model:'qa',messages:[]}),error=>{assert.ok(error.message.includes(canary));reportServerFailure('job_generation_failed',error);return true;});safe();assert.equal(logs.at(-1)[1].category,'rate_limit');passed++;
 let accessed=0;const poison=Object.create({status:502});for(const key of ['name','code','message','status','stack','headers'])Object.defineProperty(poison,key,{get(){accessed++;throw Error(canary);}});poison.toJSON=()=>{accessed++;throw Error(canary);};
 reportServerFailure(canary,poison);safe();assert.equal(logs.at(-1)[1].event,'server_failure');assert.equal(accessed,0);passed++;
 reportServerFailure('job_generation_failed',new Proxy({},{getOwnPropertyDescriptor(){throw Error(canary);}}));safe();passed++;
 for(const status of [-1,0,99,600,NaN,Infinity,'502',{},502.5]){reportServerFailure('job_generation_failed',{status});assert.equal(logs.at(-1)[1].status,undefined);safe();passed++;}
 for(const [error,status,expected] of [[{code:'42501'},undefined,'permission'],[{},403,'permission'],[{code:'23505'},undefined,'conflict'],[{code:'22023'},undefined,'invalid_data'],[{name:'TimeoutError'},undefined,'timeout'],[{},429,'rate_limit'],[{},503,'upstream'],[{name:canary},undefined,'unknown']]){assert.equal(failureCategory(error,status),expected);passed++;}
 console.error=()=>{throw Error('sink unavailable');};assert.ok(uuid.test(reportServerFailure('job_generation_failed',upstream)));passed++;console.error=(...args)=>logs.push(args);
 const session=require('../app/api/voice/session/route.ts').POST;
 reset();let cancelled=false,read=false;globalThis.fetch=async()=>({ok:false,status:429,body:{cancel:async()=>{cancelled=true;}},text:async()=>{read=true;return canary;}});
 let response=await session(req('/api/voice/session','QA SDP'));assert.equal(response.status,502);await noPrivate(response);assert.equal(cancelled,true);assert.equal(read,false,'Failed upstream body is discarded without parsing');
 reset();globalThis.fetch=async()=>{throw upstream;};response=await session(req('/api/voice/session','QA SDP'));assert.equal(response.status,502);await noPrivate(response);
 reset();globalThis.fetch=async()=>new Response('QA SDP answer',{headers:{'content-type':'application/sdp'}});response=await session(req('/api/voice/session','QA SDP'));assert.equal(response.status,200);assert.equal(await response.text(),'QA SDP answer');assert.equal(logs.length,0);passed++;
 reset();state.enabled=false;globalThis.fetch=async()=>{throw Error('Disabled voice must not use transport');};assert.equal((await session(req('/api/voice/session','QA SDP'))).status,404);assert.equal(logs.length,0);passed++;
 const job=require('../app/api/company/job/generate/route.ts').POST;
 reset();response=await job(req('/api/company/job/generate',{title:'QA butik',description:'QA arbetsuppgifter'}));assert.equal(response.status,200);assert.equal((await noPrivate(response)).source,'fallback');assert.equal(logs[0][1].event,'job_generation_failed');
 reset();state.providerFails=false;response=await job(req('/api/company/job/generate',{title:'QA butik'}));assert.equal(response.status,200);assert.equal((await noPrivate(response)).source,'ai');assert.equal(logs.length,0);
 const cv=require('../app/api/youth/cv/generate/route.ts').POST;
 reset();response=await cv(req('/api/youth/cv/generate',{}));assert.equal(response.status,502);await noPrivate(response);assert.equal(logs[0][1].event,'cv_generation_failed');
 const turn=require('../app/api/voice/turn/route.ts').POST;
 reset();const audio=new FormData();audio.set('audio',new File([new Uint8Array(128)],'qa.wav',{type:'audio/wav'}));response=await turn(req('/api/voice/turn',audio));assert.equal(response.status,502);await noPrivate(response);assert.equal(logs[0][1].event,'voice_turn_failed');
 const deletion=require('../app/api/account/route.ts').DELETE;
 for(const mode of ['storageError','recipientError','notificationError']){reset();state[mode]=true;response=await deletion(req('/api/account',{password:'qa-password',expectedUserId:'qa-user'},'DELETE'));assert.equal(response.status,mode==='storageError'?502:204);await noPrivate(response);assert.equal(state.deletes,mode==='storageError'?0:1);assert.ok(logs.length);}
 const submit=require('../app/api/youth/applications/submit/route.ts').POST,body={action:'prepare',jobId:'11111111-1111-4111-8111-111111111111'};
 for(const code of ['42501','22023','23505',undefined]){reset();state.rpcError={message:canary,details:canary,hint:canary,code};response=await submit(req('/api/youth/applications/submit',body));assert.equal(response.status,code==='42501'?403:409);await noPrivate(response);assert.equal(state.after.length,0);}
 reset();state.rpcThrows=true;response=await submit(req('/api/youth/applications/submit',body));assert.equal(response.status,503);await noPrivate(response);
 reset();response=await submit(req('/api/youth/applications/submit',body));assert.equal(response.status,200);await noPrivate(response);assert.equal(state.after.length,1,'Successful submission still schedules analysis');
 reset();state.authorized=false;response=await submit(req('/api/youth/applications/submit',body));assert.equal(response.status,401);await noPrivate(response);assert.equal(state.rpcCalls.length,0);assert.equal(logs.length,0);
 assert.match(applicationSubmissionFailure({code:'42501',message:'Complete your CV first'}).error,/CV/);passed++;
 // New handled server failures must use the fixed-metadata boundary.
 const walk=dir=>readdirSync(dir,{withFileTypes:true}).flatMap(x=>x.isDirectory()?walk(path.join(dir,x.name)):x.name.endsWith('.ts')?[path.join(dir,x.name)]:[]);
 for(const file of walk('app/api')){const ast=ts.createSourceFile(file,readFileSync(file,'utf8'),ts.ScriptTarget.Latest,true);const visit=node=>{if(ts.isCallExpression(node)&&ts.isPropertyAccessExpression(node.expression)&&node.expression.expression.getText(ast)==='console')assert.fail(`Direct server console call: ${file}`);ts.forEachChild(node,visit);};visit(ast);}passed++;
 original.error(`PASS ${passed} private-error checks: actual OpenAI SDK error, fixed metadata/getter safety, real session/job/CV/turn/deletion/submission handlers with mocked Auth/transport, no private response/log content, unchanged fallback/success/authorization and disabled voice. No live provider or user data.`);
}finally{
 console.error=original.error;console.warn=original.warn;globalThis.fetch=original.fetch;Module._load=load;
 if(oldTs)Module._extensions['.ts']=oldTs;else delete Module._extensions['.ts'];
 for(const key of envNames)if(env[key]===undefined)delete process.env[key];else process.env[key]=env[key];
}
