import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire,Module} from 'node:module';
import path from 'node:path';
import ts from 'typescript';
const require=createRequire(import.meta.url),original=Module._load;
for(const ext of ['.ts','.tsx'])Module._extensions[ext]=(m,file)=>m._compile(ts.transpileModule(readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText,file);
Module._extensions['.css']=m=>{m.exports={__esModule:true,default:new Proxy({},{get:(_,k)=>String(k)})};};
const{createClient}=require('@supabase/supabase-js');let body=[],status=200,calls=[];
const sdk=createClient('https://example.test','qa-only-public',{auth:{persistSession:false,autoRefreshToken:false},global:{fetch:async(url,options)=>{calls.push({url:String(url),args:options.body?JSON.parse(options.body):null,signal:options.signal});return new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json'}});}}});
Module._load=function(name,parent,...rest){if(name==='@/lib/supabase')return{getSupabaseClient:()=>sdk};if(name.startsWith('@/'))return original.call(this,path.resolve(name.slice(2)),parent,...rest);return original.call(this,name,parent,...rest);};
const base={conversation_id:'chat-b',enforced:true,expired:false,read_only:false,purged_at:null,server_now:'2026-10-27T00:00:00.000Z',read_only_at:'2026-10-27T00:00:01.000Z',delete_after:'2026-10-27T00:00:02.000Z'};
let real;
try{
 real=require('../lib/data-retention.ts');
 assert.equal(real.retentionPhase(base,999).read_only,false);assert.equal(real.retentionPhase(base,1000).read_only,true);assert.equal(real.retentionPhase(base,1999).expired,false);assert.equal(real.retentionPhase(base,2000).expired,true);
 assert.equal(real.retentionPhase({...base,enforced:false},99999).expired,false);assert.equal(real.retentionPhase({...base,enforced:false,purged_at:base.server_now},0).expired,true);assert.equal(real.retentionPhase({...base,expired:true},-100).expired,true);
 assert.equal(real.nextRetentionBoundary([base],0),1000);assert.equal(real.nextRetentionBoundary([base],1000),1000);assert.equal(real.nextRetentionBoundary([base],2000),null);assert.equal(real.nextRetentionBoundary([{...base,enforced:false}],0),null);
 const signal=new AbortController().signal;body=[base];assert.equal((await real.getConversationRetention('chat-b',signal)).conversation_id,'chat-b');assert.match(calls[0].url,/rpc\/get_conversation_retention$/);assert.deepEqual(calls[0].args,{p_conversation_id:'chat-b'});assert.equal(calls[0].signal,signal);
 body=[];await assert.rejects(real.getConversationRetention('chat-b',signal));body=[{...base,conversation_id:'foreign'}];await assert.rejects(real.getConversationRetention('chat-b',signal));status=403;body={code:'42501'};await assert.rejects(real.getConversationRetention('chat-b',signal));status=200;body=[];assert.deepEqual(await real.getApplicationRetention(signal),[]);assert.match(calls.at(-1).url,/get_my_application_retention$/);
 console.log('PASS retention deadlines, disabled/physically purged states and real SDK RPC contract/ownership/failure transport.');
}finally{Module._load=original;}
const realReact=require('react'),realTimers={set:globalThis.setTimeout,clear:globalThis.clearTimeout},performanceDescriptor=Object.getOwnPropertyDescriptor(globalThis,'performance');let clock=0,id=0,view,requests=[];
Object.defineProperty(globalThis,'performance',{configurable:true,value:{now:()=>clock}});
const timers=new Map();globalThis.setTimeout=(fn,ms)=>{const key=++id;timers.set(key,{fn,ms});return key;};globalThis.clearTimeout=key=>timers.delete(key);
const settle=async()=>{for(let i=0;i<12;i++)await Promise.resolve();};
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return{promise,resolve,reject};};
const fire=ms=>{const found=[...timers].find(([,t])=>t.ms===ms);assert.ok(found,`Expected ${ms} ms timer`);timers.delete(found[0]);found[1].fn();};
const hooks={...realReact,useState(initial){const v=view,i=v.index++;if(!(i in v.slots))v.slots[i]=typeof initial==='function'?initial():initial;return[v.slots[i],x=>{v.slots[i]=typeof x==='function'?x(v.slots[i]):x;v.updates++;}];},useRef(initial){const v=view,i=v.index++;return v.slots[i]??={current:initial};},useCallback(fn,deps){const v=view,i=v.index++,old=v.slots[i];if(!old||deps.some((d,n)=>!Object.is(d,old.deps[n])))v.slots[i]={fn,deps};return v.slots[i].fn;},useEffect(fn,deps){const v=view,i=v.index++,old=v.effects[i];if(!old||deps.some((d,n)=>!Object.is(d,old.deps[n])))v.effects[i]={fn,deps,pending:true,cleanup:old?.cleanup};}};
Module._load=function(name,parent,...rest){if(name==='react')return hooks;if(name==='@/lib/visible-refresh')return{subscribeVisibleRefresh:()=>()=>{}};if(name==='@/lib/data-retention')return{...real,getConversationRetention:(chat,signal)=>{const d=deferred();requests.push({chat,signal,...d});return d.promise;}};if(name.startsWith('@/'))return original.call(this,path.resolve(name.slice(2)),parent,...rest);return original.call(this,name,parent,...rest);};
try{
 const{useConversationRetention:runConversationHook}=require('../hooks/use-data-retention.ts');
 view={slots:[],effects:[],index:0,updates:0,chat:'chat-a',user:'youth-a',render(){view.index=0;return runConversationHook(view.chat,view.user);},effectsNow(){for(const e of view.effects.filter(Boolean))if(e.pending){e.cleanup?.();e.cleanup=e.fn();e.pending=false;}},stop(){for(const e of view.effects.filter(Boolean))e.cleanup?.();}};
 assert.equal(view.render().writeBlocked,true);view.effectsNow();const a=requests[0];view.chat='chat-b';view.user='company-b';assert.equal(view.render().value,undefined);view.effectsNow();const b=requests.at(-1);assert.equal(a.signal.aborted,true);b.resolve(base);await settle();assert.equal(view.render().writeBlocked,false);view.effectsNow();a.resolve({...base,conversation_id:'chat-a',expired:true});await settle();assert.equal(view.render().value.conversation_id,'chat-b');
 clock=1000;fire(1000);assert.equal(view.render().value.read_only,true,'Boundary blocks immediately even while reload is pending');view.effectsNow();requests.at(-1).reject(new Error('QA transport outage'));await settle();assert.equal(view.render().writeBlocked,true);assert.equal(view.render().value.conversation_id,'chat-b');view.effectsNow();clock=2000;fire(1000);assert.equal(view.render().value.expired,true,'Cached content expires even after a failed refresh');view.effectsNow();requests.at(-1).resolve({...base,server_now:'2026-10-27T00:00:02.000Z',expired:true,read_only:true});await settle();
 view.user='youth-c';assert.equal(view.render().value,undefined,'Same conversation cannot reuse another identity cache');view.effectsNow();const pending=requests.at(-1),updates=view.updates;view.stop();pending.resolve(base);await settle();assert.equal(view.updates,updates,'Detached hook cannot write late data');
 const{ApplicationRetentionNotice,RetiredApplicationCard}=require('../components/data-retention-notice.tsx');
 const text=root=>root==null||typeof root==='boolean'?'':typeof root!=='object'?String(root):(Array.isArray(root)?root:[root.props?.children]).flat(Infinity).map(text).join('');
 const application={...base,job_id:'job',job_title:'QA jobb',company_name:'QA företag',expired:true};assert.equal(ApplicationRetentionNotice({record:{...application,enforced:false}}),null);assert.match(text(ApplicationRetentionNotice({record:application})),/inte längre tillgängligt/);assert.match(text(RetiredApplicationCard({record:{...application,purged_at:base.server_now}})),/Underlag raderat/);
 console.log('PASS actual retention hooks/notices: scope switch, late replies, live boundary during failure, cached redaction, unknown status blocked and unmount.');
}finally{view?.stop();Module._load=original;globalThis.setTimeout=realTimers.set;globalThis.clearTimeout=realTimers.clear;Object.defineProperty(globalThis,'performance',performanceDescriptor);}
