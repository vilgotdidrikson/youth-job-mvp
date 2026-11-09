import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire, Module } from 'node:module';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import ts from 'typescript';
const require=createRequire(import.meta.url),originalLoad=Module._load;
for(const ext of ['.ts','.tsx'])Module._extensions[ext]=(mod,file)=>mod._compile(ts.transpileModule(process.env.VIDEO_PAGE_REF&&file.endsWith('/app/video/record/page.tsx')?execFileSync('git',['show',`${process.env.VIDEO_PAGE_REF}:app/video/record/page.tsx`],{encoding:'utf8'}):readFileSync(file,'utf8'),{fileName:file,compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText,file);
Module._extensions['.css']=mod=>{mod.exports={__esModule:true,default:{}};};
const React=require('react');let current,account='qa-a',conversation='qa-chat-a';
const reads=[],uploads=[],sends=[],revokes=[],views=[],timers=new Map();let timerId=0;
const oldSet=globalThis.setTimeout,oldClear=globalThis.clearTimeout;
globalThis.setTimeout=(fn,ms)=>{const id=++timerId;timers.set(id,{fn,ms});return id;};globalThis.clearTimeout=id=>timers.delete(id);
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return{promise,resolve,reject};};
const settle=async()=>{for(let i=0;i<20;i++)await Promise.resolve();};
const hooks={...React,
 useState(initial){const v=current,i=v.index++;if(!(i in v.slots))v.slots[i]=typeof initial==='function'?initial():initial;return[v.slots[i],value=>{v.updates++;v.slots[i]=typeof value==='function'?value(v.slots[i]):value;}];},
 useRef(initial){const v=current,i=v.index++;return v.slots[i]??={current:initial};},
 useEffect(fn,deps){const v=current,i=v.index++,old=v.effects[i];if(!old||!deps.every((d,n)=>Object.is(d,old.deps[n])))v.effects[i]={fn,deps,pending:true,cleanup:old?.cleanup};},
};
class View{constructor(element){this.element=element;this.slots=[];this.effects=[];this.index=0;this.updates=0;views.push(this);}render(){return renderView(this);}flush(){for(const e of this.effects.filter(Boolean))if(e.pending){e.cleanup?.();e.cleanup=e.fn();e.pending=false;}}stop(){for(const e of this.effects.filter(Boolean)){e.cleanup?.();e.cleanup=undefined;}}}
function renderView(v){current=v;v.index=0;return v.element.type(v.element.props);}
const nodes=root=>!root||typeof root!=='object'?[]:[root,...(Array.isArray(root)?root:[root.props?.children]).flat(Infinity).flatMap(nodes)];
const text=root=>root==null||typeof root==='boolean'?'':typeof root!=='object'?String(root):(Array.isArray(root)?root:[root.props?.children]).flat(Infinity).map(text).join('');
const find=(v,type,label)=>{const n=nodes(v.render()).find(n=>n.type===type&&(!label||text(n)===label));assert.ok(n,`${typeof type==='string'?type:type.name} ${label??''}`);return n;};
function VideoPicker(){return null;}function VideoRecorder(){return null;}function ModalDialog(){return null;}function VideoPreview(){return null;}
const video={id:'qa-video',owner_id:'qa-a',conversation_id:'qa-chat-a',storage_path:'qa',revoked_at:null};
Module._load=function(name,parent,...rest){
 if(name==='react')return hooks;
 if(name==='next/navigation')return{useSearchParams:()=>new URLSearchParams({conversation,mode:'upload'})};
 if(name==='next/link')return()=>null;
 if(name==='@/hooks/use-require-auth')return{useRequireAuth:()=>({user:{id:account},profile:{role:'youth'},status:'ready'})};
 if(name==='@/lib/video-client'||(name==='./video-client'&&parent.filename.endsWith('chat-video-transfer.ts')))return{
  readChatVideoAccess:(owner,conv,signal)=>{const d=deferred();reads.push({owner,conv,signal,...d});return d.promise;},
  uploadVideo:(file,duration,owner,conv,signal)=>{const d=deferred();uploads.push({file,duration,owner,conv,signal,...d});return d.promise;},
  sendVideoMessage:(conv,owner,id,v,signal)=>{const d=deferred();sends.push({conv,owner,id,v,signal,...d});return d.promise;},
  revokeVideo:(v,signal)=>{const d=deferred();revokes.push({v,signal,...d});return d.promise;},
 };
 if(name==='@/lib/supabase')return{getSupabaseClient:()=>({})};
 if(name.endsWith('/video-picker')||name==='./video-picker')return{VideoPicker,VideoPreview};
 if(name.endsWith('/video-recorder'))return{VideoRecorder};
 if(name==='./modal-dialog')return{ModalDialog};
 if(name.startsWith('@/components/')||['./ui-icon','./video-player','./report-dialog'].includes(name))return new Proxy({},{get:()=>()=>null});
 return originalLoad.call(this,name.startsWith('@/')?path.resolve(name.slice(2)):name,parent,...rest);
};
const file=new File(['qa'],'qa.mp4',{type:'video/mp4'}),selected={file,duration:20};
try{
 const Page=require('../app/video/record/page.tsx').default;
 const wrapper=()=>{let element=Page().props.children;for(let n=0;n<3;n++){const v=new View(element);const result=v.render();if(result?.props?.userId)return result;element=result;}throw new Error('No studio workspace');};
 // For the baseline, call the old studio directly; it has no account key.
 if(process.env.VIDEO_PAGE_REF){let e=Page().props.children;const r=new View(e).render();const a=new View(r).render();account='qa-b';const b=new View(r).render();assert.notEqual(a.key,b.key,'Studio account isolation');}
 const a=wrapper();account='qa-b';assert.notEqual(a.key,wrapper().key,'Studio account isolation');account='qa-a';conversation='qa-chat-b';assert.notEqual(a.key,wrapper().key,'Studio conversation isolation');conversation='qa-chat-a';
 const v=new View(a);v.render();v.flush();assert.equal(reads.at(-1).owner,'qa-a');assert.equal(reads.at(-1).conv,'qa-chat-a');assert.equal(find(v,VideoPicker).props.disabled,true);
 const late=reads.at(-1),timeout=[...timers].find(([,t])=>t.ms===15000);assert.ok(timeout);timers.delete(timeout[0]);timeout[1].fn();await settle();assert.match(text(v.render()),/Kunde inte öppna videoflödet/);late.resolve(true);await settle();assert.equal(find(v,VideoPicker).props.disabled,true);
 find(v,'button','Försök igen').props.onClick();v.render();v.flush();reads.at(-1).resolve(true);await settle();find(v,VideoPicker).props.onChange(selected);
 const save=find(v,'button','Skicka video').props.onClick;save();save();assert.equal(uploads.length,1,'Studio same-frame click starts one upload');assert.equal(uploads[0].owner,'qa-a');assert.equal(uploads[0].conv,'qa-chat-a');
 uploads[0].resolve(video);await settle();sends[0].reject(new Error('uncertain'));await settle();assert.equal(find(v,VideoPicker).props.value,selected);assert.equal(find(v,VideoPicker).props.disabled,true,'Pending upload cannot be replaced before explicit revocation');
 find(v,'button','Skicka video').props.onClick();await settle();assert.equal(uploads.length,1);assert.equal(sends[1].id,sends[0].id);
 const sendTimeout=[...timers].find(([,t])=>t.ms===20000);assert.ok(sendTimeout);timers.delete(sendTimeout[0]);sendTimeout[1].fn();await settle();assert.match(text(v.render()),/Förhandsvisningen finns kvar/);sends[1].resolve();await settle();assert.ok(!text(v.render()).includes('Videon är skickad'));
 const discard=find(v,'button','Återkalla video och välj annan').props.onClick;discard();discard();assert.equal(revokes.length,1);revokes[0].resolve(true);await settle();assert.equal(find(v,VideoPicker).props.value,null);
 find(v,VideoPicker).props.onChange(selected);find(v,'button','Skicka video').props.onClick();const lateUpload=uploads.at(-1);v.stop();const updates=v.updates,sendCount=sends.length;lateUpload.resolve(video);await settle();assert.equal(sends.length,sendCount,'Detached studio cannot continue from upload into sending');assert.equal(v.updates,updates);save();assert.equal(uploads.at(-1),lateUpload);

 const {ChatVideoComposer}=require('../components/chat-video.tsx');let sent=0;
 const props={userId:'qa-a',conversationId:'qa-chat-a',onSent(){sent++;}};
 const chatA=ChatVideoComposer(props);assert.notEqual(chatA.key,ChatVideoComposer({...props,userId:'qa-b'}).key);assert.notEqual(chatA.key,ChatVideoComposer({...props,conversationId:'qa-chat-b'}).key);
 const chat=new View(chatA);chat.render();chat.flush();find(chat,'button','Välj video').props.onClick();find(chat,VideoPicker).props.onChange(selected);
 const chatSend=find(chat,'button','Skicka vald video').props.onClick;chatSend();chatSend();assert.equal(uploads.length,3);uploads.at(-1).resolve(video);await settle();sends.at(-1).reject(new Error('uncertain'));await settle();assert.equal(find(chat,VideoPicker).props.value,selected);
 find(chat,'button','Skicka vald video').props.onClick();await settle();const previous=sends.at(-2),last=sends.at(-1);assert.equal(last.id,previous.id);last.resolve();await settle();assert.equal(sent,1);assert.equal(find(chat,VideoPicker).props.value,null);
 find(chat,VideoPicker).props.onChange(selected);chatSend();const cancelled=uploads.at(-1);find(chat,'button','Avbryt uppladdning').props.onClick();await settle();const before=sends.length;cancelled.resolve(video);await settle();assert.equal(sends.length,before);assert.equal(sent,1);
 find(chat,'button','Skicka vald video').props.onClick();const finalUpload=uploads.at(-1);finalUpload.resolve(video);await settle();const lateSend=sends.at(-1);chat.stop();const chatUpdates=chat.updates;assert.equal(lateSend.signal.aborted,true);lateSend.resolve();await settle();assert.equal(sent,1,'Detached send confirmation does not call parent');assert.equal(chat.updates,chatUpdates);chatSend();assert.equal(uploads.at(-1),finalUpload);
 console.log('PASS actual video studio/composer callbacks/effects: account/conversation keys, access timeout/retry, double clicks, retained selection/private upload/UUID, uncertain timeout/late response, explicit revocation, upload cancellation and detached writes/callbacks. Hooks/HTTP simulated; no browser/camera claim.');
}finally{views.forEach(v=>v.stop());Module._load=originalLoad;globalThis.setTimeout=oldSet;globalThis.clearTimeout=oldClear;}
