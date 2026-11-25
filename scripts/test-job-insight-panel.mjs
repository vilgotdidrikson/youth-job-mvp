import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire,Module} from 'node:module';
import ts from 'typescript';
const require=createRequire(import.meta.url),original=Module._load,react=require('react');
for(const ext of ['.ts','.tsx'])Module._extensions[ext]=(m,f)=>m._compile(ts.transpileModule(readFileSync(process.env.MNW_INSIGHT_COMPONENT_FIXTURE&&f.endsWith('/job-requirements-insight.tsx')?process.env.MNW_INSIGHT_COMPONENT_FIXTURE:f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText,f);
let active,actor='A',loading=false,calls=[];
const hooks={...react,useState(initial){const v=active,i=v.index++;if(!(i in v.slots))v.slots[i]=initial;return[v.slots[i],value=>{v.slots[i]=typeof value==='function'?value(v.slots[i]):value;v.updates++;}];},useRef(initial){return active.slots[active.index++]??={current:initial};},useEffect(fn,deps){const i=active.index++;if(!active.effects[i])active.effects[i]={fn,pending:true};}};
Module._load=function(n,parent,...args){if(n==='react')return hooks;if(n==='@/hooks/use-session')return{useSession:()=>({user:actor?{id:actor}:null,loading})};if(n==='@/lib/supabase')return{getSupabaseClient:()=>({rpc:(...args)=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});calls.push({args,resolve,reject});return promise;}})};if(n==='@/lib/job-requirements-insight')return{loadJobInsight:(...args)=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});calls.push({args,resolve,reject});return promise;}};if(n==='@/lib/job-requirements-information')return require('../lib/job-requirements-information.ts');if(n==='./public-job-information')return{PublicJobInformation:'public-job'};return original.call(this,n,parent,...args);};
const {JobRequirementsInsight:Wrapper}=require('../components/job-requirements-insight.tsx');
class View{constructor(){this.element=Wrapper({jobId:'job'});this.slots=[];this.effects=[];this.index=0;this.updates=0;}render(){active=this;this.index=0;return this.element.type(this.element.props);}flush(){for(const e of this.effects.filter(Boolean))if(e.pending){e.cleanup=e.fn();e.pending=false;}}stop(){for(const e of this.effects.filter(Boolean))e.cleanup?.();}replay(){this.stop();for(const e of this.effects.filter(Boolean))e.pending=true;this.flush();}}
const nodes=n=>!n||typeof n!=='object'?[]:[n,...(Array.isArray(n)?n:[n.props?.children]).flat(Infinity).flatMap(nodes)];
const text=n=>n==null||typeof n==='boolean'?'':typeof n!=='object'?String(n):(Array.isArray(n)?n:[n.props?.children]).flat(Infinity).map(text).join('');
const unhandled=[];process.on('unhandledRejection',e=>unhandled.push(e));
const settle=async()=>{for(let i=0;i<20;i++)await Promise.resolve();await new Promise(setImmediate);};
const mount=()=>{calls=[];const v=new View();v.render();v.flush();return v;};
const open=v=>v.render().props.onToggle({currentTarget:{open:true}});
const button=v=>nodes(v.render()).find(n=>n.type==='button');
const data={title:'Rätt annons',description:'Text',requirements:'Krav'};
try{
 let v=mount();assert.equal(calls.length,0);open(v);open(v);assert.equal(calls.length,1,'Synchronous read lock');calls[0].reject(Error('QA_PRIVATE'));await settle();assert.ok(text(v.render()).includes('Försök igen'));assert.ok(!text(v.render()).includes('Hämtar annons'));assert.ok(!text(v.render()).includes('QA_PRIVATE'));button(v).props.onClick();calls[1].resolve(data);await settle();assert.deepEqual(nodes(v.render()).find(n=>n.type==='public-job').props.job,data);button(v).props.onClick();assert.ok(!nodes(v.render()).some(n=>n.type==='public-job'),'Refresh discards old result before rechecking');calls[2].reject(Error('No access'));await settle();assert.ok(!nodes(v.render()).some(n=>n.type==='public-job'));v.stop();
 v=mount();open(v);v.stop();const count=v.updates;assert.equal(calls[0].args[2].aborted,true);calls[0].resolve(data);await settle();assert.equal(v.updates,count);assert.ok(!nodes(v.render()).some(n=>n.type==='public-job'));
 v=mount();open(v);v.replay();open(v);assert.equal(calls.length,2);calls[0].reject(Error('Late abort'));await settle();open(v);assert.equal(calls.length,2,'Late old request cannot unlock current request');calls[1].resolve(data);await settle();assert.ok(nodes(v.render()).some(n=>n.type==='public-job'));v.stop();
 actor='B';assert.notEqual(Wrapper({jobId:'job'}).key,v.element.key);actor='A';assert.notEqual(Wrapper({jobId:'other'}).key,v.element.key);loading=true;assert.notEqual(Wrapper({jobId:'job'}).key,v.element.key);loading=false;actor=null;v=mount();open(v);assert.equal(calls.length,0);assert.ok(text(v.render()).includes('Logga in'));v.stop();
 assert.equal(unhandled.length,0,'No unhandled request rejection');
 console.log('PASS insight panel: thrown request exits loading, retry, synchronous lock, explicit refresh clears old data, unmount/late response, effect replay and account/job/loading keys; simulated hooks/DOM/service.');
}finally{Module._load=original;}
