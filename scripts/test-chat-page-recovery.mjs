import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire, Module } from 'node:module';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import ts from 'typescript';
const require=createRequire(import.meta.url), originalLoad=Module._load;
for(const ext of ['.ts','.tsx'])Module._extensions[ext]=(mod,file)=>mod._compile(ts.transpileModule(process.env.CHAT_PAGE_REF && file.endsWith('/app/chats/page.tsx') ? execFileSync('git',['show',`${process.env.CHAT_PAGE_REF}:app/chats/page.tsx`],{encoding:'utf8'}) : readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText,file);
Module._extensions['.css']=mod=>{mod.exports={__esModule:true,default:{}};};
const React=require('react');let current,account='qa-a',cvCompleted=true,cvLoading=false,visibleRefresh;
const reads=[],histories=[],sends=[],subscriptions=[],views=[],timers=new Map();let timerId=0;
const originalSet=globalThis.setTimeout,originalClear=globalThis.clearTimeout;
globalThis.setTimeout=(fn,ms)=>{const id=++timerId;timers.set(id,{fn,ms});return id;};globalThis.clearTimeout=id=>timers.delete(id);
const cache=new Map();globalThis.sessionStorage={getItem:k=>cache.get(k)??null,setItem:(k,v)=>cache.set(k,v),removeItem:k=>cache.delete(k)};
globalThis.document={visibilityState:'visible',addEventListener(){},removeEventListener(){}};globalThis.window={dispatchEvent(){}};
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return{promise,resolve,reject};};
const settle=async()=>{for(let i=0;i<20;i++)await Promise.resolve();};
const same=(a,b)=>a&&b&&a.length===b.length&&a.every((v,i)=>Object.is(v,b[i]));
const hooks={...React,
 useState(initial){const v=current,i=v.index++;if(!(i in v.slots))v.slots[i]=typeof initial==='function'?initial():initial;return[v.slots[i],value=>{v.updates++;v.slots[i]=typeof value==='function'?value(v.slots[i]):value;}];},
 useRef(initial){const v=current,i=v.index++;return v.slots[i]??={current:initial};},
 useCallback(fn,deps){const v=current,i=v.index++;if(!same(v.slots[i]?.deps,deps))v.slots[i]={fn,deps};return v.slots[i].fn;},
 useEffect(fn,deps){const v=current,i=v.index++,old=v.effects[i];if(!old||!same(old.deps,deps))v.effects[i]={fn,deps,pending:true,cleanup:old?.cleanup};},
};
class View{constructor(element){this.element=element;this.slots=[];this.effects=[];this.index=0;this.updates=0;views.push(this);}render(){return renderView(this);}flush(){for(const e of this.effects.filter(Boolean))if(e.pending){e.cleanup?.();e.cleanup=e.fn();e.pending=false;}}stop(){for(const e of this.effects.filter(Boolean)){e.cleanup?.();e.cleanup=undefined;}}}
function renderView(view){current=view;view.index=0;return view.element.type(view.element.props);}
const nodes=root=>!root||typeof root!=='object'?[]:[root,...(Array.isArray(root)?root:[root.props?.children]).flat(Infinity).flatMap(nodes)];
const text=root=>root==null||typeof root==='boolean'?'':typeof root!=='object'?String(root):(Array.isArray(root)?root:[root.props?.children]).flat(Infinity).map(text).join('');
const find=(v,type,label)=>{const n=nodes(v.render()).find(n=>n.type===type&&(!label||text(n)===label));assert.ok(n,`${type} ${label??''}`);return n;};
const item=id=>({conv:{id,match_id:'match-'+id,company_user_id:account,youth_user_id:'qa-other'},otherName:'Kontakt '+id,status:'matched',matchId:'match-'+id});
const component=()=>null;
Module._load=function(name,parent,...rest){
 if(name==='react')return hooks;
 if(name==='next/navigation')return{useSearchParams:()=>new URLSearchParams()};
 if(name==='next/link')return component;
 if(name==='@/hooks/use-require-auth')return{useRequireAuth:()=>({user:{id:account},profile:{role:'company'},status:'ready'})};
 if(name==='@/hooks/use-cv-completion')return{useCvCompletion:()=>({cvCompleted,cvLoading})};
 if(name==='@/hooks/use-data-retention')return{useConversationRetention:()=>({writeBlocked:false,value:null,state:'ready',retry(){}})};
 if(name==='@/lib/chat-inbox')return{readChatInbox:(owner,signal)=>{const d=deferred();reads.push({owner,signal,...d});return d.promise;}};
 if(name==='@/lib/chat'||(name==='./chat'&&parent.filename.endsWith('chat-text-sender.ts')))return{
  getMessages:(id,signal)=>{const d=deferred();histories.push({id,signal,...d});return d.promise;},
  subscribeToConversationMessages:(id,callback)=>{const s={id,callback,closed:false};subscriptions.push(s);return()=>{s.closed=true;};},
  sendMessage:(id,value,options)=>{const d=deferred();sends.push({id,value,options,...d});return d.promise;},
 };
 if(name==='@/lib/matching')return{getMyMatches:async()=>[]};
 if(name==='@/lib/notifications')return{markMatchNotificationsRead:async()=>false};
 if(name==='@/lib/visible-refresh')return{subscribeVisibleRefresh:fn=>{visibleRefresh=fn;return()=>{};}};
 if(name==='@/lib/moderation')return{blockConversationUser:async()=>{}};
 if(name.startsWith('@/components/'))return new Proxy({},{get:()=>component});
 return originalLoad.call(this,name.startsWith('@/')?path.resolve(name.slice(2)):name,parent,...rest);
};
const event={preventDefault(){}};
try{
 const Page=require('../app/chats/page.tsx').default;
 const content=Page().props.children;
 const wrapper=()=>{current=new View(content);return content.type(content.props);};
 const a=wrapper();account='qa-b';assert.notEqual(a.key,wrapper().key,'Account change creates a fresh workspace, including drafts and selection');account='qa-a';
 const v=new View(a);v.render();v.flush();assert.equal(reads.at(-1).owner,'qa-a');assert.ok(reads.at(-1).signal instanceof AbortSignal);
 reads.at(-1).resolve([item('one'),item('two')]);await settle();
 const choose=id=>{const n=nodes(v.render()).find(n=>n.type==='button'&&text(n).includes('Kontakt '+id));assert.ok(n);n.props.onClick();v.render();v.flush();};
 choose('one');const oldHistory=histories.at(-1), oldSub=subscriptions.at(-1);
 choose('two');assert.equal(oldHistory.signal.aborted,true);assert.equal(oldSub.closed,true);
 oldHistory.resolve([{id:'old',conversation_id:'one',message_text:'FOREIGN HISTORY'}]);oldSub.callback({id:'old',conversation_id:'one',message_text:'FOREIGN REALTIME'});await settle();assert.ok(!text(v.render()).includes('FOREIGN'));
 histories.at(-1).resolve([]);await settle();v.render();v.flush();
 subscriptions.at(-1).callback({id:'wrong',conversation_id:'one',message_text:'WRONG CONVERSATION'});assert.ok(!text(v.render()).includes('WRONG CONVERSATION'));
 const input=find(v,'textarea');input.props.onChange({currentTarget:{value:'Hej från utkast',style:{},scrollHeight:25}});
 const form=find(v,'form');const sending=form.props.onSubmit(event);form.props.onSubmit(event);assert.equal(sends.length,1);
 sends[0].reject(new Error('Sändningen kunde inte bekräftas. Texten finns kvar.'));await sending;assert.equal(find(v,'textarea').props.value,'Hej från utkast');assert.equal(cache.get('mnw-chat-draft:qa-a:two'),'Hej från utkast');
 const retried=find(v,'form').props.onSubmit(event);assert.equal(sends[1].options.requestId,sends[0].options.requestId);
 sends[1].resolve();await retried;assert.equal(find(v,'textarea').props.value,'');assert.equal(cache.has('mnw-chat-draft:qa-a:two'),false);
 v.render();v.flush();histories.at(-1).resolve([]);reads.at(-1).resolve([item('two')]);await settle();v.render();v.flush();
 find(v,'textarea').props.onChange({currentTarget:{value:'Kvar efter timeout',style:{},scrollHeight:25}});
 const timed=find(v,'form').props.onSubmit(event);const timeout=[...timers].find(([,t])=>t.ms===20000);assert.ok(timeout);timers.delete(timeout[0]);timeout[1].fn();await timed;
 assert.match(text(v.render()),/Texten finns kvar/);assert.equal(find(v,'textarea').props.value,'Kvar efter timeout');sends.at(-1).resolve();await settle();assert.equal(find(v,'textarea').props.value,'Kvar efter timeout','Late confirmation after timeout cannot silently clear text');
 const detached=find(v,'form').props.onSubmit(event);const lastSend=sends.at(-1);v.stop();const updates=v.updates;lastSend.resolve();await detached;assert.equal(v.updates,updates,'Detached account view receives no send callback');find(v,'form').props.onSubmit(event);assert.equal(sends.at(-1),lastSend,'Detached submit cannot start another request');
 const waiting=new View(wrapper());waiting.render();waiting.flush();const lateInbox=reads.at(-1);const readTimeout=[...timers].find(([,t])=>t.ms===15000);assert.ok(readTimeout);timers.delete(readTimeout[0]);readTimeout[1].fn();await settle();assert.match(text(waiting.render()),/Kunde inte läsa dina chattar/);
 lateInbox.resolve([item('late')]);await settle();assert.ok(!text(waiting.render()).includes('Kontakt late'));
 find(waiting,'button','Försök igen').props.onClick();reads.at(-1).resolve([item('retry')]);await settle();assert.match(text(waiting.render()),/Kontakt retry/);
 nodes(waiting.render()).find(n=>n.type==='button'&&text(n).includes('Kontakt retry')).props.onClick();waiting.render();waiting.flush();const lateHistory=histories.at(-1);
 const historyTimeout=[...timers].find(([,t])=>t.ms===15000);assert.ok(historyTimeout);timers.delete(historyTimeout[0]);historyTimeout[1].fn();await settle();assert.match(text(waiting.render()),/Kunde inte läsa meddelanden/);
 lateHistory.resolve([{id:'late',conversation_id:'retry',message_text:'LATE TIMEOUT HISTORY'}]);await settle();assert.ok(!text(waiting.render()).includes('LATE TIMEOUT HISTORY'));
 find(waiting,'button','Hämta meddelanden igen').props.onClick();waiting.render();waiting.flush();histories.at(-1).resolve([{id:'current',conversation_id:'retry',message_text:'Återhämtad historik'}]);await settle();assert.match(text(waiting.render()),/Återhämtad historik/);
 const refresh=visibleRefresh();reads.at(-1).resolve([]);await refresh;assert.equal(nodes(waiting.render()).some(n=>n.type==='textarea'),false,'Selected conversation disappears when a fresh inbox no longer permits it');waiting.render();waiting.flush();waiting.stop();
 const racing=new View(wrapper());racing.render();racing.flush();const superseded=reads.at(-1);const background=visibleRefresh();assert.equal(superseded.signal.aborted,true);
 reads.at(-1).reject(new Error('network'));await background;assert.match(text(racing.render()),/Kunde inte läsa dina chattar/,'Background refresh replacing first load cannot leave an endless spinner');superseded.resolve([item('stale')]);await settle();assert.ok(!text(racing.render()).includes('Kontakt stale'));racing.stop();
 console.log('PASS actual chat page effects/callbacks: keyed accounts, aborted old history, retired realtime, wrong-conversation events, same-frame sends, preserved drafts, manual retry ID, timeout/late response, detached callbacks and inbox timeout/retry. React hooks/HTTP simulated; not browser/device evidence.');
}finally{views.forEach(v=>v.stop());Module._load=originalLoad;globalThis.setTimeout=originalSet;globalThis.clearTimeout=originalClear;delete globalThis.sessionStorage;delete globalThis.document;delete globalThis.window;}
