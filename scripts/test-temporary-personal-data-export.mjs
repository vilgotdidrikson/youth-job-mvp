import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {createRequire,Module} from 'node:module';
import ts from 'typescript';
const require=createRequire(import.meta.url),oldLoad=Module._load,oldTs=Module._extensions['.ts'];
Module._load=function(n,...args){return n==='server-only'?{}:oldLoad.call(this,n,...args);};
Module._extensions['.ts']=(m,f)=>m._compile(ts.transpileModule(readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText,f);
const {beginTemporaryPersonalDataExport:begin,storeTemporaryPersonalDataExport:store,readTemporaryPersonalDataExport:read,createTemporaryExportStorageClient:factory,TemporaryExportError}=require('../lib/server/temporary-personal-data-export.ts');
const {processPersonalDataExportCleanup:clean,EXPORT_STORAGE_BUCKET:bucket}=require('../lib/personal-data-export-cleanup.ts');
const subject='11111111-1111-4111-8111-111111111111',id='22222222-2222-4222-8222-222222222222',lock='33333333-3333-4333-8333-333333333333',other='44444444-4444-4444-8444-444444444444';
const bytes=new TextEncoder().encode('PK QA fictitious ZIP bytes Åsa'),sha=x=>createHash('sha256').update(x).digest('hex');
let passed=0;
function fixture(){
 const job={id,subjectId:subject,path:`${subject}/${id}.zip`,expiresAt:new Date(Date.now()+3600000).toISOString()};
 const state={calls:[],file:bytes.slice(),job:{...job,status:'building'},ready:true,uploadError:null,readError:null,finishError:null,metadataReads:0,after:null,removeError:null,cleanupFinish:true,cleanupError:null,jobs:[{id,subjectId:subject,path:job.path,lockToken:lock}]};
 const client={rpc:async(name,args)=>{
  state.calls.push(name);
  if(name==='begin_personal_data_export'){assert.deepEqual(args,{p_subject_id:subject,p_export_id:id});return{data:state.job,error:null};}
  if(name==='finish_personal_data_export'){assert.equal(args.p_subject_id,subject);assert.equal(args.p_export_id,id);if(args.p_success){assert.equal(args.p_size_bytes,bytes.length);assert.equal(args.p_content_sha256,sha(bytes));}return{data:state.ready,error:state.finishError};}
  if(name==='read_personal_data_export'){assert.deepEqual(args,{p_subject_id:subject,p_export_id:id});state.metadataReads++;return{data:state.metadataReads>1&&state.after?state.after:{...state.job,status:'ready',sizeBytes:bytes.length,sha256:sha(bytes)},error:null};}
  if(name==='reconcile_personal_data_export_orphans')return{data:0,error:state.cleanupError};
  if(name==='claim_personal_data_export_cleanup')return{data:state.jobs,error:state.cleanupError};
  if(name==='finish_personal_data_export_cleanup'){assert.deepEqual(args,{p_export_id:id,p_lock_token:lock,p_success:!state.removeError});return{data:state.cleanupFinish,error:null};}
  throw Error('Unexpected RPC');
 },storage:{from(selected){assert.equal(selected,bucket);return{
  upload:async(path,data,options)=>{state.calls.push('upload');assert.equal(path,job.path);assert.deepEqual(options,{contentType:'application/zip',cacheControl:'0',upsert:false});assert.notEqual(data,bytes);state.file=data.slice();return{data:{path},error:state.uploadError};},
  download:async(path,options,parameters)=>{state.calls.push('download');assert.equal(path,job.path);assert.match(options.cacheNonce,/^[a-f0-9-]{36}$/);assert.ok('signal' in parameters);return{data:new Blob([state.file]),error:state.readError};},
  remove:async paths=>{state.calls.push('remove');assert.deepEqual(paths,[job.path]);return{data:[],error:state.removeError};},
 };}}};
 return{job,state,client};
}
async function test(name,fn){await fn();passed++;console.log('PASS '+name);}
const rejects=p=>assert.rejects(p,e=>e instanceof TemporaryExportError&&!e.message.includes('QA_PRIVATE'));
try{
 await test('reserve/upload/read uses generated owned path, immutable handle, fixed bucket, no upsert and checksum',async()=>{const f=fixture(),job=await begin(f.client,subject,id);assert.ok(Object.isFrozen(job));await store(f.client,job,bytes);assert.deepEqual(await read(f.client,subject,id),bytes);assert.deepEqual(f.state.calls,['begin_personal_data_export','upload','finish_personal_data_export','read_personal_data_export','download','read_personal_data_export']);});
 await test('busy reservation is explicit',async()=>{const f=fixture();f.state.job={status:'busy'};await assert.rejects(begin(f.client,subject,id),e=>e.code==='busy');});
 for(const field of ['id','subjectId','path','expiresAt'])await test('unsafe reservation metadata rejected: '+field,async()=>{const f=fixture();f.state.job[field]=field==='expiresAt'?'2000-01-01T00:00:00Z':field==='path'?'other/file.zip':other;await rejects(begin(f.client,subject,id));assert.ok(!f.state.calls.includes('upload'));});
 for(const data of [new Uint8Array(),new TextEncoder().encode('not zip'),new Uint8Array(new SharedArrayBuffer(4))])await test('invalid package cannot be uploaded: '+data.length,async()=>{const f=fixture();await assert.rejects(store(f.client,f.job,data));assert.equal(f.state.calls.length,0);});
 for(const mode of ['upload','finish'])await test('ambiguous '+mode+' failure schedules metadata for cleanup',async()=>{const f=fixture();if(mode==='upload')f.state.uploadError={message:'QA_PRIVATE'};else f.state.ready=false;await rejects(store(f.client,f.job,bytes));assert.equal(f.state.calls.at(-1),'finish_personal_data_export');});
 await test('expired handle prevents upload',async()=>{const f=fixture();f.job.expiresAt='2000-01-01T00:00:00Z';await rejects(store(f.client,f.job,bytes));assert.equal(f.state.calls.length,0);});
 for(const mode of ['different size','same size changed bytes','Storage error'])await test('bad stored file withheld: '+mode,async()=>{const f=fixture();if(mode==='different size')f.state.file=new Uint8Array(2);if(mode==='same size changed bytes')f.state.file[4]=0;if(mode==='Storage error')f.state.readError={message:'QA_PRIVATE'};await rejects(read(f.client,subject,id));});
 for(const mode of ['expired','withdrawn','changed hash','changed expiry','foreign path'])await test('metadata recheck withholds bytes after download: '+mode,async()=>{const f=fixture();f.state.after={...f.state.job,status:'ready',sizeBytes:bytes.length,sha256:sha(bytes)};if(mode==='expired')f.state.after.expiresAt='2000-01-01T00:00:00Z';if(mode==='withdrawn')f.state.after={status:'unavailable'};if(mode==='changed hash')f.state.after.sha256='a'.repeat(64);if(mode==='changed expiry')f.state.after.expiresAt=new Date(Date.now()+7200000).toISOString();if(mode==='foreign path')f.state.after.path=`${other}/${id}.zip`;await rejects(read(f.client,subject,id));assert.ok(f.state.calls.includes('download'));});
 await test('unknown/foreign export status blocks Storage fetch',async()=>{const f=fixture();f.client.rpc=async()=>({data:{status:'unavailable'},error:null});await rejects(read(f.client,subject,id));assert.ok(!f.state.calls.includes('download'));});
 for(const operation of ['reserve','store','read'])await test('pre-cancelled '+operation+' performs no I/O',async()=>{const f=fixture(),c=new AbortController();c.abort();await rejects(operation==='reserve'?begin(f.client,subject,id,c.signal):operation==='store'?store(f.client,f.job,bytes,c.signal):read(f.client,subject,id,c.signal));assert.equal(f.state.calls.length,0);});
 await test('worker physically removes via fixed Storage API before finishing metadata',async()=>{const f=fixture();assert.deepEqual(await clean(f.client),{claimed:1,deleted:1,retry:0});assert.deepEqual(f.state.calls,['reconcile_personal_data_export_orphans','claim_personal_data_export_cleanup','remove','finish_personal_data_export_cleanup']);});
 await test('Storage failure retains retry state',async()=>{const f=fixture();f.state.removeError={message:'QA_PRIVATE'};assert.deepEqual(await clean(f.client),{claimed:1,deleted:0,retry:1});});
 await test('stale/failed cleanup acknowledgement stops worker',async()=>{const f=fixture();f.state.cleanupFinish=false;await assert.rejects(clean(f.client));});
 await test('failed orphan reconciliation cannot silently skip the sweep',async()=>{const f=fixture();f.state.cleanupError={message:'QA_PRIVATE'};await assert.rejects(clean(f.client));assert.ok(!f.state.calls.includes('remove'));});
 for(const mode of ['path','subject','lock'])await test('malformed service cleanup job cannot delete arbitrary object: '+mode,async()=>{const f=fixture();f.state.jobs[0][mode==='subject'?'subjectId':mode==='lock'?'lockToken':'path']='QA_PRIVATE';await assert.rejects(clean(f.client));assert.ok(!f.state.calls.includes('remove'));});
 const originalFetch=globalThis.fetch;
 await test('installed SDK serializes private Storage operations and bounded abortable service transport',async()=>{
  const f=fixture(),calls=[];globalThis.fetch=async(input,init)=>{
   const url=new URL(String(input)),headers=new Headers(init.headers);assert.equal(headers.get('authorization'),'Bearer qa-service');assert.ok(init.signal instanceof AbortSignal);assert.equal(init.cache,'no-store');calls.push(url.pathname);
   if(url.pathname.endsWith('/begin_personal_data_export'))return Response.json(f.state.job);
   if(url.pathname.endsWith('/finish_personal_data_export')){assert.equal(JSON.parse(init.body).p_content_sha256,sha(bytes));return Response.json(true);}
   if(url.pathname.endsWith('/read_personal_data_export'))return Response.json({...f.state.job,status:'ready',sizeBytes:bytes.length,sha256:sha(bytes)});
   if(url.pathname.includes('/storage/v1/object/')){
    assert.ok(url.pathname.endsWith('/'+bucket+'/'+f.job.path));
    if(init.method==='POST'){assert.equal(headers.get('x-upsert'),'false');assert.equal(headers.get('cache-control'),'max-age=0');assert.equal(headers.get('content-type'),'application/zip');assert.deepEqual(new Uint8Array(init.body),bytes);return Response.json({Id:id,Key:bucket+'/'+f.job.path});}
    assert.ok(url.searchParams.has('cacheNonce'));return new Response(bytes,{headers:{'Content-Type':'application/zip'}});
   }
   throw Error('Unexpected URL');
  };
  try{const service=factory('https://qa.invalid','qa-service'),job=await begin(service,subject,id);await store(service,job,bytes);assert.deepEqual(await read(service,subject,id),bytes);assert.equal(calls.length,6);}finally{globalThis.fetch=originalFetch;}
 });
 await test('service client factory passes an already-cancelled signal to every transport',async()=>{const c=new AbortController();c.abort();globalThis.fetch=async(input,init)=>{assert.equal(init.signal.aborted,true);throw new DOMException('Aborted','AbortError');};try{await rejects(begin(factory('https://qa.invalid','qa-service',c.signal),subject,id));}finally{globalThis.fetch=originalFetch;}});
 console.log(`PASS ${passed} temporary export storage/cleanup checks. SDK transport simulated; no actual remote files or scheduled cleanup.`);
}finally{Module._load=oldLoad;if(oldTs)Module._extensions['.ts']=oldTs;else delete Module._extensions['.ts'];}
