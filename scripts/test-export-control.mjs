import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire,Module} from 'node:module';
import ts from 'typescript';
const require=createRequire(import.meta.url),oldLoad=Module._load,oldTs=Module._extensions['.tsx'];
const react=require('react');let view,reply,calls,authCallback,clicks,removed,revoked,created,clickError,passed=0;
const timers=new Map();let timerId=0;
const originals={document:globalThis.document,setTimeout:globalThis.setTimeout,clearTimeout:globalThis.clearTimeout,create:URL.createObjectURL,revoke:URL.revokeObjectURL};
const envNames=['NEXT_PUBLIC_EXPORT_PREVIEW_UI','NEXT_PUBLIC_SUPABASE_URL'],saved=Object.fromEntries(envNames.map(n=>[n,process.env[n]]));
const hooks={...react,useId:()=> 'qa-export-dialog',useRef(initial){const i=view.index++;return view.slots[i]??={current:initial};},useState(initial){const i=view.index++;if(!(i in view.slots))view.slots[i]=initial;return[view.slots[i],value=>{view.slots[i]=typeof value==='function'?value(view.slots[i]):value;view.updates++;}];},useEffect(fn){const i=view.index++;view.effects[i]??={fn};}};
class AccountExportError extends Error{}
Module._load=function(n,parent,...args){if(n==='react')return hooks;if(n==='./modal-dialog')return{ModalDialog:'dialog'};if(n.endsWith('.module.css'))return{__esModule:true,default:{}};if(n==='@/lib/account-export')return{AccountExportError,requestAccountExport:(...args)=>{calls.push(args);return reply.promise;},recoverAccountExport:(...args)=>{calls.push(["recover",...args]);return reply.promise;}};if(n==='@/lib/supabase')return{getSupabaseClient:()=>({auth:{onAuthStateChange(fn){authCallback=fn;return{data:{subscription:{unsubscribe(){authCallback=null;}}}};}}})};return oldLoad.call(this,n,parent,...args);};
Module._extensions['.tsx']=(m,f)=>m._compile(ts.transpileModule(readFileSync(process.env.MNW_EXPORT_CONTROL_FIXTURE??f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText,f);
const {ExportAccountControl:Wrapper}=require('../components/export-account-control.tsx');
function nodes(x){if(x===null||x===undefined||typeof x==='boolean')return[];if(Array.isArray(x))return x.flatMap(nodes);if(typeof x!=='object')return[];return[x,...nodes(x.props?.children)];}
function text(x){if(x===null||x===undefined||typeof x==='boolean')return'';if(Array.isArray(x))return x.map(text).join(' ');if(typeof x!=='object')return String(x);return text(x.props?.children);}
const event={preventDefault(){}};
const file=()=>({blob:new Blob(['PK QA']),filename:'qa.zip',expiresAt:new Date(Date.now()+3600000).toISOString()});
function mount(){
 let resolve,reject;reply={promise:new Promise((a,b)=>{resolve=a;reject=b;}),resolve,reject};calls=[];clicks=removed=revoked=created=0;clickError=false;timers.clear();
 Object.assign(process.env,{NEXT_PUBLIC_EXPORT_PREVIEW_UI:'true',NEXT_PUBLIC_SUPABASE_URL:'https://vwcfjvwfeatvuisojwrh.supabase.co'});
 const Control=Wrapper({userId:'A'}).type;
 view={index:0,slots:[],effects:[],updates:0,render(){this.index=0;return Control({userId:'A'});},stop(){for(const effect of this.effects.filter(Boolean))effect.cleanup?.();}};
 view.render();for(const e of view.effects.filter(Boolean))e.cleanup=e.fn();open();
}
function open(){nodes(view.render()).find(n=>n.type==='button').props.onClick();}
function submit(){const input=nodes(view.render()).find(n=>n.type==='input');input.props.onChange({target:{value:'qa-password'}});return nodes(view.render()).find(n=>n.type==='form').props.onSubmit;}
function close(){nodes(view.render()).find(n=>n.type==='dialog').props.onClose();}
async function test(name,fn){mount();try{await fn();passed++;console.log('PASS '+name);}finally{view.stop();assert.equal(timers.size,0);}}
globalThis.setTimeout=(fn,ms)=>{const id=++timerId;timers.set(id,{fn,ms});return id;};globalThis.clearTimeout=id=>timers.delete(id);
URL.createObjectURL=()=>{created++;return'blob:qa';};URL.revokeObjectURL=()=>{revoked++;};globalThis.document={body:{append(){}},createElement(){return{click(){if(clickError)throw Error('QA_PRIVATE');clicks++;},remove(){removed++;}};}};
try{
 await test('same synchronous callback cannot create duplicate orders and password is cleared',async()=>{const send=submit(),one=send(event),two=send(event);assert.equal(calls.length,1);assert.equal(calls[0][0],'A');assert.equal(calls[0][1],'qa-password');assert.equal(nodes(view.render()).find(n=>n.type==='input').props.value,'');reply.resolve(file());await Promise.all([one,two]);assert.equal(clicks,1);assert.equal(removed,1);assert.match(text(view.render()),/startats/);});
 await test('close aborts request; late success cannot create Blob URL or click',async()=>{const p=submit()(event);close();assert.equal(calls[0][2].aborted,true);reply.resolve(file());await p;assert.equal(created,0);assert.equal(clicks,0);});
 await test('account switch closes dialog and blocks late delivery',async()=>{const p=submit()(event);authCallback('SIGNED_IN',{user:{id:'B'}});reply.resolve(file());await p;assert.equal(nodes(view.render()).some(n=>n.type==='dialog'),false);assert.equal(clicks,0);});
 await test('unmount cancels and leaves no stale state updates or download',async()=>{const p=submit()(event);view.stop();const before=view.updates;reply.resolve(file());await p;assert.equal(view.updates,before);assert.equal(clicks,0);});
 await test('stale submit callback after unmount performs no work',async()=>{const send=submit();view.stop();const pending=send(event);assert.equal(calls.length,0);reply.resolve(file());await pending;});
 await test('timeout tells the truth about unknown result and never retries automatically',async()=>{const p=submit()(event);for(const [id,t]of [...timers])if(t.ms===125000){timers.delete(id);t.fn();}reply.reject(new DOMException('Aborted','AbortError'));await p;assert.match(text(view.render()),/Paketet kan ha skapats/);assert.match(text(view.render()),/Ingen ny beställning/);assert.equal(calls.length,1);assert.equal(clicks,0);});
 await test('raw upstream error is hidden and busy state recovers',async()=>{const p=submit()(event);reply.reject(Error('QA_PRIVATE'));await p;assert.ok(!text(view.render()).includes('QA_PRIVATE'));assert.equal(nodes(view.render()).find(n=>n.props?.type==='submit').props.disabled,false);});
 await test('known client error is presented and password stays empty',async()=>{const p=submit()(event);reply.reject(new AccountExportError('Kontrollera lösenordet.'));await p;assert.match(text(view.render()),/Kontrollera lösenordet/);assert.equal(nodes(view.render()).find(n=>n.type==='input').props.value,'');});
 await test('failed browser click removes anchor and releases URL',async()=>{clickError=true;const p=submit()(event);reply.resolve(file());await p;assert.equal(removed,1);assert.equal(revoked,1);assert.equal(clicks,0);assert.ok(!text(view.render()).includes('QA_PRIVATE'));});
 await test('Blob URL is released on deadline',async()=>{const p=submit()(event);reply.resolve(file());await p;for(const [id,t]of [...timers])if(t.ms===30000){timers.delete(id);t.fn();}assert.equal(revoked,1);});
 await test('Blob URL is released immediately at account switch',async()=>{const p=submit()(event);reply.resolve(file());await p;authCallback('SIGNED_OUT',null);assert.equal(revoked,1);});
 await test('same-account token refresh does not abort operation',async()=>{const p=submit()(event);authCallback('TOKEN_REFRESHED',{user:{id:'A'}});assert.equal(calls[0][2].aborted,false);reply.resolve(file());await p;assert.equal(clicks,1);});
 await test('dev gate stays closed for missing flag or different project',async()=>{process.env.NEXT_PUBLIC_EXPORT_PREVIEW_UI='false';assert.equal(Wrapper({userId:'A'}),null);process.env.NEXT_PUBLIC_EXPORT_PREVIEW_UI='true';process.env.NEXT_PUBLIC_SUPABASE_URL='https://production.invalid';assert.equal(Wrapper({userId:'A'}),null);});

 for(const state of ['none','building','expired','failed'])await test('recovery '+state+' displays status without ordering or clicking',async()=>{const event={preventDefault(){},nativeEvent:{submitter:{getAttribute:()=> 'recover'}}};const send=submit(),one=send(event),two=send(event);assert.equal(calls.length,1);assert.equal(calls[0][0],'recover');reply.resolve(state==='building'?{status:state,expiresAt:new Date(Date.now()+3600000).toISOString()}:{status:state});await Promise.all([one,two]);assert.equal(clicks,0);assert.equal(created,0);assert.equal(nodes(view.render()).find(n=>n.type==='input').props.value,'');assert.ok(text(view.render()).includes({none:'Inget sparat',building:'skapas fortfarande',expired:'har gått ut',failed:'kunde inte färdigställas'}[state]));});
 await test('recovery ready downloads the file without a creation request',async()=>{const p=submit()({preventDefault(){},nativeEvent:{submitter:{getAttribute:()=> 'recover'}}});reply.resolve(file());await p;assert.equal(calls.length,1);assert.equal(calls[0][0],'recover');assert.equal(clicks,1);assert.match(text(view.render()),/Giltigt till/);});
 console.log(`PASS ${passed} actual export component callback checks. React hooks/Auth/DOM are controlled mocks; no browser rendering claimed.`);
}finally{view?.stop();Module._load=oldLoad;if(oldTs)Module._extensions['.tsx']=oldTs;else delete Module._extensions['.tsx'];Object.assign(globalThis,{document:originals.document,setTimeout:originals.setTimeout,clearTimeout:originals.clearTimeout});URL.createObjectURL=originals.create;URL.revokeObjectURL=originals.revoke;for(const n of envNames)if(saved[n]===undefined)delete process.env[n];else process.env[n]=saved[n];}
