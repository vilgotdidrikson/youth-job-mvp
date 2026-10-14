import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import ts from 'typescript';

const dir=mkdtempSync(join(tmpdir(),'mnw-video-client-'));
const replies=[],calls=[];let uploadResult={error:null},uploadCallback=null;
const storage={
  createSignedUrl:async(...args)=>{calls.push(['sign',...args]);return replies.shift();},
  remove:async(...args)=>{calls.push(['remove',...args]);return replies.shift()??{error:null};},
  upload:async(...args)=>{calls.push(['upload',...args]);if(uploadCallback)await uploadCallback();return uploadResult;},
};
const db={
  from(table){
    const chain={};
    for(const method of ['select','insert','update','delete','eq'])chain[method]=(...args)=>{calls.push([table,method,...args]);return chain;};
    chain.maybeSingle=()=>chain;
    chain.then=(resolve,reject)=>Promise.resolve(replies.shift()??{data:null,error:null}).then(resolve,reject);
    return chain;
  },storage:{from:()=>storage},auth:{getSession:async()=>({data:{session:{access_token:'test-only-not-a-real-token'}}})},
};
globalThis.__videoTestDb=db;
try{
  writeFileSync(join(dir,'policy.mjs'),ts.transpileModule(readFileSync('lib/profile-video.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext}}).outputText);
  let code=ts.transpileModule(readFileSync('lib/video-client.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext}}).outputText;
  code=code.replace(/import .* from "@supabase\/supabase-js";/,'const createClient=()=>globalThis.__videoTestDb;')
    .replace(/import .* from "@\/lib\/supabase";/,'const getSupabaseClient=()=>globalThis.__videoTestDb;')
    .replace('"@/lib/profile-video"','"./policy.mjs"');
  writeFileSync(join(dir,'client.mjs'),code);
  const {getVideo,getProfileVideo,videoPlaybackUrl,revokeVideo,replaceProfileVideo,sendVideoMessage,uploadVideo}=await import(pathToFileURL(join(dir,'client.mjs')));
  const owner='11111111-1111-4111-8111-111111111111',id='22222222-2222-4222-8222-222222222222';
  const video={id,owner_id:owner,storage_path:`${owner}/${id}.mp4`,conversation_id:null,duration_seconds:30,revoked_at:null};
  const reset=(...items)=>{replies.splice(0,replies.length,...items);calls.length=0;uploadResult={error:null};uploadCallback=null;};
  reset({data:video,error:null});assert.deepEqual(await getVideo(id),video);
  reset({data:{...video,revoked_at:'now'},error:null});assert.equal(await getVideo(id),null);
  reset({error:{code:'denied'}});await assert.rejects(getProfileVideo(owner),/hämta/);
  reset({data:null,error:null});assert.equal(await getProfileVideo(owner),null);
  reset();await assert.rejects(videoPlaybackUrl({...video,storage_path:'https://example.org/a.mp4'}),/Ogiltig/);assert.equal(calls.length,0);
  reset({data:{signedUrl:'https://example.org/signed'},error:null});assert.equal(await videoPlaybackUrl(video),'https://example.org/signed');assert.equal(calls[0][2],300);
  reset({data:[{id}],error:null},{error:{code:'offline'}});assert.equal(await revokeVideo(video),false);assert.equal(calls[0][1],'update');assert.equal(calls.at(-1)[0],'remove');
  reset({data:[],error:null});await assert.rejects(revokeVideo(video));assert.ok(!calls.some(c=>c[0]==='remove'));
  reset({error:{code:'lost-response'}},{data:{video_id:id},error:null});assert.equal(await replaceProfileVideo(owner,video,null),true,'Retry accepts own committed pointer');
  reset({data:[],error:null},{data:{video_id:'other'},error:null});await assert.rejects(replaceProfileVideo(owner,video,null),/annan vy/);
  reset({data:[{user_id:owner}],error:null},{data:[{id}],error:null},{error:null});assert.equal(await replaceProfileVideo(owner,null,video),true);assert.ok(calls.some(c=>c[1]==='eq'&&c[2]==='video_id'&&c[3]===id),'CAS binds old pointer');
  reset({error:{code:'23505'}},{data:{id:'message',conversation_id:'conversation',sender_user_id:owner,video_kind:'file',video_id:id}});
  await sendVideoMessage('conversation',owner,'message',video);
  assert.equal(calls.filter(c=>c[1]==='insert').length,1,'Lost response retries do not duplicate messages');
  reset({error:{code:'42501'}},{data:null});await assert.rejects(sendVideoMessage('conversation',owner,'message',video),/kunde inte skickas/);
  const file=new File([new Uint8Array(100)],'test.mp4',{type:'video/mp4'});
  const cancelled=new AbortController();cancelled.abort();reset();await assert.rejects(uploadVideo(file,30,owner,null,cancelled.signal));assert.equal(calls.length,0);
  reset({error:null});const uploaded=await uploadVideo(file,30,owner,null,new AbortController().signal);
  assert.equal(uploaded.owner_id,owner);assert.ok(uploaded.storage_path.startsWith(owner+'/'));assert.equal(calls.find(c=>c[0]==='upload')[3].upsert,false);
  reset({error:null},{data:[{id}],error:null},{error:null});uploadResult={error:{code:'offline'}};
  await assert.rejects(uploadVideo(file,30,owner,null,new AbortController().signal));assert.ok(calls.some(c=>c[0]==='remove'),'Failed upload cleanup attempted');
  const aborted=new AbortController();reset({error:null},{data:[{id}],error:null},{error:null});uploadCallback=async()=>aborted.abort();
  await assert.rejects(uploadVideo(file,30,owner,null,aborted.signal));assert.ok(calls.some(c=>c[1]==='update'),'Late abort revokes asset before cleanup');
  console.log('PASS video client: signing TTL, invalid paths, CAS, lost responses, idempotent sends, failed/aborted uploads and cleanup. Transport simulated.');
}finally{delete globalThis.__videoTestDb;rmSync(dir,{recursive:true,force:true});}
