import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import ts from 'typescript';
const dir=mkdtempSync(join(tmpdir(),'mnw-playback-'));
const owner='11111111-1111-4111-8111-111111111111',id='22222222-2222-4222-8222-222222222222';
const video={id,owner_id:owner,storage_path:`${owner}/${id}.mp4`,conversation_id:'chat',mime_type:'video/mp4',size_bytes:100,expires_at:new Date(Date.now()+60000).toISOString()};
const state={reads:[],downloads:[],auth:null};
const env={...process.env};
const userClient={from(table){assert.equal(table,'youth_videos');return{select(){return this;},eq(key,value){assert.equal(key,'id');assert.equal(value,id);return this;},async maybeSingle(){return{data:state.reads.shift()??null,error:null};}};}};
const admin={storage:{from(bucket){assert.equal(bucket,'youth-profile-videos');return{async download(path){state.downloads.push(path);return{data:new Blob(['qa'],{type:'video/mp4'}),error:null};}};}}};
globalThis.__playback={createClient:(_url,key,options)=>{assert.equal(options.global.fetch instanceof Function,true);return key==='test-service'?admin:userClient;},auth:async()=>state.auth};
try{
 process.env.NEXT_PUBLIC_SUPABASE_URL='https://test.invalid';process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY='test-public';process.env.SUPABASE_SERVICE_ROLE_KEY='test-service';
 writeFileSync(join(dir,'policy.mjs'),ts.transpileModule(readFileSync('lib/profile-video.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext}}).outputText);
 let code=ts.transpileModule(readFileSync('app/api/videos/playback/route.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext}}).outputText;
 code=code.replace(/import .* from "@supabase\/supabase-js";/,'const createClient=globalThis.__playback.createClient;').replace(/import .* from "next\/server";/,'const NextResponse=Response;').replace(/import .* from "@\/lib\/api-auth";/,'const requireApiUser=globalThis.__playback.auth;').replace('"@/lib/profile-video"','"./policy.mjs"');
 writeFileSync(join(dir,'route.mjs'),code);const{POST}=await import(pathToFileURL(join(dir,'route.mjs')));
 const req=(body={videoId:id},auth=true)=>new Request('https://app.invalid/api/videos/playback',{method:'POST',headers:{'Content-Type':'application/json',...(auth?{Authorization:'Bearer fictional-test'}:{})},body:JSON.stringify(body)});
 const reset=(...reads)=>{state.auth={user:{id:owner},token:'fictional-test'};state.reads=[...reads];state.downloads=[];};
 reset(video,video);assert.equal((await POST(req({},false))).status,401);assert.equal(state.downloads.length,0);
 reset(video,video);state.auth={response:Response.json({error:'expired'},{status:401})};assert.equal((await POST(req())).status,401);assert.equal(state.downloads.length,0);
 reset(video,video);assert.equal((await POST(req({videoId:'../../foreign.mp4'}))).status,400);assert.equal(state.downloads.length,0);
 for(const bad of [null,{...video,conversation_id:null},{...video,revoked_at:'now'},{...video,deleted_at:'now'},{...video,cleanup_started_at:'now'},{...video,expires_at:'invalid'},{...video,expires_at:new Date(0).toISOString()},{...video,storage_path:'https://foreign.invalid/video.mp4'},{...video,size_bytes:40*1024*1024}]){
  reset(bad);assert.equal((await POST(req())).status,404);assert.equal(state.downloads.length,0,'Denied metadata must never reach the service client');
 }
 reset(video,null);assert.equal((await POST(req())).status,404,'Block during download must deny bytes');assert.equal(state.downloads.length,1);
 reset(video,video);const response=await POST(req({videoId:id,storage_path:'ignored/attacker-path'}));assert.equal(response.status,200);assert.equal(await response.text(),'qa');assert.deepEqual(state.downloads,[video.storage_path]);assert.match(response.headers.get('cache-control'),/no-store/);assert.equal(response.headers.get('vercel-cdn-cache-control'),'no-store');assert.equal(state.reads.length,0);
 console.log('PASS video playback route: authentication, ID/path injection, caller-RLS denial before service access, expiry/revocation/cleanup, block during fetch, uncached bytes and ignored client path. Transport simulated.');
}finally{delete globalThis.__playback;process.env=env;rmSync(dir,{recursive:true,force:true});}
