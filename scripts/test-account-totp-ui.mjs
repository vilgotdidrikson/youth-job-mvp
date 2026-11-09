import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire, Module } from 'node:module';
import path from 'node:path';
import ts from 'typescript';
const require=createRequire(import.meta.url),originalLoad=Module._load;
for(const ext of ['.ts','.tsx'])Module._extensions[ext]=(mod,file)=>mod._compile(ts.transpileModule(readFileSync(file,'utf8'),{fileName:file,compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText,file);
Module._extensions['.css']=mod=>{mod.exports={__esModule:true,default:{}};};
const React=require('react');let current;const views=[],controllers=[],reads=[],timers=new Map();let timerId=0;
const oldSet=globalThis.setTimeout,oldClear=globalThis.clearTimeout,oldFormData=globalThis.FormData;
globalThis.setTimeout=(fn,ms)=>{const id=++timerId;timers.set(id,{fn,ms});return id;};globalThis.clearTimeout=id=>timers.delete(id);
globalThis.FormData=class{constructor(form){this.values={...form.values};}get(name){return this.values[name];}};
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return{promise,resolve,reject};};
const settle=async()=>{for(let i=0;i<20;i++)await Promise.resolve();};
const hooks={...React,
 useState(initial){const v=current,i=v.index++;if(!(i in v.slots))v.slots[i]=typeof initial==='function'?initial():initial;return[v.slots[i],value=>{v.updates++;v.slots[i]=typeof value==='function'?value(v.slots[i]):value;}];},
 useRef(initial){const v=current,i=v.index++;return v.slots[i]??={current:initial};},
 useEffect(fn,deps){const v=current,i=v.index++,old=v.effects[i];if(!old||deps.some((d,n)=>!Object.is(d,old.deps[n])))v.effects[i]={fn,deps,pending:true,cleanup:old?.cleanup};},
};
class View{constructor(element){this.element=element;this.slots=[];this.effects=[];this.index=0;this.updates=0;views.push(this);}render(){return renderView(this);}flush(){for(const e of this.effects.filter(Boolean))if(e.pending){e.cleanup?.();e.cleanup=e.fn();e.pending=false;}}stop(){for(const e of this.effects.filter(Boolean)){e.cleanup?.();e.cleanup=undefined;}}}
function renderView(v){current=v;v.index=0;return v.element.type(v.element.props);}
const nodes=root=>!root||typeof root!=='object'?[]:[root,...(Array.isArray(root)?root:[root.props?.children]).flat(Infinity).flatMap(nodes)];
const text=root=>root==null||typeof root==='boolean'?'':typeof root!=='object'?String(root):(Array.isArray(root)?root:[root.props?.children]).flat(Infinity).map(text).join('');
const button=(v,label)=>{const n=nodes(v.render()).find(n=>n.type==='button'&&text(n)===label);assert.ok(n,label);return n;};
const submit=(v,values)=>{const form=nodes(v.render()).find(n=>n.type==='form');assert.ok(form);const native={values,reset(){Object.keys(this.values).forEach(k=>this.values[k]='');}};form.props.onSubmit({preventDefault(){},currentTarget:native});return native;};
function Image(){return null;}
class AccountSettingsError extends Error{}
Module._load=function(name,parent,...rest){
 if(name==='react')return hooks;
 if(name==='next/image')return{__esModule:true,default:Image};
 if(name==='./password-input')return{PasswordInput:()=>null};
 if(name==='@/lib/account-settings')return{AccountSettingsError};
 if(name==='@/lib/account-mfa')return{
  readAccountTotp:(id,signal)=>{const d=deferred();reads.push({id,signal,...d});return d.promise;},
  createTotpInstallation:id=>{const c={id,stopped:false,beginCalls:[],confirmCalls:[],cancelCalls:[],begin(...args){const d=deferred();c.beginCalls.push({args,...d});return d.promise;},confirm(...args){const d=deferred();c.confirmCalls.push({args,...d});return d.promise;},cancel(){const d=deferred();c.cancelCalls.push(d);return d.promise;},stop(){c.stopped=true;}};controllers.push(c);return c;},
 };
 return originalLoad.call(this,name.startsWith('@/')?path.resolve(name.slice(2)):name,parent,...rest);
};
const pending={factorId:'qa-factor',qrCode:'data:image/svg+xml;utf-8,<svg/>',secret:'TEST_ONLY_SECRET'};
try{
 const {AccountTotpSettings}=require('../components/account-totp-settings.tsx');const wrapper=AccountTotpSettings({userId:'qa-a'});assert.notEqual(wrapper.key,AccountTotpSettings({userId:'qa-b'}).key);
 const v=new View(wrapper);v.render();v.flush();assert.equal(reads[0].id,'qa-a');reads[0].resolve(false);await settle();
 const form=submit(v,{currentPassword:'test-only-password'});assert.equal(form.values.currentPassword,'');submit(v,{currentPassword:'test-only-password'});assert.equal(controllers[0].beginCalls.length,1);
 controllers[0].beginCalls[0].resolve(pending);await settle();assert.match(text(v.render()),/TEST_ONLY_SECRET/);assert.equal(nodes(v.render()).find(n=>n.type===Image).props.src,pending.qrCode);
 submit(v,{code:'123456'});assert.deepEqual(controllers[0].confirmCalls[0].args,['123456','qa-factor']);let cleanups=0;controllers[0].confirmCalls[0].resolve({serverVerified:true,cleanup:async()=>{cleanups++;return true;}});await settle();assert.ok(!text(v.render()).includes('TEST_ONLY_SECRET'));assert.match(text(v.render()),/Autentiseringsappen är verifierad/);
 button(v,'Försök avsluta verifieringssessionen').props.onClick();await settle();assert.equal(cleanups,1);assert.equal(controllers[0].confirmCalls.length,1,'Cleanup does not repeat verification');reads.at(-1).resolve(true);await settle();assert.equal(button(v,'Lägg till autentiseringsapp').props.disabled,false,'Cleanup unlocks replacement controller');
 const next=controllers.at(-1);submit(v,{currentPassword:'test-only-password',totpCode:'123456'});assert.equal(next.beginCalls[0].args[1],'123456');next.beginCalls[0].resolve(pending);await settle();v.render();v.flush();
 const expiry=[...timers].find(([,t])=>t.ms===600000);assert.ok(expiry);timers.delete(expiry[0]);expiry[1].fn();assert.equal(next.stopped,true);assert.ok(!text(v.render()).includes('TEST_ONLY_SECRET'),'Expiry clears QR/secret immediately');button(v,'Försök avsluta verifieringssessionen').props.onClick();next.cancelCalls[0].resolve(true);await settle();reads.at(-1).resolve(false);await settle();
 const timed=controllers.at(-1);submit(v,{currentPassword:'test-only-password'});const timeout=[...timers].find(([,t])=>t.ms===35000);assert.ok(timeout);timers.delete(timeout[0]);timeout[1].fn();await settle();assert.equal(timed.stopped,true);assert.match(text(v.render()),/kunde inte bekräftas/);timed.beginCalls[0].resolve(pending);await settle();assert.ok(!text(v.render()).includes('TEST_ONLY_SECRET'),'Late enrollment cannot redisplay a timed-out secret');
 v.stop();
 const detached=new View(wrapper);detached.render();detached.flush();reads.at(-1).resolve(false);await settle();const c=controllers.at(-1);submit(detached,{currentPassword:'test-only-password'});detached.stop();const updates=detached.updates;c.beginCalls[0].resolve(pending);await settle();assert.equal(detached.updates,updates);assert.equal(c.stopped,true);
 const waiting=new View(wrapper);waiting.render();waiting.flush();const old=reads.at(-1);const readTimeout=[...timers].find(([,t])=>t.ms===15000);assert.ok(readTimeout);timers.delete(readTimeout[0]);readTimeout[1].fn();await settle();assert.match(text(waiting.render()),/Kunde inte läsa tvåfaktorstatus/);old.resolve(true);await settle();assert.ok(!text(waiting.render()).includes('Kontot har en verifierad'));
 button(waiting,'Kontrollera tvåfaktorstatus').props.onClick();reads.at(-1).resolve(true);await settle();assert.match(text(waiting.render()),/Kontot har en verifierad/);waiting.stop();
 console.log('PASS actual TOTP settings callbacks/effects: keyed accounts, submitted password clearing, same-frame locks, private QR/secret lifetime, scoped factor confirmation, cleanup-only retry, existing TOTP code, expiry, timeout/late secret, unmount and status timeout/retry. Hooks/DOM/HTTP simulated.');
}finally{views.forEach(v=>v.stop());Module._load=originalLoad;globalThis.setTimeout=oldSet;globalThis.clearTimeout=oldClear;globalThis.FormData=oldFormData;}
