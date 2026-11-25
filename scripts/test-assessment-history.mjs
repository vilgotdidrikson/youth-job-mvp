import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire, Module } from 'node:module';
import path from 'node:path';
import ts from 'typescript';
const require = createRequire(import.meta.url);
for (const ext of ['.ts','.tsx']) Module._extensions[ext]=(m,file)=>m._compile(ts.transpileModule(readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText,file);
Module._extensions['.css']=m=>{m.exports={__esModule:true,default:new Proxy({},{get:(_,key)=>String(key)})};};
const {readAssessmentHistory}=require('../lib/assessment-history.ts');
const {createLatestRead}=require('../lib/latest-read.ts');
const {createClient}=require('@supabase/supabase-js');
const row={id:'history-1',job_id:'job-a',youth_user_id:'youth-a',job_profile_version:2,created_at:'2026-10-26T12:00:00Z',result:{explanation:'Fiktivt underlag',criteria:[{id:'c0',label:'Helgarbete',status:'unknown',evidence:null}]}};
let urls=[],httpRows=[row],httpError=false;
const sdk=createClient('https://example.test','qa-anon',{auth:{persistSession:false,autoRefreshToken:false},global:{fetch:async(url,options)=>{urls.push({url:new URL(url),signal:options.signal});return new Response(JSON.stringify(httpError?{message:'Denied'}:httpRows),{status:httpError?403:200,headers:{'content-type':'application/json'}});}}});
const signal=new AbortController().signal;
const data=await readAssessmentHistory(sdk,'job-a','youth-a',signal);
assert.equal(data[0].version,2);assert.equal(data[0].criteria[0].evidence,null);
assert.equal(urls[0].url.searchParams.get('job_id'),'eq.job-a');assert.equal(urls[0].url.searchParams.get('youth_user_id'),'eq.youth-a');assert.equal(urls[0].url.searchParams.get('order'),'created_at.desc');assert.equal(urls[0].url.searchParams.get('limit'),'20');assert.ok(urls[0].signal);
httpRows=[];assert.deepEqual(await readAssessmentHistory(sdk,'job-a','youth-a',signal),[]);
for(const bad of [{...row,job_id:'other'},{...row,youth_user_id:'other'},{...row,created_at:'bad'},{...row,result:{criteria:[]}},{...row,result:{...row.result,criteria:[{id:'x',label:'Test',status:'invalid'}]}}]){httpRows=[bad];await assert.rejects(()=>readAssessmentHistory(sdk,'job-a','youth-a',signal));}
httpError=true;await assert.rejects(()=>readAssessmentHistory(sdk,'job-a','youth-a',signal));httpError=false;

// Run the component's real callbacks/effects with deterministic hook storage.
const realReact=require('react');let active;
function activate(view){active=view;}
class View{constructor(element){this.element=element;this.slots=[];this.effects=[];this.index=0;this.updates=0;}render(){activate(this);this.index=0;return this.element.type(this.element.props);}effectsNow(){for(const e of this.effects.filter(Boolean))if(e.pending){e.cleanup?.();e.cleanup=e.fn();e.pending=false;}}replay(){for(const e of this.effects.filter(Boolean)){e.cleanup?.();e.cleanup=e.fn();}}stop(){for(const e of this.effects.filter(Boolean))e.cleanup?.();}}
const hooks={...realReact,useState(initial){const index=active.index++;const current=active;if(!(index in current.slots))current.slots[index]=typeof initial==='function'?initial():initial;return[current.slots[index],value=>{current.updates++;current.slots[index]=typeof value==='function'?value(current.slots[index]):value;}];},useRef(initial){const v=active,i=v.index++;return v.slots[i]??={current:initial};},useEffect(fn,deps){const v=active,i=v.index++,old=v.effects[i];if(!old||deps.some((d,n)=>!Object.is(d,old.deps[n])))v.effects[i]={fn,deps,pending:true,cleanup:old?.cleanup};}};
const deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return{promise,resolve};};
const pending=[];
const client={from(table){assert.equal(table,'candidate_assessments');const filters={};const chain={select(){return chain;},eq(k,v){filters[k]=v;return chain;},order(){return chain;},limit(){return chain;},abortSignal(signal){const p=deferred();pending.push({...p,filters,signal});return p.promise;}};return chain;}};
const original=Module._load;
Module._load=function(name,parent,...rest){if(name==='react')return hooks;if(name==='@/lib/supabase')return{getSupabaseClient:()=>client};if(name==='@/lib/latest-read')return{createLatestRead:options=>createLatestRead({...options,timeoutMs:20})};if(name.startsWith('@/'))return original.call(this,path.resolve(name.slice(2)),parent,...rest);return original.call(this,name,parent,...rest);};
const nodes=root=>!root||typeof root!=='object'?[]:[root,...(Array.isArray(root)?root:[root.props?.children]).flat(Infinity).flatMap(nodes)];
const text=root=>root==null||typeof root==='boolean'?'':typeof root!=='object'?String(root):(Array.isArray(root)?root:[root.props?.children]).flat(Infinity).map(text).join('');
const settle=()=>new Promise(r=>setImmediate(r));
try{
const {CandidateAssessmentHistory}=require('../components/candidate-assessment-history.tsx');
const outer=new View({type:CandidateAssessmentHistory,props:{jobId:'job-a',youthId:'youth-a',revision:null}});
assert.equal(nodes(outer.render()).some(n=>n.type?.name==='HistoryContent'),false);assert.equal(pending.length,0,'Closed history performs no query');
outer.render().props.onToggle({currentTarget:{open:true}});
const content=nodes(outer.render()).find(n=>n.type?.name==='HistoryContent');let view=new View(content);view.render();view.effectsNow();assert.match(text(view.render()),/Hämtar/);
pending.at(-1).resolve({data:[row],error:null});await settle();assert.match(text(view.render()),/Fiktivt underlag/);
// New completed assessment gets a new content instance; old results disappear.
outer.element.props.revision='new-version';assert.notEqual(content.key,nodes(outer.render()).find(n=>n.type?.name==='HistoryContent').key);
outer.element.props.jobId='other';assert.notEqual(content.key,nodes(outer.render()).find(n=>n.type?.name==='HistoryContent').key);outer.element.props.jobId='job-a';
outer.render().props.onToggle({currentTarget:{open:false}});assert.equal(nodes(outer.render()).some(n=>n.type?.name==='HistoryContent'),false);view.stop();
view=new View(content);view.render();view.effectsNow();pending.at(-1).resolve({error:{message:'Denied'},data:null});await settle();assert.match(text(view.render()),/kunde inte hämtas/);
const retry=nodes(view.render()).find(n=>n.type==='button');const before=pending.length;retry.props.onClick();retry.props.onClick();assert.equal(pending.length,before+1,'Stale retry handlers cannot duplicate requests');pending.at(-1).resolve({data:[],error:null});await settle();assert.match(text(view.render()),/Inga sparade/);view.stop();
view=new View(content);view.render();view.effectsNow();const hung=pending.at(-1);await new Promise(r=>setTimeout(r,35));assert.equal(hung.signal.aborted,true);assert.match(text(view.render()),/kunde inte hämtas/);hung.resolve({data:[row],error:null});await settle();assert.doesNotMatch(text(view.render()),/Fiktivt underlag/);
nodes(view.render()).find(n=>n.type==='button').props.onClick();const detached=pending.at(-1);view.stop();const updates=view.updates;detached.resolve({data:[row],error:null});await settle();assert.equal(view.updates,updates,'Unmount blocks late updates');assert.equal(detached.signal.aborted,true);
view=new View(content);view.render();view.effectsNow();const old=pending.at(-1);view.replay();assert.equal(old.signal.aborted,true);pending.at(-1).resolve({data:[row],error:null});await settle();assert.match(text(view.render()),/Fiktivt underlag/);view.stop();
}finally{Module._load=original;}
console.log('PASS: lazy scoped history, SDK filters/abort, empty/error/retry, duplicate clicks, deadline with late response, unmount, Strict Mode and scope/revision isolation.');
