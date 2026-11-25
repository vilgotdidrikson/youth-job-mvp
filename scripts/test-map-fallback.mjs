import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Module,createRequire} from 'node:module';
import ts from 'typescript';
const require=createRequire(import.meta.url);
Module._extensions['.ts']=(module,file)=>module._compile(ts.transpileModule(readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,file);
const compile=(path,replace=false)=>ts.transpileModule(readFileSync(path,'utf8').replace(replace?'function MapPageContent()':'NEVER_MATCH', 'export function MapPageContent()'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;
const jsx=(type,props,key)=>({type,props,key});
const nodes=tree=>{const result=[];const visit=n=>{if(!n||typeof n!=='object')return;if(Array.isArray(n))return n.forEach(visit);result.push(n);visit(n.props?.children);};visit(tree);return result;};
const text=n=>typeof n==='string'||typeof n==='number'?String(n):Array.isArray(n)?n.map(text).join(''):text(n?.props?.children??'');
function harness(){const slots=[];let cursor=0;let pending=[];const changed=(a,b)=>!a||!b||a.length!==b.length||a.some((x,i)=>!Object.is(x,b[i]));
 const react={
 useState(value){const i=cursor++;if(!(i in slots))slots[i]=typeof value==='function'?value():value;return[slots[i],v=>{slots[i]=typeof v==='function'?v(slots[i]):v;}];},
 useRef(value){return slots[cursor++]??={current:value};},
 useMemo(fn,deps){const i=cursor++;if(!slots[i]||changed(slots[i].deps,deps))slots[i]={value:fn(),deps};return slots[i].value;},
 useCallback(fn,deps){return react.useMemo(()=>fn,deps);},
 useEffect(fn,deps){const i=cursor++;if(!slots[i]||changed(slots[i].deps,deps)){const old=slots[i];slots[i]={deps,cleanup:old?.cleanup};pending.push(()=>{old?.cleanup?.();slots[i].cleanup=fn();});}},Suspense:'suspense',
 };
 return{react,render(fn){cursor=0;return fn();},effects(){const list=pending;pending=[];list.forEach(fn=>fn());},unmount(){slots.forEach(slot=>slot?.cleanup?.());}};
}
const flush=async()=>{for(let i=0;i<10;i++)await Promise.resolve();};
function mapCase({token='qa-token',unsupported=false,throwSupport=false,throwConstructor=false,throwControl=false,jobs=[],active=true}={}){
 const hooks=harness(),reports=[],instances=[],timers=new Map();let timerId=0,removed=0,resizes=0;
 const canvasEvents={};const canvas={addEventListener:(k,fn)=>canvasEvents[k]=fn,removeEventListener:k=>delete canvasEvents[k]};
 const container={replaceChildren(){}};
 class MapMock{constructor(){if(throwConstructor)throw Error('init');this.events={};instances.push(this);}addControl(){if(throwControl)throw Error('control');}getCanvas(){return canvas;}once(k,fn){this.events[k]=fn;}on(k,fn){this.events[k]=fn;}getStyle(){return{layers:[]};}remove(){removed++;}resize(){resizes++;}easeTo(options){flyTo.push(options);}getZoom(){return 12;}}
 const frames=[],markers=[],popups=[],flyTo=[];
 const documentMock={activeElement:null,createElement:()=>new ElementMock()};
 class ElementMock {
  dataset={}; events={}; children=new Map(); attributes={}; classList={toggle(){}}; style={setProperty(){}};
  querySelector(selector){if(!this.children.has(selector))this.children.set(selector,new ElementMock());return this.children.get(selector);}
  querySelectorAll(selector){return selector === ".job-map-cta" ? [this.querySelector(selector)] : [];}
  setAttribute(k,v){this.attributes[k]=v;}
  getAttribute(k){return this.attributes[k];}
  addEventListener(k,fn){this.events[k]=fn;}
  contains(element){return [...this.children.values()].includes(element);}
  focus(){documentMock.activeElement=this;}
 }
 class MarkerMock {
  constructor({element}){this.element=element;}
  setLngLat(){return this;}
  addTo(){markers.push(this);return this;}
  getElement(){return this.element;}
  remove(){markers.splice(markers.indexOf(this),1);}
 }
 class PopupMock {
  constructor(options){this.options=options;}
  setLngLat(){return this;}
  setDOMContent(content){this.content=content;return this;}
  addTo(){popups.push(this);return this;}
  remove(){this.removed=true;}
 }
 const mapbox={Marker:MarkerMock,Popup:PopupMock,supported:()=>{if(throwSupport)throw Error('support');return!unsupported;},Map:MapMock,NavigationControl:class{}};
 const navigations=[];
 const router={push(path){navigations.push(path);}};
 const mod={exports:{}};new Function('module','exports','require','process','window','document','requestAnimationFrame',compile('components/job-map.tsx'))(mod,mod.exports,name=>{
  if(name==='react')return hooks.react;
  if(name==='react/jsx-runtime')return{jsx,jsxs:jsx,Fragment:'fragment'};
  if(name==='mapbox-gl')return{default:mapbox};
  if(name==='mapbox-gl/dist/mapbox-gl.css')return{};
  if(name==='next/navigation')return{useRouter:()=>router};
  if(name.startsWith('@/lib/'))return require('../lib/'+name.split('/').at(-1)+'.ts');
  throw Error(name);
 },{env:{NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN:token}},{setTimeout:fn=>{const id=++timerId;timers.set(id,fn);return id;},clearTimeout:id=>timers.delete(id),matchMedia:()=>({matches:true})},documentMock,fn=>frames.push(fn));
 let props={jobs,userCoordinates:null,active,onUnavailable:message=>reports.push(message)};
 const render=()=>{const tree=hooks.render(()=>mod.exports.JobMap(props));for(const n of nodes(tree))if(n.props?.ref)n.props.ref.current=container;hooks.effects();return tree;};
 return{render,hooks,reports,instances,canvasEvents,timers,markers,popups,frames,documentMock,flyTo,navigations,setProps:next=>props={...props,...next},get removed(){return removed;},get resizes(){return resizes;}};
}
for(const config of [{token:''},{unsupported:true},{throwSupport:true},{throwConstructor:true},{throwControl:true}]){
 const test=mapCase(config);test.render();await flush();test.render();assert(test.reports.at(-1),'Startup failures reach parent');test.hooks.unmount();if(config.throwControl)assert.equal(test.removed,1,'Partial map removed');
}
const timeout=mapCase();timeout.render();[...timeout.timers.values()][0]();timeout.render();assert.match(timeout.reports.at(-1),/svarade inte/);timeout.hooks.unmount();assert.equal(timeout.timers.size,0);assert.equal(timeout.removed,1);
const partial=mapCase();partial.render();partial.instances[0].events['style.load']();partial.render();assert.equal(partial.timers.size,1,'Style alone does not mean a usable map');[...partial.timers.values()][0]();partial.render();assert.match(partial.reports.at(-1),/svarade inte/);partial.hooks.unmount();
const denied=mapCase();denied.render();denied.instances[0].events.error({error:{status:403,message:'Forbidden'}});denied.render();assert.match(denied.reports.at(-1),/inte visas/);denied.hooks.unmount();
const early=mapCase();early.render();early.instances[0].events.error({error:Error('network')});early.render();assert(early.reports.at(-1));early.hooks.unmount();
const ready=mapCase({active:false});ready.render();ready.instances[0].events['style.load']();ready.instances[0].events.load();ready.render();assert.equal(ready.reports.at(-1),null);assert.equal(ready.resizes,0);ready.setProps({active:true});ready.render();assert.equal(ready.resizes,1,'Returning to visible map recalculates canvas');
ready.instances[0].events.error({error:Error('one temporary tile failure')});ready.render();assert.equal(ready.reports.at(-1),null,'Do not discard healthy map for one transient tile error');
let prevented=false;ready.canvasEvents.webglcontextlost({preventDefault(){prevented=true;}});ready.render();assert(prevented);assert.match(ready.reports.at(-1),/grafikstödet/);ready.hooks.unmount();assert(!ready.canvasEvents.webglcontextlost);
const unlocated=mapCase({jobs:[{id:'unknown',city:'QA unknown',longitude:NaN,latitude:999}]});unlocated.render();assert.match(unlocated.reports.at(-1),/saknar en plats/);unlocated.hooks.unmount();
console.log('PASS actual JobMap: missing token, unsupported/thrown WebGL check, constructor/control failure, timeout, forbidden/startup error, healthy style, resize, context loss, cleanup and invalid/unknown coordinates.');
const interactive=mapCase({jobs:[{id:'map-qa',title:'Fiktivt lagerjobb',city:'Stockholm',latitude:59.32,longitude:18.06}]});
interactive.render();
interactive.instances[0].events['style.load']();
interactive.instances[0].events.load();
interactive.render();
const getPin=()=>interactive.markers[0].getElement().querySelector('.job-map-pin');
let pin=getPin();
const event={detail:0,preventDefault(){},stopPropagation(){}};
pin.focus();
pin.events.click(event);
interactive.render();
const popup=interactive.popups.at(-1);
assert.equal(popup.options.focusAfterOpen,false,'Mapbox should leave hover focus alone');
assert.equal(interactive.documentMock.activeElement,popup.content.querySelector('.job-map-close'),'Keyboard goes to the dismiss control');
assert.equal(getPin().attributes['aria-expanded'],'true');
const cta=popup.content.querySelector('.job-map-cta');
cta.dataset.jobId='map-qa';
cta.events.click();
assert.deepEqual(interactive.navigations,['/jobb/map-qa'],'Product map opens the normal job page');
popup.content.events.keydown({...event,key:'Escape'});
interactive.render();
interactive.frames.forEach(fn=>fn());
assert.equal(getPin().attributes['aria-expanded'],'false');
assert.equal(interactive.documentMock.activeElement,getPin(),'Escape returns focus to the current marker');
assert.ok(popup.removed);
assert.equal(interactive.flyTo[0]?.duration,0,'Initial viewport respects reduced motion');
pin=getPin();
pin.focus();
pin.events.pointerenter();
interactive.render();
assert.notEqual(interactive.documentMock.activeElement,interactive.popups.at(-1).content.querySelector('.job-map-close'),'Hover leaves focus outside the popup');
const demoSelections=[];
interactive.setProps({onOpenJob:id=>demoSelections.push(id)});
interactive.render();
const demoCta=interactive.popups.at(-1).content.querySelector('.job-map-cta');
demoCta.dataset.jobId='map-qa';
demoCta.events.click();
assert.deepEqual(demoSelections,['map-qa'],'Demo map opens the fictional job in the demo');
assert.deepEqual(interactive.navigations,['/jobb/map-qa'],'Demo does not navigate to a production job');
interactive.hooks.unmount();
console.log('PASS actual JobMap with DOM doubles: keyboard popup, Escape, origin focus, passive hover and reduced motion.');
// Actual parent view handles fallback and retry without changing results/filters.
const hooks=harness();const params=new URLSearchParams('workTime=weekend&onlyKnown=yes');const auth={user:{id:'qa'},profile:{role:'youth'},status:'ready'};
const jobs=[{id:'one',title:'QA Café',city:'Stockholm',company_user_id:'qa',employment_type:'Deltid',created_at:'2026-01-01',practical_details:{times:['weekend']}},{id:'two',title:'QA Lager',city:'Stockholm',company_user_id:'qa2',employment_type:'Deltid',created_at:'2026-01-02',practical_details:{times:['evening']}}];
const frame=[];let focusCount=0;let failFeed=false;let feed=jobs;
const heading={focus(){focusCount++;}},canvas={contains:element=>element==='map-focus'};
const documentMock={activeElement:'other-focus'};
const mod={exports:{}};new Function('module','exports','require','document','requestAnimationFrame',compile('app/kartan/page.tsx',true))(mod,mod.exports,name=>{
 if(name==='react')return hooks.react;
 if(name==='react/jsx-runtime')return{jsx,jsxs:jsx,Fragment:'fragment'};
 if(name==='next/navigation')return{useSearchParams:()=>params};
 if(name==='next/link')return{default:'link'};
 if(name.endsWith('.css'))return{};
 if(name==='@/components/job-map')return{JobMap:'job-map'};
 if(name==='@/components/ui-icon')return{UiIcon:'icon'};
 if(name==='@/hooks/use-require-auth')return{useRequireAuth:()=>auth};
 if(name==='@/components/auth-gate-message')return{};
 if(name==='@/components/page-loading')return{PageLoading:'page-loading'};
 if(name==='@/lib/feeds')return{getSwipeJobs:async()=>{if(failFeed)throw Error('QA network failure');return feed;}};
 if(name==='@/lib/supabase')return{getSupabaseClient:()=>({from:()=>({select:()=>({eq:()=>({maybeSingle:async()=>({data:{city:'Stockholm'}})})})})})};
 if(name.startsWith('@/lib/'))return require('../lib/'+name.split('/').at(-1)+'.ts');
 throw Error(name);
},documentMock,fn=>frame.push(fn));
const render=()=>{const tree=hooks.render(()=>mod.exports.MapPageContent());for(const node of nodes(tree)){if(node.type==='h2'&&node.props.ref)node.props.ref.current=heading;if(node.props?.className==='mnw-map-canvas')node.props.ref.current=canvas;}hooks.effects();return tree;};
let tree=render();await flush();tree=render();let map=nodes(tree).find(n=>n.type==='job-map');assert.deepEqual(map.props.jobs.map(j=>j.id),['one']);
map.props.onUnavailable('QA kartfel');tree=render();assert(tree.props.className.endsWith('view-list'));assert(!nodes(tree).some(n=>n.type==='job-map'),'Failed map unmounted');assert.equal(nodes(tree).filter(n=>n.type==='article').length,1);assert.equal(focusCount,0,'Never steal focus from list/header');assert(nodes(tree).some(n=>n.props?.href==='/swipe?workTime=weekend&onlyKnown=yes'));
const retry=nodes(tree).find(n=>n.type==='button'&&text(n)==='Försök visa kartan igen');retry.props.onClick();tree=render();map=nodes(tree).find(n=>n.type==='job-map');assert.equal(map.key,1,'Retry creates a fresh map instance');assert.deepEqual(map.props.jobs.map(j=>j.id),['one']);
const listButton=nodes(tree).find(n=>n.type==='button'&&text(n)==='Lista');listButton.props.onClick();tree=render();assert(tree.props.className.endsWith('view-list'));assert.equal(nodes(tree).find(n=>n.type==='job-map').props.active,false);
const mapButton=nodes(tree).find(n=>n.type==='button'&&text(n)==='Karta');mapButton.props.onClick();tree=render();documentMock.activeElement='map-focus';nodes(tree).find(n=>n.type==='job-map').props.onUnavailable('grafikfel');tree=render();frame.forEach(fn=>fn());assert.equal(focusCount,1,'Return focus when the removed map held it');
failFeed=true;auth.user={id:'qa-retry'};tree=render();await flush();tree=render();assert(nodes(tree).some(n=>n.props?.role==='alert'&&text(n).includes('QA network failure')));
failFeed=false;nodes(tree).find(n=>n.type==='button'&&text(n)==='Försök hämta jobben igen').props.onClick();tree=render();assert(nodes(tree).some(n=>n.props?.role==='status'&&text(n)==='Hämtar jobb…'));await flush();tree=render();assert.equal(nodes(tree).filter(n=>n.type==='article').length,1,'Data retry restores same filtered jobs');
feed=[];auth.user={id:'qa-empty'};tree=render();await flush();tree=render();assert.equal(nodes(tree).filter(n=>n.type==='article').length,0);assert(nodes(tree).some(n=>n.props?.href==='/swipe?workTime=weekend&onlyKnown=yes'&&text(n)==='Ändra sökval'));
hooks.unmount();
console.log('PASS actual map page: full-list fallback, unchanged filtered results/links, fresh retry, explicit view toggles, active canvas and conditional focus return.');
