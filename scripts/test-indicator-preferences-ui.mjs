import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire,Module} from 'node:module';
import path from 'node:path';
import ts from 'typescript';
const require=createRequire(import.meta.url),original=Module._load,react=require('react');
for(const ext of ['.ts','.tsx'])Module._extensions[ext]=(m,f)=>m._compile(ts.transpileModule(readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText,f);
Module._extensions['.css']=m=>{m.exports={__esModule:true,default:{section:'section'}};};
let active,reads=[],writes=[],preferences={version:1,messages:true,questions:true,notifications:true},session={user:{id:'A'},profile:{role:'youth'}};
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return{promise,resolve,reject};};
class IndicatorPreferencesError extends Error{constructor(message,uncertain=false){super(message);this.uncertain=uncertain;}}
const hooks={...react,useContext:context=>context._currentValue,useState(initial){const v=active,i=v.index++;if(!(i in v.slots))v.slots[i]=typeof initial==='function'?initial():initial;return[v.slots[i],value=>{v.slots[i]=typeof value==='function'?value(v.slots[i]):value;v.updates++;}];},useRef(initial){return active.slots[active.index++]??={current:initial};},useEffect(fn,deps){const i=active.index++,old=active.effects[i];if(!old||deps.some((d,j)=>!Object.is(d,old.deps[j])))active.effects[i]={fn,deps,pending:true,cleanup:old?.cleanup};}};
const events=new EventTarget();globalThis.window=events;globalThis.document={visibilityState:'visible',addEventListener(){},removeEventListener(){}};window.setInterval=()=>1;window.clearInterval=()=>{};
let queryCount=0;
Module._load=function(n,parent,...args){
 if(n==='react')return hooks;
 if(n==='next/navigation')return{usePathname:()=>'/profile'};
 if(n==='@/hooks/use-session'||n==='./use-session')return{useSession:()=>session};
 if(n==='@/hooks/use-indicator-preferences'||n==='./use-indicator-preferences')return{INDICATOR_PREFERENCES_CHANGED:'mnw-indicator-preferences-changed',useIndicatorPreferences:()=>preferences};
 if(n==='@/lib/supabase')return{getSupabaseClient:()=>({from(table){queryCount++;const data=table==='notifications'?[{type:'message'}]:table==='application_followups'?[{job_id:'qa'}]:[];return{select(){return this;},eq(){return this;},is(){return this;},limit(){return Promise.resolve({data,error:null});},then(resolve,reject){return Promise.resolve({data,error:null}).then(resolve,reject);}};}})};
 if(n==='@/lib/notification-indicator-client')return{IndicatorPreferencesError,loadIndicatorPreferences:(...args)=>{const d=deferred();reads.push({...d,args});return d.promise;},saveIndicatorPreferences:(...args)=>{const d=deferred();writes.push({...d,args});return d.promise;}};
 if(n.startsWith('@/'))return original.call(this,path.resolve(n.slice(2)),parent,...args);
 return original.call(this,n,parent,...args);
};
const {IndicatorPreferencesSettings:Panel}=require('../components/indicator-preferences-settings.tsx');
const {IndicatorPreferencesProvider:Provider}=require('../hooks/use-indicator-preferences.tsx');
const {NavigationIndicatorsProvider:Navigation}=require('../hooks/use-navigation-indicators.tsx');
class View{constructor(fn,props={}){this.index=0;this.slots=[];this.effects=[];this.updates=0;this.fn=fn;this.props=props;}render(){active=this;this.index=0;return this.fn(this.props);}flush(){for(const e of this.effects.filter(Boolean))if(e.pending){e.cleanup?.();e.cleanup=e.fn();e.pending=false;}}stop(){for(const e of this.effects.filter(Boolean))e.cleanup?.();}}
const nodes=n=>!n||typeof n!=='object'?[]:[n,...(Array.isArray(n)?n:[n.props?.children]).flat(Infinity).flatMap(nodes)];
const text=n=>n==null||typeof n==='boolean'?'':typeof n!=='object'?String(n):(Array.isArray(n)?n:[n.props?.children]).flat(Infinity).map(text).join('');
const button=(v,label)=>{const b=nodes(v.render()).find(n=>n.type==='button'&&text(n)===label);assert.ok(b,label);return b;};
const change=(v,index,value)=>nodes(v.render()).filter(n=>n.type==='input')[index].props.onChange({target:{checked:value}});
const settle=async()=>{for(let i=0;i<35;i++)await Promise.resolve();};
async function mount(){reads=[];writes=[];const element=Panel({userId:'A'}),v=new View(element.type,element.props);v.render();v.flush();reads[0].resolve({configured:false,preferences:{...preferences}});await settle();return v;}
try{
 let v=await mount();assert.equal(writes.length,0);assert.equal(button(v,'Spara markeringar').props.disabled,true);change(v,0,false);const save=button(v,'Spara markeringar').props.onClick;save();save();assert.equal(writes.length,1);assert.equal(writes[0].args[0],'A');assert.equal(writes[0].args[1].messages,false);writes[0].resolve({configured:true,preferences:{...preferences,messages:false}});await settle();assert.match(text(v.render()),/sparade på kontot/);assert.equal(button(v,'Spara markeringar').props.disabled,true);v.stop();
 v=await mount();change(v,0,false);button(v,'Spara markeringar').props.onClick();writes[0].reject(new IndicatorPreferencesError('Kontrollera sparningen',true));await settle();assert.equal(button(v,'Spara markeringar').props.disabled,true);const check=button(v,'Kontrollera sparningen').props.onClick;check();check();assert.equal(reads.length,2);assert.equal(writes.length,1);reads[1].resolve({configured:true,preferences});await settle();assert.equal(nodes(v.render()).find(n=>n.type==='input').props.checked,false,'Unconfirmed form edits survive read-back');assert.equal(button(v,'Spara markeringar').props.disabled,false);assert.equal(writes.length,1,'Read-back never retries write');button(v,'Använd sparade val').props.onClick();assert.equal(button(v,'Spara markeringar').props.disabled,true);v.stop();
 v=await mount();change(v,0,false);button(v,'Spara markeringar').props.onClick();v.stop();const count=v.updates;writes[0].resolve({configured:true,preferences});await settle();assert.equal(v.updates,count);assert.equal(writes[0].args[2].aborted,true);assert.notEqual(Panel({userId:'A'}).key,Panel({userId:'B'}).key);
 reads=[];writes=[];const e=Panel({userId:'A'});v=new View(e.type,e.props);v.render();v.flush();v.stop();for(const effect of v.effects.filter(Boolean))effect.pending=true;v.flush();reads[0].resolve({configured:false,preferences});await settle();assert.match(text(v.render()),/Läser sparade/);reads[1].resolve({configured:false,preferences});await settle();assert.equal(button(v,'Läs sparade val').props.disabled,false);v.stop();
 session={user:{id:'A'},profile:{role:'company'}};assert.equal(Panel({userId:'A'}).props.showQuestions,false);session.profile.role='youth';assert.equal(Panel({userId:'A'}).props.showQuestions,true);
 // Real provider callbacks: no stale account preference or failed-read reset.
 reads=[];v=new View(Provider,{children:null});v.render();v.flush();reads[0].resolve({configured:true,preferences:{...preferences,messages:false}});await settle();assert.equal(v.render().props.value.messages,false);window.dispatchEvent(new Event('mnw-indicator-preferences-changed'));reads[1].reject(Error('offline'));await settle();assert.equal(v.render().props.value.messages,false);session={user:{id:'B'},profile:{role:'youth'}};assert.equal(v.render().props.value.messages,true);v.flush();reads[2].resolve({configured:true,preferences:{...preferences,questions:false}});await settle();assert.equal(v.render().props.value.questions,false);v.stop();
 // Real navigation effect still loads the same content; preferences mask only dots.
 session={user:{id:'A'},profile:{role:'youth'}};queryCount=0;v=new View(Navigation,{children:null});v.render();v.flush();await settle();assert.deepEqual(v.render().props.value,{messages:true,questions:true,notifications:true});const before=queryCount;preferences={...preferences,messages:false,questions:false,notifications:false};assert.deepEqual(v.render().props.value,{messages:false,questions:false,notifications:false});assert.equal(queryCount,before,'Changing display choices does not change read queries/content');session={user:{id:'B'},profile:{role:'youth'}};assert.deepEqual(v.render().props.value,{messages:false,questions:false,notifications:false});v.stop();
 console.log('PASS indicator UI/provider/navigation callbacks: explicit save, double-click lock, uncertain read-back, preserved edits, account reset, cancellation/replayed effects, role controls, last confirmed offline state and display-only masking. Simulated hooks/DOM/services, no browser claim.');
}finally{Module._load=original;}
