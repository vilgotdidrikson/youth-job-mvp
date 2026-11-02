import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire,Module} from 'node:module';
import ts from 'typescript';
const require=createRequire(import.meta.url),load=Module._load,ext=Module._extensions['.ts'],originalFetch=globalThis.fetch;
let user='A',token='qa-token',reads=0,calls=0,after=false;
Module._load=function(n,parent,...args){if(n==='./supabase'&&parent.filename.endsWith('account-export.ts'))return{getSupabaseClient:()=>({auth:{getSession:async()=>{reads++;return{data:{session:{user:{id:after&&reads>1?'B':user},access_token:token}},error:null};}}})};return load.call(this,n,parent,...args);};
Module._extensions['.ts']=(m,f)=>m._compile(ts.transpileModule(readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,f);
const {requestAccountExport:run}=require('../lib/account-export.ts');
const bytes=new Uint8Array([80,75,3,4,1,2]),filename='matchnwork-ofullstandigt-prov-11111111-1111-4111-8111-111111111111.zip';
let headers,body,status,passed=0;
function reset(){user='A';token='qa-token';reads=calls=0;after=false;status=200;body=bytes;headers={'Content-Type':'application/zip','Content-Length':'6','Content-Disposition':`attachment; filename="${filename}"`,'X-MatchnWork-Export-Coverage':'needs_completion','X-MatchnWork-Export-Expires':new Date(Date.now()+3600000).toISOString()};globalThis.fetch=async(url,init)=>{calls++;assert.equal(url,'/api/account/export-preview');assert.equal(init.cache,'no-store');assert.equal(init.credentials,'omit');assert.equal(init.redirect,'error');assert.equal(init.headers.Authorization,'Bearer qa-token');assert.deepEqual(JSON.parse(init.body),{expectedUserId:'A',password:'qa-password'});return new Response(body,{status,headers});};}
async function test(name,fn){reset();await fn();passed++;console.log('PASS '+name);}
const start=signal=>run('A','qa-password',signal??new AbortController().signal);
try{
 await test('valid binary response remains scoped to original session',async()=>{const out=await start();assert.equal(out.filename,filename);assert.deepEqual(new Uint8Array(await out.blob.arrayBuffer()),bytes);assert.equal(reads,2);});
 await test('wrong account cannot send password',async()=>{user='B';await assert.rejects(start());assert.equal(calls,0);});
 await test('account switch after response withholds file',async()=>{after=true;await assert.rejects(start());});
 for(const statusCode of [401,403,409,429,503])await test('fixed error text for '+statusCode,async()=>{status=statusCode;body='QA_PRIVATE';await assert.rejects(start(),e=>!e.message.includes('QA_PRIVATE'));});
 for(const [field,value] of [['Content-Type','text/html'],['Content-Length','67108865'],['Content-Length','7'],['Content-Disposition','attachment; filename="../../evil.html"'],['X-MatchnWork-Export-Coverage','complete'],['X-MatchnWork-Export-Expires','2000-01-01T00:00:00Z']])await test('unsafe response rejected: '+field,async()=>{headers[field]=value;await assert.rejects(start());});
 await test('actual streamed length cannot exceed declared size',async()=>{headers['Content-Length']='4';await assert.rejects(start());});
 await test('ZIP signature can span two network chunks',async()=>{body=new ReadableStream({start(c){c.enqueue(bytes.slice(0,1));c.enqueue(bytes.slice(1));c.close();}});assert.equal((await start()).blob.size,6);});
 await test('pre-cancelled request performs no fetch',async()=>{const c=new AbortController();c.abort();await assert.rejects(start(c.signal));assert.equal(calls,0);});
 await test('cancelled hanging stream returns no file',async()=>{const c=new AbortController();body=new ReadableStream({start(){}});const pending=start(c.signal);setTimeout(()=>c.abort(),5);await assert.rejects(pending);});
 console.log(`PASS ${passed} account export client checks; Auth/HTTP simulated, no browser download claimed.`);
}finally{Module._load=load;if(ext)Module._extensions['.ts']=ext;else delete Module._extensions['.ts'];globalThis.fetch=originalFetch;}
