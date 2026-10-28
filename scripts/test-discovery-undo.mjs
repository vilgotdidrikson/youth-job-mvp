import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
const compile=path=>ts.transpileModule(readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const slots=[];let cursor=0;
const react={useRef(value){const i=cursor++;return slots[i]??=( {current:value});},useState(value){const i=cursor++;if(!(i in slots))slots[i]=value;return[slots[i],v=>{slots[i]=typeof v==='function'?v(slots[i]):v;}];},useCallback(fn){return fn;}};
const mod={exports:{}};new Function('module','exports','require',compile('hooks/use-discovery-undo.ts'))(mod,mod.exports,()=>react);
const render=()=>{cursor=0;return mod.exports.useDiscoveryUndo();};
const a={id:'a',title:'QA Café'},b={id:'b',title:'QA Butik'};
let hook=render();assert.equal(hook.lastSkip,null);
const old=hook.begin();hook=render();assert.equal(hook.lastSkip,null,'No undo before server confirmation');
const latest=hook.begin();latest(b,'token-b');old(a,'token-a');hook=render();assert.equal(hook.lastSkip.job.id,'b','Out-of-order result cannot replace latest choice');
hook.begin();old(a,'old');hook=render();assert.equal(hook.lastSkip,null,'Interest or failed latest decision clears older undo');
const beforeReload=hook.begin();hook.clear();beforeReload(a,'late');hook=render();assert.equal(hook.lastSkip,null,'Feed/account reset invalidates pending response');
hook.begin()(a,'a2');hook=render();assert.equal(hook.lastSkip.token,'a2');hook.clear();hook=render();assert.equal(hook.lastSkip,null);
let failure=false,response={status:'dismissed',undo_token:'2026-10-25T20:00:00.123456+00:00'};const calls=[];
const transport={rpc:async(name,args)=>{calls.push({name,args});return{data:response,error:failure?{}:null};}};
const api={exports:{}};new Function('module','exports','require',compile('lib/discovery-history.ts'))(api,api.exports,name=>name.includes('supabase')?{getSupabaseClient:()=>transport}:{});
const token=await api.exports.dismissDiscoveryJob('a');assert.equal(token,response.undo_token,'Preserve database microseconds');
assert.deepEqual(calls.at(-1),{name:'set_my_discovery_dismissal',args:{p_job_id:'a',p_undo_token:null}});
response={status:'restored'};await api.exports.undoDiscoveryDismissal('a',token);assert.equal(calls.at(-1).args.p_undo_token,token);
failure=true;await assert.rejects(api.exports.undoDiscoveryDismissal('a',token));await assert.rejects(api.exports.dismissDiscoveryJob('a'));
failure=false;response=null;await assert.rejects(api.exports.dismissDiscoveryJob('a'));await assert.rejects(api.exports.undoDiscoveryDismissal('a',token));
console.log('PASS discovery undo: real hook ordering/reset, server-confirmed token, exact RPC payload, failed/empty transport results.');
// Execute the actual page handlers with simulated React and transport.
const pageSlots=[];let pageCursor=0,firstRender=true;const effects=[];
const pageReact={
 useRef(value){const i=pageCursor++;return pageSlots[i]??={current:value};},
 useState(value){const i=pageCursor++;if(!(i in pageSlots))pageSlots[i]=typeof value==='function'?value():value;return[pageSlots[i],v=>{pageSlots[i]=typeof v==='function'?v(pageSlots[i]):v;}];},
 useCallback(fn){const i=pageCursor++;return pageSlots[i]??=fn;},
 useMemo(fn){return fn();},useEffect(fn){if(firstRender)effects.push(fn);},Suspense:()=>null,
};
const hookMod={exports:{}};new Function('module','exports','require',compile('hooks/use-discovery-undo.ts'))(hookMod,hookMod.exports,()=>pageReact);
const jobA={...a,employment_type:'Deltid'},jobB={...b,employment_type:'Deltid'};let feed=[jobA,jobB],reloadFails=false;
const writes=[];let releaseSkip,releaseUndo,undoFail=false;
const deps={
 '@/lib/job-categories':{jobCategoryFilterValues:()=>[]},'@/lib/job-workplaces':{getJobWorkplaces:()=>[]},
 'react':pageReact,'react/jsx-runtime':{jsx:(type,props)=>({type,props}),jsxs:(type,props)=>({type,props}),Fragment:'fragment'},
 'next/navigation':{useRouter:()=>({replace(){}}),useSearchParams:()=>({get(){return null;}})},
 '@/components/job-discovery':{JobDiscovery:'discovery'},'@/components/auth-gate-message':{},'@/components/page-loading':{PageLoading:'page-loading'},
 '@/lib/job-discovery':{orderDiscoveryJobs:jobs=>jobs},
 '@/lib/job-search':{readSearchFilters:()=>({query:'',city:'',category:'',employmentType:'',workTime:'',nearbyCity:'',radiusKm:'',onlyKnown:''})},
 '@/lib/discovery-history':{
  dismissDiscoveryJob:async id=>{writes.push(id);if(id==='a')await new Promise(r=>releaseSkip=r);return id+'-token';},
  undoDiscoveryDismissal:async id=>{writes.push('undo-'+id);await new Promise(r=>releaseUndo=r);if(undoFail)throw Error('offline');},
 },
 '@/hooks/use-discovery-undo':hookMod.exports,
 '@/lib/feeds':{getSwipeJobs:async()=>{if(reloadFails)throw Error('load');return feed;}},
 '@/hooks/use-require-auth':{useRequireAuth:()=>({user:{id:'qa'},profile:{role:'youth'},loading:false,status:'ready'})},
 '@/hooks/use-cv-completion':{useCvCompletion:()=>({cvCompleted:false,cvLoading:false})},
 '@/lib/matching':{swipeJob:async()=>{}},
 '@/lib/youth-job-flow':{getYouthFlowState:async()=>({shortOnboardingCompleted:true}),getSavedJobs:async()=>[],saveApplicationDraft:async()=>{},setJobSaved:async()=>{}},
};
const pageCode=ts.transpileModule(readFileSync('app/swipe/page.tsx','utf8').replace('function SwipePageContent()', 'export function SwipePageContent()'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;
const pageMod={exports:{}};
new Function('module','exports','require','window',pageCode)(pageMod,pageMod.exports,name=>{if(!(name in deps))throw Error(name);return deps[name];},{addEventListener(){},removeEventListener(){},dispatchEvent(){}});
const renderPage=()=>{pageCursor=0;const tree=pageMod.exports.SwipePageContent();firstRender=false;return tree.props.children[0].props;};
const flush=async()=>{for(let i=0;i<15;i++)await Promise.resolve();};
let view=renderPage();effects.forEach(fn=>fn());await flush();view=renderPage();
await view.onDecision(jobA,'skip');await view.onDecision(jobB,'skip');await flush();assert.deepEqual(writes,['a'],'Deck releases immediately but writes keep click order');
releaseSkip();await flush();assert.deepEqual(writes,['a','b']);view=renderPage();assert.equal(view.undoTitle,'QA Butik');
const firstUndo=view.onUndo();const duplicateUndo=view.onUndo();await flush();assert.equal(writes.filter(v=>v==='undo-b').length,1,'Immediate double-click invokes undo once');
assert.equal(renderPage().jobs.length,0,'No optimistic restoration before server confirms');
releaseUndo();await Promise.all([firstUndo,duplicateUndo]);view=renderPage();assert.equal(view.undoTitle,undefined);assert.equal(view.jobs.length,2,'Authoritative feed restores eligibility after confirmed undo');
await view.onDecision(jobB,'skip');await flush();view=renderPage();undoFail=true;
const failedUndo=view.onUndo();await flush();releaseUndo();await failedUndo;view=renderPage();assert.equal(view.undoTitle,'QA Butik','Failed write retains retry');assert.match(view.error,/offline/);
undoFail=false;reloadFails=true;const successfulUndo=view.onUndo();await flush();releaseUndo();await successfulUndo;view=renderPage();assert.equal(view.undoTitle,undefined,'Consumed token is not offered again when reload fails');assert.match(view.notice,/ångrat.*Ladda om/);
console.log('PASS actual swipe page: queued writes, latest choice, double-click lock, confirmed refresh, failure retry and saved-write/read-failure.');
