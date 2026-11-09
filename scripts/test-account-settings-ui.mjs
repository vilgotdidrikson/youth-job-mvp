import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire, Module } from 'node:module';
import path from 'node:path';
import ts from 'typescript';
const require=createRequire(import.meta.url),originalLoad=Module._load;
for(const ext of ['.ts','.tsx'])Module._extensions[ext]=(mod,file)=>mod._compile(ts.transpileModule(readFileSync(file,'utf8'),{fileName:file,compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText,file);
Module._extensions['.css']=mod=>{mod.exports={__esModule:true,default:{}};};
const React=require('react');let current;
const views=[],writes=[],reads=[],timers=new Map();let timerId=0;
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
class View{constructor(element){this.element=element;this.slots=[];this.effects=[];this.index=0;this.updates=0;this.forms=[];views.push(this);}render(){return renderView(this);}mount(){this.render();this.flush();}flush(){for(const e of this.effects.filter(Boolean))if(e.pending){e.cleanup?.();e.cleanup=e.fn();e.pending=false;}}stop(){for(const e of this.effects.filter(Boolean)){e.cleanup?.();e.cleanup=undefined;}}}
function renderView(v){current=v;v.index=0;const tree=v.element.type(v.element.props);nodes(tree).filter(n=>n.type==='form').forEach((form,i)=>{const data=v.forms[i]??=makeForm();form.props.ref.current=data;});return tree;}
function makeForm(){const values={};return{values,elements:{namedItem(name){return{get value(){return values[name]??'';},set value(value){values[name]=value;}};}}};}
const nodes=root=>!root||typeof root!=='object'?[]:[root,...(Array.isArray(root)?root:[root.props?.children]).flat(Infinity).flatMap(nodes)];
const text=root=>root==null||typeof root==='boolean'?'':typeof root!=='object'?String(root):(Array.isArray(root)?root:[root.props?.children]).flat(Infinity).map(text).join('');
const button=(v,label)=>{const n=nodes(v.render()).find(n=>n.type==='button'&&text(n)===label);assert.ok(n,label);return n;};
const form=(v,index)=>nodes(v.render()).filter(n=>n.type==='form')[index];
const submit=(v,index,values)=>{Object.assign(v.forms[index].values,values);form(v,index).props.onSubmit({preventDefault(){},currentTarget:v.forms[index]});};
class AccountSettingsError extends Error{constructor(message,unconfirmed=false){super(message);this.unconfirmed=unconfirmed;this.cleanup=null;}}
Module._load=function(name,parent,...rest){
 if(name==='react')return hooks;
 if(name==='@/lib/account-settings')return{
  AccountSettingsError,validAccountEmail:value=>/^[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+$/.test(value),
  changeAccountPassword:(...args)=>{const d=deferred();writes.push({kind:'password',args,...d});return d.promise;},
  requestAccountEmailChange:(...args)=>{const d=deferred();writes.push({kind:'email',args,...d});return d.promise;},
  readAccountEmail:(...args)=>{const d=deferred();reads.push({args,...d});return d.promise;},
 };
 if(name==='./password-input')return{PasswordInput:()=>null};
 return originalLoad.call(this,name.startsWith('@/')?path.resolve(name.slice(2)):name,parent,...rest);
};
try{
 const {AccountSecuritySettings}=require('../components/account-security-settings.tsx');
 const props={userId:'qa-a',email:'qa@example.invalid'};const wrapper=AccountSecuritySettings(props);assert.notEqual(wrapper.key,AccountSecuritySettings({...props,userId:'qa-b'}).key);
 const v=new View(wrapper);v.mount();
 submit(v,1,{currentPassword:'test-only-current',newPassword:'test-only-new',confirmPassword:'different'});assert.equal(writes.length,0);assert.match(text(v.render()),/matchar inte/);
 submit(v,1,{currentPassword:'test-only-current',newPassword:'test-only-new',confirmPassword:'test-only-new'});form(v,1).props.onSubmit({preventDefault(){},currentTarget:v.forms[1]});assert.equal(writes.length,1,'Same-frame mutation lock');assert.equal(writes[0].args[2].expectedUserId,'qa-a');assert.ok(writes[0].args[2].signal instanceof AbortSignal);assert.equal(v.forms[1].values.currentPassword,'');
 let cleanupCalls=0,cleanupWorks=false;const cleanup=async()=>{cleanupCalls++;return cleanupWorks;};writes[0].resolve({cleanup});await settle();assert.match(text(v.render()),/Lösenordet har ändrats/);assert.match(text(v.render()),/verifieringssessionens utloggning kunde inte bekräftas/);
 submit(v,1,{currentPassword:'test-only-current',newPassword:'test-only-new',confirmPassword:'test-only-new'});assert.equal(writes.length,1,'Unfinished cleanup blocks a second mutation');
 button(v,'Försök avsluta verifieringssessionen').props.onClick();await settle();assert.equal(cleanupCalls,1);cleanupWorks=true;button(v,'Försök avsluta verifieringssessionen').props.onClick();await settle();assert.equal(cleanupCalls,2);assert.equal(writes.length,1,'Cleanup-only retry');
 submit(v,0,{currentPassword:'test-only-current',newEmail:' NEW@EXAMPLE.INVALID '});assert.equal(writes.length,2);assert.equal(writes[1].args[1],'new@example.invalid','Autofilled submitted email is used');assert.equal(v.forms[0].values.currentPassword,'');writes[1].resolve({cleanup:null});await settle();assert.match(text(v.render()),/Byte av e-postadress är begärt/);assert.match(text(v.render()),/Kontot använder: qa@example.invalid/);assert.match(text(v.render()),/Begärt byte till: new@example.invalid/);
 submit(v,0,{currentPassword:'test-only-current',newEmail:'other@example.invalid'});assert.equal(writes.length,2,'Cooldown prevents immediate repeated email requests');
 button(v,'Kontrollera e-poststatus').props.onClick();submit(v,1,{currentPassword:'test-only-current',newPassword:'test-only-new',confirmPassword:'test-only-new'});assert.equal(writes.length,2,'Pending status read cannot race a mutation');assert.equal(reads[0].args[0],'qa-a');reads[0].resolve({email:'new@example.invalid',pendingEmail:''});await settle();assert.match(text(v.render()),/Kontot använder: new@example.invalid/);assert.ok(!text(v.render()).includes('Begärt byte till:'));
 v.render();v.flush();const cooldown=[...timers].find(([,t])=>t.ms===60000);assert.ok(cooldown);timers.delete(cooldown[0]);cooldown[1].fn();
 button(v,'Kontrollera e-poststatus').props.onClick();const late=reads.at(-1),timeout=[...timers].find(([,t])=>t.ms===15000);assert.ok(timeout);timers.delete(timeout[0]);timeout[1].fn();await settle();assert.match(text(v.render()),/Kunde inte läsa e-poststatus/);late.resolve({email:'WRONG LATE EMAIL',pendingEmail:''});await settle();assert.ok(!text(v.render()).includes('WRONG LATE EMAIL'));
 button(v,'Kontrollera e-poststatus').props.onClick();reads.at(-1).resolve({email:'new@example.invalid',pendingEmail:'next@example.invalid'});await settle();assert.match(text(v.render()),/next@example.invalid/);
 submit(v,0,{currentPassword:'test-only-current',newEmail:'next@example.invalid'});const uncertain=new AccountSettingsError('Ändringen kunde inte bekräftas.',true);writes.at(-1).reject(uncertain);await settle();assert.match(text(v.render()),/kunde inte bekräftas/);v.stop();
 const detached=new View(wrapper);detached.mount();submit(detached,1,{currentPassword:'test-only-current',newPassword:'test-only-new',confirmPassword:'test-only-new'});const oldWrite=writes.at(-1);detached.stop();const updates=detached.updates;assert.equal(oldWrite.args[2].signal.aborted,true);let detachedCleanup=0;oldWrite.resolve({cleanup:async()=>{detachedCleanup++;return true;}});await settle();assert.equal(detached.updates,updates);assert.equal(detachedCleanup,1,'Late isolated cleanup is still attempted without old UI updates');const before=writes.length;submit(detached,1,{currentPassword:'test-only-current',newPassword:'test-only-new',confirmPassword:'test-only-new'});assert.equal(writes.length,before);
 const timed=new View(wrapper);timed.mount();submit(timed,1,{currentPassword:'test-only-current',newPassword:'test-only-new',confirmPassword:'test-only-new'});const timedWrite=writes.at(-1),timer=[...timers].find(([,t])=>t.ms===30000);assert.ok(timer);timers.delete(timer[0]);timer[1].fn();await settle();assert.equal(timedWrite.args[2].signal.aborted,true);assert.match(text(timed.render()),/Ändringen kunde inte bekräftas/);timedWrite.resolve({cleanup:null});await settle();assert.ok(!text(timed.render()).includes('Lösenordet har ändrats'));timed.stop();
 console.log('PASS actual account settings callbacks/effects: keyed accounts, submitted autofill, password clearing, validation/double-submit lock, truthful partial success, cleanup-only retries, pending vs active email, cooldown, fresh status timeout/retry, unmount and late results. Hooks/DOM/HTTP simulated; no browser or email-delivery claim.');
}finally{views.forEach(v=>v.stop());Module._load=originalLoad;globalThis.setTimeout=oldSet;globalThis.clearTimeout=oldClear;globalThis.FormData=oldFormData;}
