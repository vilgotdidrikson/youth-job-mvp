import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import ts from 'typescript';
const require=createRequire(import.meta.url);
function compile(file,imports={}) {
 const module={exports:{}};
 const code=ts.transpileModule(readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;
 new Function('module','exports','require',code)(module,module.exports,name=>imports[name]??require(name));return module.exports;
}
const retention=compile('lib/video-retention.ts');
const deadline='2026-10-18T14:00:00Z',at=Date.parse(deadline);
assert.equal(retention.videoHasExpired(deadline,at-1),false);
assert.equal(retention.videoHasExpired(deadline,at),true);
assert.equal(retention.videoHasExpired(deadline,at+1),true);
assert.equal(retention.videoHasExpired('invalid',at),true);
assert.match(retention.videoExpiryLabel(deadline),/16:00:00/);
const {processVideoCleanup}=compile('lib/video-cleanup-worker.ts');
const job={video_id:'qa-video',storage_path:'qa-owner/qa-video.mp4',lock_token:'qa-lease'};
function mock({removeError=null,throws=false,finish=true,claimError=null}={}) {
 const calls=[];return {calls,client:{
  rpc:async(name,args)=>{calls.push([name,args]);return name==='claim_video_cleanup'?{data:[job],error:claimError}:{data:finish,error:null};},
  storage:{from(bucket){assert.equal(bucket,'youth-profile-videos');return{async remove(paths){calls.push(['remove',paths]);if(throws)throw Error('offline');return{error:removeError};}};}}
 }};
}
for(const options of [{},{removeError:{code:'offline'}},{throws:true}]) {
 const {client,calls}=mock(options),result=await processVideoCleanup(client);
 const success=!options.removeError&&!options.throws;
 assert.deepEqual(result,{claimed:1,deleted:success?1:0,retry:success?0:1});
 assert.deepEqual(calls[1],['remove',[job.storage_path]]);
 assert.equal(calls[2][1].p_success,success);assert.equal(calls[2][1].p_lock_token,job.lock_token);
}
await assert.rejects(processVideoCleanup(mock({finish:false}).client),/lease/);
await assert.rejects(processVideoCleanup(mock({claimError:{code:'offline'}}).client),/claim/);
assert.deepEqual(await processVideoCleanup({rpc:async()=>({data:[],error:null})}),{claimed:0,deleted:0,retry:0});

// Execute the actual Edge handler with simulated RPC/transport. It authenticates
// before cleanup, accepts POST only and never takes paths from the request body.
let handler,valid=false,rpcError=null,cleanups=0;
const edge=readFileSync('supabase/functions/video-cleanup/index.js','utf8').replace(/^import .*;\n/gm,'');
new Function('Deno','createClient','processVideoCleanup',edge)(
 {serve:fn=>handler=fn,env:{get:()=> 'test-only'}},
 ()=>({rpc:async()=>({data:valid,error:rpcError})}),async()=>{cleanups++;return{claimed:0};}
);
const request=(method='POST',token)=>new Request('https://example.test/worker',{method,headers:token?{Authorization:`Bearer ${token}`}:{}});
assert.equal((await handler(request('GET'))).status,405);
assert.equal((await handler(request())).status,401);
assert.equal((await handler(request('POST','user-jwt'))).status,401);
assert.equal((await handler(request('POST','a'.repeat(64)))).status,401);
assert.equal(cleanups,0);rpcError={code:'offline'};
assert.equal((await handler(request('POST','a'.repeat(64)))).status,503);
rpcError=null;valid=true;assert.equal((await handler(request('POST','a'.repeat(64)))).status,200);assert.equal(cleanups,1);

const nodes=root=>!root||typeof root!=='object'?[]:[root,...(Array.isArray(root)?root:[root.props?.children]).flat(Infinity).flatMap(child=>nodes(child))];
const content=n=>n==null||typeof n==='boolean'?'':typeof n!=='object'?String(n):Array.isArray(n)?n.map(content).join(''):content(n.props?.children);
function harness() {
 const slots=[],effects=[];let cursor=0;
 return {react:{
  useState(initial){const i=cursor++;if(!(i in slots))slots[i]=typeof initial==='function'?initial():initial;return[slots[i],v=>slots[i]=typeof v==='function'?v(slots[i]):v];},
  useRef(initial){const i=cursor++;return slots[i]??={current:initial};},
  useEffect(fn,deps){const i=cursor++,prev=slots[i];if(!prev||deps.some((v,n)=>v!==prev.deps[n])){const state={deps,cleanup:prev?.cleanup};slots[i]=state;effects.push(()=>{state.cleanup?.();state.cleanup=fn();});}}
 },render(fn){cursor=0;return fn();},effects(){effects.splice(0).forEach(fn=>fn());},unmount(){slots.forEach(s=>s?.cleanup?.());}};
}
let now=at-1000,downloads=0,resolveDownload;
const previous={now:Date.now,setTimeout,clearTimeout,window:globalThis.window,document:globalThis.document,revoke:URL.revokeObjectURL};
const timers=new Map(),listeners=new Map(),revoked=[];let timerId=0;
Date.now=()=>now;globalThis.setTimeout=fn=>{timers.set(++timerId,fn);return timerId;};globalThis.clearTimeout=id=>timers.delete(id);
globalThis.window=globalThis.document={addEventListener:(name,fn)=>listeners.set(name,fn),removeEventListener:name=>listeners.delete(name)};
URL.revokeObjectURL=url=>revoked.push(url);
try {
 const ui=harness(),video={id:'qa',expires_at:deadline};
 const imports={react:ui.react,'@/lib/video-client':{getVideo:async()=>video,videoPlaybackUrl:async()=>{downloads++;return 'blob:qa';}},'@/lib/video-retention':retention,'./ui-icon':{UiIcon:()=>null},'./video.module.css':{default:{}}};
 const {VideoPlayer}=compile('components/video-player.tsx',imports);
 const render=()=>ui.render(()=>VideoPlayer({videoId:'qa'}));
 render();ui.effects();await Promise.resolve();let tree=render();ui.effects();
 assert.match(content(tree),/Tillgänglig till/);assert.equal(downloads,0,'Metadata does not download video automatically');
 await nodes(tree).find(n=>n.type==='button').props.onClick();await Promise.resolve();tree=render();ui.effects();
 assert.equal(downloads,1);const element=nodes(tree).find(n=>n.type==='video');assert.ok(element);
 let paused=0;element.props.ref.current={pause:()=>paused++,removeAttribute(){},load(){}};
 now=at;for(const fn of timers.values())fn();tree=render();
 assert.match(content(tree),/Videon är inte längre tillgänglig/);assert.ok(!nodes(tree).some(n=>n.type==='video'));assert.equal(paused,1);assert.ok(revoked.includes('blob:qa'));ui.unmount();
 now=at-1000;
 const other=harness();imports.react=other.react;imports['@/lib/video-client'].videoPlaybackUrl=()=>new Promise(resolve=>resolveDownload=resolve);
 const Player=compile('components/video-player.tsx',imports).VideoPlayer;
 const renderOther=()=>other.render(()=>Player({videoId:'qa'}));renderOther();other.effects();await Promise.resolve();tree=renderOther();other.effects();
 const pending=nodes(tree).find(n=>n.type==='button').props.onClick();await Promise.resolve();other.unmount();resolveDownload('blob:late');await pending;await Promise.resolve();assert.ok(revoked.includes('blob:late'),'Late result is released after unmount');
} finally {
 Date.now=previous.now;globalThis.setTimeout=previous.setTimeout;globalThis.clearTimeout=previous.clearTimeout;
 globalThis.window=previous.window;globalThis.document=previous.document;URL.revokeObjectURL=previous.revoke;
}
console.log('PASS expiry boundaries, actual player callbacks/unmount cleanup, worker retry/failure and Edge authentication. Transport/media simulated.');
