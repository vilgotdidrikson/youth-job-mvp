import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire,Module} from 'node:module';
import ts from 'typescript';
const require=createRequire(import.meta.url),oldLoad=Module._load,oldTs=Module._extensions['.ts'];
Module._extensions['.ts']=(m,f)=>m._compile(ts.transpileModule(readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText,f);
const {createPersonalDataExportCleanupHandler:create}=require('../lib/personal-data-export-cleanup-handler.ts');
const token='a'.repeat(64),subject='11111111-1111-4111-8111-111111111111',id='22222222-2222-4222-8222-222222222222',lock='33333333-3333-4333-8333-333333333333';
let state,passed=0;
function fixture(){state={created:0,calls:[],valid:true,validationError:null,workerError:null};const client={rpc:async(name,args)=>{state.calls.push(name);if(name==='validate_personal_data_export_cleanup_token'){assert.deepEqual(args,{p_token:token});return{data:state.valid,error:state.validationError};}if(name==='reconcile_personal_data_export_orphans')return{data:0,error:state.workerError};if(name==='claim_personal_data_export_cleanup')return{data:[{id,subjectId:subject,path:`${subject}/${id}.zip`,lockToken:lock}],error:null};if(name==='finish_personal_data_export_cleanup'){assert.equal(args.p_success,true);return{data:true,error:null};}throw Error('QA_PRIVATE');},storage:{from(bucket){assert.equal(bucket,'personal-data-exports');return{remove:async paths=>{assert.deepEqual(paths,[`${subject}/${id}.zip`]);state.calls.push('remove');return{error:null};}};}}};return create(()=>{state.created++;return client;});}
const req=(headers={},method='POST',search='')=>new Request('https://qa.invalid/functions/v1/personal-data-export-cleanup'+search,{method,headers:{Authorization:'Bearer '+token,...headers},...(method==='POST'?{body:'{"path":"OTHER_ACCOUNT/QA_PRIVATE"}'}:{})});
async function test(name,fn){const handle=fixture();await fn(handle);passed++;console.log('PASS '+name);}
try{
 for(const method of ['GET','PUT','DELETE'])await test('unsupported method performs no privileged work: '+method,async h=>{const r=await h(req({},method));assert.equal(r.status,405);assert.equal(state.created,0);assert.equal(r.headers.get('cache-control'),'no-store');});
 for(const value of ['', 'Bearer user.jwt.token', 'Bearer '+token.toUpperCase(),'Basic '+token])await test('invalid worker credential never creates service client: '+value.slice(0,16),async h=>{assert.equal((await h(req({Authorization:value}))).status,401);assert.equal(state.created,0);});
 await test('query token/path rejected before creating service client',async h=>{assert.equal((await h(req({},'POST','?path=QA_PRIVATE'))).status,400);assert.equal(state.created,0);});
 for(const value of [false,null,'true',1])await test('Vault validation requires literal true: '+value,async h=>{state.valid=value;const r=await h(req());assert.equal(r.status,401);assert.deepEqual(state.calls,['validate_personal_data_export_cleanup_token']);assert.equal(await r.text(),'');});
 await test('validation outage blocks cleanup with sanitized 503',async h=>{state.validationError={message:'QA_PRIVATE'};const r=await h(req());assert.equal(r.status,503);assert.ok(!(await r.text()).includes('QA_PRIVATE'));assert.equal(state.calls.length,1);});
 await test('cleanup failure sanitized and cache forbidden',async h=>{state.workerError={message:'QA_PRIVATE'};const r=await h(req());assert.equal(r.status,503);assert.equal(r.headers.get('cache-control'),'no-store');assert.equal(await r.text(),'');});
 await test('real worker ignores caller path and returns only aggregate counts',async h=>{const r=await h(req());assert.equal(r.status,200);assert.equal(r.headers.get('x-content-type-options'),'nosniff');assert.deepEqual(await r.json(),{claimed:1,deleted:1,retry:0});assert.deepEqual(state.calls,['validate_personal_data_export_cleanup_token','reconcile_personal_data_export_orphans','claim_personal_data_export_cleanup','remove','finish_personal_data_export_cleanup']);});
 await test('throwing service construction cannot leak details',async()=>{const r=await create(()=>{throw Error('QA_PRIVATE');})(req());assert.equal(r.status,503);assert.equal(await r.text(),'');});
 console.log(`PASS ${passed} protected export cleanup handler checks. Real handler/worker with simulated privileged client.`);
}finally{Module._load=oldLoad;if(oldTs)Module._extensions['.ts']=oldTs;else delete Module._extensions['.ts'];}
