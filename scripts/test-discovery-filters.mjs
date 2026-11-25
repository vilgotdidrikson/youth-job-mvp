import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire, Module } from 'node:module';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import ts from 'typescript';
const require=createRequire(import.meta.url),originalLoad=Module._load;
for(const ext of ['.ts','.tsx'])Module._extensions[ext]=(mod,file)=>mod._compile(ts.transpileModule(process.env.DISCOVERY_PAGE_REF&&file.endsWith('/app/swipe/page.tsx')?execFileSync('git',['show',`${process.env.DISCOVERY_PAGE_REF}:app/swipe/page.tsx`],{encoding:'utf8'}):readFileSync(file,'utf8'),{fileName:file,compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText,file);
Module._extensions['.css']=mod=>{mod.exports={__esModule:true,default:{}};};
const React=require('react');let current;
const same=(a,b)=>a&&b&&a.length===b.length&&a.every((v,i)=>Object.is(v,b[i]));
const hooks={...React,
 useState(initial){const v=current,i=v.index++;if(!(i in v.slots))v.slots[i]=typeof initial==='function'?initial():initial;return[v.slots[i],value=>{v.slots[i]=typeof value==='function'?value(v.slots[i]):value;}];},
 useRef(initial){const v=current,i=v.index++;return v.slots[i]??={current:initial};},
 useCallback(fn,deps){const v=current,i=v.index++;if(!same(v.slots[i]?.deps,deps))v.slots[i]={fn,deps};return v.slots[i].fn;},
 useMemo(fn){return fn();},
 useEffect(fn,deps){const v=current,i=v.index++,old=v.effects[i];if(!old||!same(old.deps,deps))v.effects[i]={fn,deps,pending:true,cleanup:old?.cleanup};},
};
const views=[];
class View{constructor(element){this.element=element;this.slots=[];this.effects=[];this.index=0;views.push(this);}render(){return renderView(this);}flush(){for(const e of this.effects.filter(Boolean))if(e.pending){e.cleanup?.();e.cleanup=e.fn();e.pending=false;}}stop(){for(const e of this.effects.filter(Boolean)){e.cleanup?.();e.cleanup=undefined;}}}
function renderView(v){current=v;v.index=0;return v.element.type(v.element.props);}
const nodes=root=>!root||typeof root!=='object'?[]:[root,...(Array.isArray(root)?root:[root.props?.children]).flat(Infinity).flatMap(nodes)];
const text=root=>root==null||typeof root==='boolean'?'':typeof root!=='object'?String(root):(Array.isArray(root)?root:[root.props?.children]).flat(Infinity).map(text).join('');
const button=(v,label)=>{const n=nodes(v.render()).find(n=>n.type==='button'&&text(n)===label);assert.ok(n,label);return n;};
const select=(v,label)=>{const node=nodes(v.render()).find(n=>n.type==='label'&&text(n).startsWith(label));assert.ok(node,label);return nodes(node).find(n=>n.type==='select'||n.type==='input');};
const settle=async()=>{for(let i=0;i<20;i++)await Promise.resolve();};
const params=new URLSearchParams(),user={id:'qa-youth'},profile={role:'youth'},router={replace(){}};
let feed=[],writes=[],failId=null;
function Dummy(){return null;}
Module._load=function(name,parent,...rest){
 if(name==='react')return hooks;
 if(name==='next/link')return Dummy;
 if(name==='next/navigation')return{useRouter:()=>router,useSearchParams:()=>params};
 if(name==='@/hooks/use-require-auth')return{useRequireAuth:()=>({user,profile,loading:false,status:'ready'})};
 if(name==='@/hooks/use-cv-completion')return{useCvCompletion:()=>({cvCompleted:false,cvLoading:false})};
 if(name==='@/lib/feeds')return{getSwipeJobs:async()=>feed};
 if(name==='@/lib/matching')return{swipeJob:async()=>{throw Error('No application should be sent in this test');}};
 if(name==='@/lib/discovery-history')return{dismissDiscoveryJob:async id=>{writes.push(id);if(id===failId)throw Error('offline');return'id-'+id;},recordJobImpression:async()=>{},undoDiscoveryDismissal:async()=>{}};
 if(name==='@/lib/youth-job-flow')return{getYouthFlowState:async()=>({shortOnboardingCompleted:true}),getSavedJobs:async()=>[],saveApplicationDraft:async()=>{},setJobSaved:async()=>{}};
 if((name.startsWith('@/components/')&&name!=='@/components/job-discovery')||['./notification-link','./job-swipe-deck','./ui-icon'].includes(name))return new Proxy({},{get:()=>Dummy});
 return originalLoad.call(this,name.startsWith('@/')?path.resolve(name.slice(2)):name,parent,...rest);
};
const body={};globalThis.HTMLElement=class{};globalThis.document={activeElement:body,body};globalThis.window={addEventListener(){},removeEventListener(){},dispatchEvent(){}};
try{
 const search=require('../lib/job-search.ts'),domain=require('../lib/job-discovery.ts');
 const base={id:'qa',company_user_id:'qa-company',title:'QA jobb',description:'QA',category:'cafe',requirements:'',city:'Stockholm',employment_type:'Deltid',salary_per_hour:'140–180 kr/tim',created_at:'2026-11-01'};
 const hourly={salaryUnit:'hour',salaryMin:'140',onlyKnown:'yes'};
 for(const pay of ['140 kr/h','Från 145 kr/tim','140–180 kr/tim'])assert.equal(search.matchesSalarySearch({...base,salary_per_hour:pay},hourly),true,pay);
 for(const pay of ['139–180 kr/tim','139 kr/h','Upp till 130 kr/tim','25 000 kr/mån','500 kr/period'])assert.equal(search.matchesSalarySearch({...base,salary_per_hour:pay},hourly),false,pay);
 for(const pay of ['Upp till 180 kr/tim','Enligt avtal','140 kr','140 kr/h plus OB']){assert.equal(search.matchesSalarySearch({...base,salary_per_hour:pay},hourly),false,pay);assert.equal(search.matchesSalarySearch({...base,salary_per_hour:pay},{...hourly,onlyKnown:''}),true,pay);}
 assert.equal(search.matchesSalarySearch({...base,salary_per_hour:'139–180 kr/tim'},{...hourly,onlyKnown:''}),false,'Known low floor is not unknown');
 assert.equal(search.matchesSalarySearch({...base,salary_per_hour:'25 000 kr/mån'},{salaryUnit:'month',salaryMin:'24 000',onlyKnown:'yes'}),true);
 assert.ok(search.searchDetailLabels({...base,salary_per_hour:'Upp till 180 kr/tim'},hourly).includes('Annonserad lägstalön saknas'));
 for(const query of ['salaryUnit=usd&salaryMin=100','salaryUnit=hour&salaryMin=-1','salaryUnit=hour&salaryMin=1001','salaryUnit=month&salaryMin=200001','salaryUnit=hour&salaryMin=NaN','salaryMin=100'])assert.equal(search.readSearchFilters(new URLSearchParams(query)).salaryUnit,'',query);
 assert.equal(search.readSearchFilters(new URLSearchParams('salaryUnit=hour&salaryMin=+++')).salaryMin,'');
 const filters=search.readSearchFilters(new URLSearchParams('query=cafe&nearbyCity=Stockholm&radiusKm=10&salaryUnit=month&salaryMin=25+000&onlyKnown=yes'));
 assert.equal(filters.salaryMin,'25000');assert.deepEqual(search.readSearchFilters(new URL(search.searchHref('/kartan',filters),'https://qa.invalid').searchParams),filters);
 assert.equal(search.updateSearchFilter(filters,'nearbyCity','').radiusKm,'');assert.equal(search.updateSearchFilter(filters,'salaryUnit','').salaryMin,'');
 const {emptyRecruitmentProfile}=require('../lib/recruitment-profile.ts');const youth=emptyRecruitmentProfile();youth.availability.periods=['evening'];youth.availability.days=['sat'];
 const score=(details,requirements='')=>domain.prepareDiscoveryJob({...base,practical_details:details,requirements},{recruitment_profile:youth},false).discovery;
 assert.equal(score({times:['evening']}).score,1);assert.equal(score({times:['weekend']}).score,1);assert.equal(score({times:['weekday']},'Kan arbeta kvällar').score,0,'Structured times override conflicting legacy phrase');assert.equal(score({times:['evening','weekend']}).score,1,'Availability contributes once');assert.equal(domain.prepareDiscoveryJob({...base,practical_details:{times:['evening']}},null,false).discovery.score,0);
 console.log('PASS N06/N18 actual domain functions: salary floor/unit/range/unknown boundaries, URL normalization, grouped filters, structured availability and neutral unknowns.');

 const {JobSearchDialog}=require('../components/job-search-dialog.tsx');let applied=[],closed=0;
 const options={cities:['Stockholm','Göteborg'],categories:['cafe'],employmentTypes:['Deltid']};
 const makeDialog=()=>new View({type:JobSearchDialog,props:{initialValues:filters,options,onApply:v=>applied.push(v),onClose:()=>{closed++;}}});
 const dialog=makeDialog();dialog.render();dialog.flush();select(dialog,'Ort').props.onChange({target:{value:'Göteborg'}});assert.equal(applied.length,0,'Draft changes never change live search');
 button(dialog,'Rensa filter').props.onClick();assert.equal(applied.length,0,'Reset remains a draft until confirmed');assert.equal(select(dialog,'Ort').props.value,'');button(dialog,'Avbryt').props.onClick();assert.equal(closed,1);assert.equal(applied.length,0);dialog.stop();
 const valid=makeDialog();valid.render();valid.flush();select(valid,'Lönetyp').props.onChange({target:{value:'hour'}});select(valid,'Minst annonserad').props.onChange({target:{value:'1001'}});
 const submit=()=>nodes(valid.render()).find(n=>n.type==='form').props.onSubmit({preventDefault(){}});submit();assert.equal(applied.length,0);assert.match(text(valid.render()),/ovanligt högt/);
 select(valid,'Minst annonserad').props.onChange({target:{value:'150'}});submit();submit();assert.equal(applied.length,1,'Confirm is atomic and double submit runs once');assert.equal(applied[0].salaryMin,'150');assert.equal(applied[0].salaryUnit,'hour');assert.equal(filters.salaryUnit,'month','Incoming state is never mutated');valid.stop();
 for(const action of ['escape','outside','inside']){const v=makeDialog();const modal=v.render();v.flush();const native=new View(modal);const tree=native.render();native.flush();const before=closed;
  if(action==='escape'){let prevented=false;tree.props.onCancel({preventDefault(){prevented=true;}});assert.equal(prevented,true);}
  else{const element={getBoundingClientRect:()=>({left:10,right:100,top:10,bottom:100})};tree.props.onClick({target:element,currentTarget:element,clientX:action==='outside'?0:50,clientY:50});}
  assert.equal(closed,before+(action==='inside'?0:1));assert.equal(applied.length,1);v.stop();native.stop();}
 const detached=makeDialog();detached.render();detached.flush();const oldSubmit=nodes(detached.render()).find(n=>n.type==='form').props.onSubmit;detached.stop();oldSubmit({preventDefault(){}});assert.equal(applied.length,1);
 const {JobDiscovery}=require('../components/job-discovery.tsx');const updates=[];const ui=new View({type:JobDiscovery,props:{jobs:[base],savedJobs:[],savedIds:new Set(),showingSaved:false,loading:false,error:'',filters,options,onFilter(){},onFiltersChange:v=>updates.push(v)}});
 const chip=nodes(ui.render()).find(n=>n.type==='button'&&n.props['aria-label']?.includes('Ta bort filter Månadslön'));assert.ok(chip);chip.props.onClick();assert.equal(updates[0].salaryUnit,'');assert.equal(updates[0].salaryMin,'');button(ui,'Rensa').props.onClick();assert.ok(Object.values(updates[1]).every(v=>v===''));
 console.log('PASS F19 actual dialog/modal/discovery callbacks: local edits, atomic apply/reset, invalid pay, cancel/Escape/backdrop, inner clicks, double submit, detached callbacks and grouped chip removal. DOM/hooks simulated.');

 const Page=require('../app/swipe/page.tsx').default;feed=Array.from({length:45},(_,i)=>({...base,id:String(i).padStart(2,'0'),company_user_id:'company-'+i}));
 const page=new View(Page().props.children);const getProps=()=>nodes(page.render()).find(n=>n.type===JobDiscovery).props;getProps();page.flush();await settle();let p=getProps();assert.equal(p.jobs.length,20);assert.equal(p.resultCount,45);
 for(let i=0;i<20;i++){p=getProps();await p.onDecision(feed[i],'skip');await settle();}
 p=getProps();assert.equal(p.jobs[0]?.id,'20','Actual page must continue immediately after the first twenty decisions');assert.equal(p.jobs.length,20);assert.equal(p.resultCount,25);assert.equal(p.hasMore,true);
 failId='20';await p.onDecision(feed[20],'skip');await settle();p=getProps();assert.equal(p.jobs[0].id,'20','Failed choice restores original position');assert.equal(p.resultCount,25);
 p.onFiltersChange({...search.readSearchFilters(new URLSearchParams()),salaryUnit:'hour',salaryMin:'150',onlyKnown:'yes'});p=getProps();assert.equal(p.jobs.length,0);assert.equal(p.resultCount,0,'Full filtered result count uses the same salary rules');
 p.onFiltersChange(search.readSearchFilters(new URLSearchParams()));p=getProps();assert.equal(p.jobs[0].id,'20');assert.equal(p.resultCount,25);page.stop();
 console.log('PASS N18 actual swipe page: 45 jobs, twenty sequential choices, continuously filled next page, total count/more, failed choice restoration and atomic filter reset. Transport/hooks simulated.');
}finally{views.forEach(v=>v.stop());Module._load=originalLoad;delete globalThis.window;delete globalThis.document;delete globalThis.HTMLElement;}
