import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire,Module} from 'node:module';
import path from 'node:path';
import ts from 'typescript';
const require=createRequire(import.meta.url),load=Module._load,react=require('react');
let current,writeCalls=[],readCalls=[],saved=[];
const defer=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return{promise,resolve,reject};};
class SupplementWriteError extends Error{constructor(receipt){super('Sparningen kunde inte bekräftas.');this.receipt=receipt;}}
class SupplementRequestError extends Error{}
const hooks={...react,useState(initial){const v=current,i=v.index++;if(!(i in v.slots))v.slots[i]=initial;return[v.slots[i],x=>{v.slots[i]=typeof x==='function'?x(v.slots[i]):x;v.updates++;}];},useRef(initial){const i=current.index++;return current.slots[i]??={current:initial};},useEffect(fn,deps){const i=current.index++,old=current.effects[i];if(!old||deps.some((v,j)=>!Object.is(v,old.deps[j])))current.effects[i]={fn,deps,pending:true,cleanup:old?.cleanup};}};
Module._extensions['.ts']=(m,f)=>m._compile(ts.transpileModule(readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,f);
Module._extensions['.tsx']=(m,f)=>m._compile(ts.transpileModule(readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText,f);
Module._load=function(n,parent,...args){if(n==='react')return hooks;if(n==='@/lib/owned-application-supplement')return{SupplementWriteError,SupplementRequestError,submitOwnedSupplement(...args){const d=defer();writeCalls.push({args,...d});return d.promise;}};if(n==='./report-dialog')return{ReportDialog:'report'};if(n==='./ui-icon')return{UiIcon:'icon'};if(n.startsWith('@/'))return load.call(this,path.resolve(n.slice(2)),parent,...args);return load.call(this,n,parent,...args);};
const {ApplicationFollowupCard:Wrapper}=require('../components/application-followup-card.tsx');
const app={youth_user_id:'A',job_id:'job',status:'submitted',questions:[],answers:{},omitted_question_ids:[]};
const followups=[{id:'f',job_id:'job',youth_user_id:'A',criterion_label:'Svenska för kundkontakt',question:'Hur beskriver du dina kunskaper i Svenska för kundkontakt? Ange gärna din nivå och om du kan använda språket i tal och skrift.',question_source:'automatic',answer:'',status:'pending'}];
const nodes=n=>!n||typeof n!=='object'?[]:[n,...(Array.isArray(n)?n:[n.props?.children]).flat(Infinity).flatMap(nodes)];
const text=n=>n==null||typeof n==='boolean'?'':typeof n!=='object'?String(n):(Array.isArray(n)?n:[n.props?.children]).flat(Infinity).map(text).join(' ');
class View{
 constructor(props){this.props=props;this.slots=[];this.effects=[];this.index=0;this.updates=0;}
 render(){return renderView(this);}
 flush(){for(const e of this.effects.filter(Boolean))if(e.pending){e.cleanup?.();e.cleanup=e.fn();e.pending=false;}}
 stop(){for(const e of this.effects.filter(Boolean))e.cleanup?.();}
}
function renderView(v){current=v;v.index=0;const element=Wrapper(v.props);return element.type(element.props);}
const button=(v,label)=>{const n=nodes(v.render()).find(n=>n.type==='button'&&text(n).trim()===label);assert.ok(n,label);return n;};
const textarea=v=>nodes(v.render()).find(n=>n.type==='textarea');
const settle=async()=>{for(let i=0;i<20;i++)await Promise.resolve();};
function mount(){writeCalls=[];readCalls=[];saved=[];const v=new View({application:app,items:followups,initiallyOpen:true,onSaved:(...args)=>saved.push(args)});v.render();v.flush();textarea(v).props.onChange({target:{value:'Jag kan hjälpa kunder på svenska.'}});return v;}
const receipt={read(signal){const d=defer();readCalls.push({signal,...d});return d.promise;}};
const result=confirmed=>({application:app,followups,confirmed});
try{
 assert.notEqual(Wrapper({application:app}).key,Wrapper({application:{...app,youth_user_id:'B'}}).key);
 assert.notEqual(Wrapper({application:app}).key,Wrapper({application:{...app,job_id:'other'}}).key);
 let v=mount();assert.match(text(v.render()),/kunskaper i svenska\?/);assert.doesNotMatch(text(v.render()),/kunskaper i Svenska för kundkontakt\?/);let send=button(v,'Skicka komplettering').props.onClick;send();send();assert.equal(writeCalls.length,1,'Same-frame submissions are locked');assert.equal(writeCalls[0].args[0],'A');assert.equal(writeCalls[0].args[1],'job');writeCalls[0].resolve(receipt);await settle();readCalls[0].reject(new SupplementRequestError('Läsningen misslyckades.'));await settle();assert.match(text(v.render()),/Kompletteringen är sparad/);assert.equal(textarea(v).props.value,'Jag kan hjälpa kunder på svenska.');assert.equal(button(v,'Skicka komplettering').props.disabled,true);button(v,'Kontrollera sparningen').props.onClick();assert.equal(writeCalls.length,1);readCalls[1].resolve(result(true));await settle();assert.equal(saved.length,1);assert.equal(textarea(v).props.value,'');assert.match(text(v.render()),/fortfarande skickad/);v.stop();
 v=mount();button(v,'Skicka komplettering').props.onClick();writeCalls[0].reject(new SupplementWriteError(receipt));await settle();assert.equal(readCalls.length,0,'Unknown write does not trigger another write or automatic recovery');button(v,'Kontrollera sparningen').props.onClick();readCalls[0].resolve(result(false));await settle();assert.equal(writeCalls.length,1);assert.equal(textarea(v).props.value,'Jag kan hjälpa kunder på svenska.');assert.equal(button(v,'Skicka komplettering').props.disabled,false);assert.match(text(v.render()),/Granska svaren/);v.stop();
 v=mount();button(v,'Skicka komplettering').props.onClick();v.stop();const before=v.updates;writeCalls[0].resolve(receipt);await settle();assert.equal(readCalls.length,0);assert.equal(saved.length,0);assert.equal(v.updates,before);assert.equal(writeCalls[0].args[3].aborted,true);
 v=mount();button(v,'Skicka komplettering').props.onClick();writeCalls[0].resolve(receipt);await settle();v.props={...v.props,application:{...app,status:'withdrawn'}};assert.equal(v.render(),null);v.flush();readCalls[0].resolve(result(true));await settle();assert.equal(saved.length,0,'Late result after withdrawal cannot update parent');v.stop();
 v=mount();button(v,'Skicka komplettering').props.onClick();writeCalls[0].reject(Error('QA_PRIVATE'));await settle();assert.ok(!text(v.render()).includes('QA_PRIVATE'));assert.equal(textarea(v).props.value,'Jag kan hjälpa kunder på svenska.');v.stop();
 console.log('PASS actual followup component callbacks/effects: owner/job keys, language display, synchronous submit lock, saved/read-failed distinction, read-only retry, retained draft, unknown result, explicit retry after review, withdrawal/unmount and safe error messages. Hooks/DOM/transport simulated.');
}finally{Module._load=load;}
