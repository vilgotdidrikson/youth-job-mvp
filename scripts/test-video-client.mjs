import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import ts from 'typescript';

const dir=mkdtempSync(join(tmpdir(),'mnw-video-client-'));
const replies=[],calls=[];let uploadResult={error:null},uploadCallback=null;
const storage={
  download:async(...args)=>{calls.push(['download',...args]);return replies.shift();},
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
const originalFetch=globalThis.fetch;
globalThis.fetch=async(url,options)=>{calls.push(['playback',url,options]);const reply=replies.shift();return reply?.error?new Response(null,{status:404}):new Response(reply?.data??new Blob(['qa']));};
try{
  writeFileSync(join(dir,'policy.mjs'),ts.transpileModule(readFileSync('lib/profile-video.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext}}).outputText);
  let code=ts.transpileModule(readFileSync('lib/video-client.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext}}).outputText;
  code=code.replace(/import .* from "@supabase\/supabase-js";/,'const createClient=()=>globalThis.__videoTestDb;')
    .replace(/import .* from "@\/lib\/supabase";/,'const getSupabaseClient=()=>globalThis.__videoTestDb;')
    .replace('"@/lib/profile-video"','"./policy.mjs"').replace(/import .* from "@\/lib\/video-retention";/,'const videoHasExpired=value=>!!value&&Date.parse(value)<=Date.now();');
  writeFileSync(join(dir,'client.mjs'),code);
  const {getVideo,videoPlaybackUrl,revokeVideo,sendVideoMessage,uploadVideo}=await import(pathToFileURL(join(dir,'client.mjs')));
  const owner='11111111-1111-4111-8111-111111111111',id='22222222-2222-4222-8222-222222222222';
  const video={id,owner_id:owner,storage_path:`${owner}/${id}.mp4`,conversation_id:"conversation",duration_seconds:30,revoked_at:null};
  const reset=(...items)=>{replies.splice(0,replies.length,...items);calls.length=0;uploadResult={error:null};uploadCallback=null;};
  reset({data:video,error:null});assert.deepEqual(await getVideo(id),video);
  reset({data:{...video,revoked_at:'now'},error:null});assert.equal(await getVideo(id),null);
  reset({error:{code:'denied'}});await assert.rejects(getVideo(id),/hämta/);
  reset({data:{...video,conversation_id:null},error:null});assert.equal(await getVideo(id),null);
  reset();await assert.rejects(videoPlaybackUrl({...video,conversation_id:null}),/Ogiltig/);assert.equal(calls.length,0);
  reset();await assert.rejects(videoPlaybackUrl({...video,storage_path:'https://example.org/a.mp4'}),/Ogiltig/);assert.equal(calls.length,0);
  reset({data:new Blob(['qa']),error:null});const src=await videoPlaybackUrl(video);assert.ok(src.startsWith('blob:'));URL.revokeObjectURL(src);assert.equal(calls[0][0],'playback');assert.equal(calls[0][1],'/api/videos/playback');assert.equal(calls[0][2].cache,'no-store');assert.deepEqual(JSON.parse(calls[0][2].body),{videoId:id});
  reset({error:{code:'denied'}});await assert.rejects(videoPlaybackUrl(video),/behörighet/);
  reset();await assert.rejects(videoPlaybackUrl({...video,expires_at:new Date(Date.now()-1).toISOString()}),/tillgänglig/);assert.equal(calls.length,0);
  reset({data:[{id}],error:null});assert.equal(await revokeVideo(video),true);assert.equal(calls[0][1],'update');assert.ok(!calls.some(c=>c[0]==='remove'),'Only server cleanup removes bytes');
  reset({data:[],error:null});await assert.rejects(revokeVideo(video));assert.ok(!calls.some(c=>c[0]==='remove'));
  reset({error:{code:'23505'}},{data:{id:'message',conversation_id:'conversation',sender_user_id:owner,video_kind:'file',video_id:id}});
  await sendVideoMessage('conversation',owner,'message',video);
  assert.equal(calls.filter(c=>c[1]==='insert').length,1,'Lost response retries do not duplicate messages');
  reset({error:{code:'42501'}},{data:null});await assert.rejects(sendVideoMessage('conversation',owner,'message',video),/kunde inte skickas/);
  for(const invalid of [null,{...video,conversation_id:null},{...video,conversation_id:'other'},{...video,owner_id:'other'}]){reset();await assert.rejects(sendVideoMessage('conversation',owner,'message',invalid),/tillhör/);assert.equal(calls.length,0);}
  const file=new File([new Uint8Array(100)],'test.mp4',{type:'video/mp4'});
  reset();await assert.rejects(uploadVideo(file,30,owner,null,new AbortController().signal),/Välj en chatt/);assert.equal(calls.length,0);
  const cancelled=new AbortController();cancelled.abort();reset();await assert.rejects(uploadVideo(file,30,owner,"conversation",cancelled.signal));assert.equal(calls.length,0);
  reset({error:null});const uploaded=await uploadVideo(file,30,owner,"conversation",new AbortController().signal);
  assert.equal(uploaded.owner_id,owner);assert.ok(uploaded.storage_path.startsWith(owner+'/'));assert.equal(calls.find(c=>c[0]==='upload')[3].upsert,false);
  reset({error:null},{data:[{id}],error:null},{error:null});uploadResult={error:{code:'offline'}};
  await assert.rejects(uploadVideo(file,30,owner,"conversation",new AbortController().signal));assert.ok(calls.some(c=>c[1]==='update'),'Failed upload revoked for scheduled cleanup');
  const aborted=new AbortController();reset({error:null},{data:[{id}],error:null},{error:null});uploadCallback=async()=>aborted.abort();
  await assert.rejects(uploadVideo(file,30,owner,"conversation",aborted.signal));assert.ok(calls.some(c=>c[1]==='update'),'Late abort revokes asset before cleanup');
  console.log('PASS video client: authenticated downloads and expiry, invalid paths and retired profile rejection, lost responses, idempotent sends, failed/aborted uploads and cleanup. Transport simulated.');
}finally{globalThis.fetch=originalFetch;delete globalThis.__videoTestDb;rmSync(dir,{recursive:true,force:true});}
