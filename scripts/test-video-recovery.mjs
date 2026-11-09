import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire, Module } from 'node:module';
import path from 'node:path';
import ts from 'typescript';
import { createClient } from '@supabase/supabase-js';
const require=createRequire(import.meta.url), originalLoad=Module._load;
Module._extensions['.ts']=(mod,file)=>mod._compile(ts.transpileModule(readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,file);
const owner='11111111-1111-4111-8111-111111111111',other='22222222-2222-4222-8222-222222222222',id='33333333-3333-4333-8333-333333333333';
let user=owner,authHook,replies=[],calls=[];
const db=createClient('https://qa.invalid','test-only-public-key',{auth:{persistSession:false,autoRefreshToken:false},global:{fetch:async(url,init)=>{
 calls.push({url:new URL(url),...init});const reply=replies.shift();assert.ok(reply,'Explicit simulated HTTP response required');reply.before?.();return new Response(JSON.stringify(reply.body),{status:reply.status??200,headers:{'Content-Type':'application/json'}});
}}});
Module._load=function(name,parent,...rest){
 if(name==='@/lib/auth')return{getCurrentUser:async()=>{authHook?.();return user?{id:user}:null;}};
 if(name==='@/lib/supabase')return{getSupabaseClient:()=>db};
 return originalLoad.call(this,name.startsWith('@/')?path.resolve(name.slice(2)):name,parent,...rest);
};
const reset=(...values)=>{replies=values;calls=[];user=owner;authHook=undefined;};
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return{promise,resolve,reject};};
const settle=async()=>{for(let i=0;i<12;i++)await Promise.resolve();};
const video={id,owner_id:owner,conversation_id:'conversation',storage_path:`${owner}/${id}.mp4`,revoked_at:null,duration_seconds:20};
try{
 const {readChatVideoAccess,sendVideoMessage,revokeVideo}=require('../lib/video-client.ts');
 const signal=new AbortController().signal;
 reset({body:{id:'conversation',match_id:'match'}});assert.equal(await readChatVideoAccess(owner,'conversation',signal),true);assert.equal(calls[0].url.searchParams.get('id'),'eq.conversation');assert.equal(calls[0].url.searchParams.get('youth_user_id'),`eq.${owner}`);assert.ok(calls[0].signal instanceof AbortSignal);
 for(const body of [null,{id:'wrong',match_id:'match'},{id:'conversation',match_id:null}]){reset({body});await assert.rejects(readChatVideoAccess(owner,'conversation',signal));}
 reset({body:{id:'conversation',match_id:'match'},before:()=>{user=other;}});await assert.rejects(readChatVideoAccess(owner,'conversation',signal));
 reset();user=other;await assert.rejects(readChatVideoAccess(owner,'conversation',signal));assert.equal(calls.length,0);
 reset({body:null,status:201});await sendVideoMessage('conversation',owner,id,video,signal);assert.deepEqual(JSON.parse(calls[0].body),{id,conversation_id:'conversation',sender_user_id:owner,message_text:'Videomeddelande',video_kind:'file',video_id:id});assert.ok(calls[0].signal);
 const duplicate={status:409,body:{code:'23505',message:'duplicate'}},receipt={id,conversation_id:'conversation',sender_user_id:owner,video_kind:'file',video_id:id};
 reset(duplicate,{body:receipt});await sendVideoMessage('conversation',owner,id,video,signal);assert.equal(calls[1].url.searchParams.get('sender_user_id'),`eq.${owner}`);assert.equal(calls[1].url.searchParams.get('conversation_id'),'eq.conversation');
 for(const patch of [{id:other},{sender_user_id:other},{conversation_id:'wrong'},{video_kind:'profile'},{video_id:other}]){reset(duplicate,{body:{...receipt,...patch}});await assert.rejects(sendVideoMessage('conversation',owner,id,video,signal));}
 reset(duplicate,{status:403,body:{code:'42501',message:'denied'}});await assert.rejects(sendVideoMessage('conversation',owner,id,video,signal));
 reset({status:403,body:{code:'42501',message:'denied'}});await assert.rejects(sendVideoMessage('conversation',owner,id,video,signal));assert.equal(calls.length,1,'Permission error cannot be converted to duplicate success');
 reset();user=other;await assert.rejects(sendVideoMessage('conversation',owner,id,video,signal));assert.equal(calls.length,0);
 const aborted=new AbortController();reset();authHook=()=>aborted.abort();await assert.rejects(sendVideoMessage('conversation',owner,id,video,aborted.signal));assert.equal(calls.length,0,'Abort during auth prevents next write');
 reset({body:[{id}]});assert.equal(await revokeVideo(video,signal),true);assert.equal(calls[0].method,'PATCH');assert.equal(calls[0].url.searchParams.get('owner_id'),`eq.${owner}`);assert.ok(calls[0].signal);
 reset({body:[]});await assert.rejects(revokeVideo(video,signal));reset();user=other;await assert.rejects(revokeVideo(video,signal));assert.equal(calls.length,0);
 console.log('PASS actual video client + installed Supabase SDK: scoped access, owner/abort guards, signal propagation, exact duplicate receipt, denied/mismatched receipt and owned revocation. HTTP simulated; no live RLS claim.');

 const {createChatVideoTransfer}=require('../lib/chat-video-transfer.ts');
 const file=new File(['qa'],'qa.mp4',{type:'video/mp4'}),states=[],uploads=[],sends=[],revokes=[];
 const make=(options={})=>createChatVideoTransfer(owner,'conversation',s=>states.push(s),{
  upload:async(f,d,o,c,s)=>{uploads.push({f,d,o,c,s});return video;},
  send:(c,o,m,v,s)=>{const p=deferred();sends.push({c,o,m,v,s,...p});return p.promise;},
  revoke:(v,s)=>{const p=deferred();revokes.push({v,s,...p});return p.promise;},...options,
 });
 const transfer=make();const first=transfer.send(file,20);assert.equal(await transfer.send(file,20),false);await settle();assert.equal(uploads.length,1);assert.equal(sends.length,1);
 sends[0].reject(new Error('uncertain'));assert.equal(await first,false);assert.equal(states.at(-1).hasPending,true);assert.match(states.at(-1).error,/Förhandsvisningen finns kvar/);
 const retry=transfer.send(file,20);await settle();assert.equal(uploads.length,1,'Retry reuses uploaded private video');assert.equal(sends[1].m,sends[0].m);sends[1].resolve();assert.equal(await retry,true);assert.equal(states.at(-1).hasPending,false);
 const next=transfer.send(file,20);await settle();assert.equal(uploads.length,2);assert.notEqual(sends[2].m,sends[1].m);sends[2].reject(new Error('uncertain'));await next;
 const discard=transfer.discard();assert.equal(await transfer.discard(),false);assert.equal(revokes.length,1);revokes[0].reject(new Error('network'));assert.equal(await discard,false);assert.equal(states.at(-1).hasPending,true);
 const discardRetry=transfer.discard();revokes[1].resolve(true);assert.equal(await discardRetry,true);assert.equal(states.at(-1).hasPending,false);transfer.stop();
 const upload=deferred(),lateStates=[];let startedSends=0;
 const detached=createChatVideoTransfer(owner,'conversation',s=>lateStates.push(s),{upload:()=>upload.promise,send:async()=>{startedSends++;}});
 const waiting=detached.send(file,20);detached.stop();const count=lateStates.length;upload.resolve(video);assert.equal(await waiting,false);await settle();assert.equal(startedSends,0,'Leaving upload never begins message insert');assert.equal(lateStates.length,count);assert.equal(await detached.send(file,20),false);
 const pendingUpload=deferred();const cancelled=make({upload:()=>pendingUpload.promise});const cancelAttempt=cancelled.send(file,20);cancelled.cancelUpload();assert.equal(await cancelAttempt,false);pendingUpload.resolve(video);await settle();assert.equal(sends.length,3);cancelled.stop();
 const timeoutSend=deferred();const timed=make({send:(c,o,m,v,s)=>{sends.push({c,o,m,v,s});return sends.length===4?timeoutSend.promise:Promise.resolve();},writeTimeoutMs:5});
 assert.equal(await timed.send(file,20),false);assert.equal(sends[3].s.aborted,true);assert.equal(states.at(-1).hasPending,true);timeoutSend.resolve();await settle();assert.equal(await timed.send(file,20),true);assert.equal(sends[3].m,sends[4].m);timed.stop();
 const lateUpload=deferred();const timedUpload=make({upload:()=>lateUpload.promise,uploadTimeoutMs:5});assert.equal(await timedUpload.send(file,20),false);lateUpload.resolve(video);await settle();assert.equal(sends.length,5,'Late upload after timeout cannot send');timedUpload.stop();
 console.log('PASS actual video transfer: synchronous send/discard locks, upload/message reuse, explicit revocation retry, upload cancel/timeout, send timeout/late response, stop prevents later writes and stale UI updates.');
}finally{Module._load=originalLoad;}
