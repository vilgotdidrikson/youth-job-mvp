import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire,Module} from 'node:module';
import path from 'node:path';
import ts from 'typescript';
const require=createRequire(import.meta.url);
for(const ext of ['.ts','.tsx'])Module._extensions[ext]=(m,file)=>m._compile(ts.transpileModule(readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText,file);
Module._extensions['.css']=m=>{m.exports={__esModule:true,default:new Proxy({},{get:(_,key)=>String(key)})};};
const React=require('react'),original=Module._load;
const {createLatestRead}=require('../lib/latest-read.ts');
const {createClient}=require('@supabase/supabase-js');
const pending=[];const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b});return{resolve,reject,promise}};
const settle=()=>new Promise(r=>setImmediate(r));
let current,refresh,hookOverride=null,role='company',owner='company-a',jobOwner=owner;
const calls=[],requests=[];let client;
class View{
 constructor(fn,props){this.fn=fn;this.props=props;this.slots=[];this.effects=[];this.index=0;}
 // eslint-disable-next-line @typescript-eslint/no-this-alias -- The test dispatcher selects the mounted hook instance.
 render(){current=this;this.index=0;return this.fn(this.props)}
 flush(){for(const item of this.effects.filter(Boolean))if(item.pending){item.cleanup?.();item.cleanup=item.fn();item.pending=false}}
 stop(){for(const item of this.effects.filter(Boolean))item.cleanup?.()}
}
const hooks={...React,useState(initial){const v=current,i=v.index++;if(!(i in v.slots))v.slots[i]=typeof initial==='function'?initial():initial;return[v.slots[i],value=>{v.slots[i]=typeof value==='function'?value(v.slots[i]):value}]},useRef(initial){const v=current,i=v.index++;return v.slots[i]??={current:initial}},useEffect(fn,deps){const v=current,i=v.index++,old=v.effects[i];if(!old||deps.some((d,n)=>!Object.is(d,old.deps[n])))v.effects[i]={fn,deps,pending:true,cleanup:old?.cleanup}},useCallback(fn){current.index++;return fn}};
let feedMock=true;
Module._load=function(name,parent,...rest){
 if(name==='react')return hooks;
 if(name==='next/link')return{__esModule:true,default:'a'};
 if(name==='next/navigation')return{useRouter:()=>({replace:(...args)=>calls.push(args),push:(...args)=>calls.push(args)})};
 if(name==='@/lib/latest-read')return{createLatestRead:options=>createLatestRead({...options,timeoutMs:25})};
 if(name==='@/lib/visible-refresh')return{subscribeVisibleRefresh:fn=>{refresh=fn;return()=>{}}};
 if(name==='@/lib/chat')return{getMyConversations:async()=>[{id:'right',job_id:'job-b',company_user_id:'company-a',youth_user_id:'same-youth'},{id:'other-ad',job_id:'job-a',company_user_id:'company-a',youth_user_id:'same-youth'}]};
 if(name==='@/lib/feeds'&&feedMock)return{getCandidatesForJob:(jobId,options)=>{const p=deferred();pending.push({...p,jobId,options});return p.promise}};
 if(name==='@/lib/auth')return{getCurrentUser:async()=>owner?{id:owner}:null,getUserProfile:async()=>({role})};
 if(name==='@/lib/supabase')return{getSupabaseClient:()=>client};
 if(name==='@/hooks/use-company-candidates'&&hookOverride)return{useCompanyCandidates:()=>hookOverride};
 if(name==='@/lib/matching')return{reviewCandidate:async(...args)=>{calls.push(args);return null}};
 if(name==='@/lib/api-client')return{authenticatedHeaders:async()=>({Authorization:'Bearer fictional-test-only'})};
 if(name.startsWith('@/components/')&&!name.endsWith('company-job-candidates'))return new Proxy({},{get:(_,key)=>key==='__esModule'?true:key});
 if(name.startsWith('@/'))return original.call(this,path.resolve(name.slice(2)),parent,...rest);
 return original.call(this,name,parent,...rest);
};
const candidate=(job='job-b',youth='same-youth')=>({job:{id:job,company_user_id:'company-a',title:job},youthUserId:youth,profile:{full_name:'Fiktiv ungdom'},application:{status:'submitted'}});
try{
 const {useCompanyCandidates}=require('../hooks/use-company-candidates.ts');
 const view=new View(p=>useCompanyCandidates(p.user,p.job),{user:'company-a',job:'job-a'});
 assert.equal(view.render().state.status,'loading');view.flush();assert.equal(pending.length,1);assert.equal(pending[0].options.ownerId,'company-a');
 view.props.job='job-b';assert.equal(view.render().state.status,'loading');view.flush();assert.equal(pending[0].options.signal.aborted,true);
 pending[1].resolve([candidate()]);await settle();assert.equal(view.render().state.value.candidates[0].job.id,'job-b');assert.equal(view.render().state.value.conversations.length,1);
 pending[0].resolve([candidate('job-a')]);await settle();assert.equal(view.render().state.value.candidates[0].job.id,'job-b','late A cannot replace B');
 view.props.user='company-b';assert.equal(view.render().state.status,'loading','account switch masks cached content before effects');view.flush();pending[2].resolve([candidate()]);await settle();assert.equal(view.render().state.status,'error','foreign-owner payload rejected');
 view.props.user='company-a';view.render();view.flush();await new Promise(r=>setTimeout(r,35));assert.equal(view.render().state.status,'error','hung transport times out');pending.at(-1).resolve([candidate()]);await settle();assert.equal(view.render().state.status,'error');
 const retry=view.render().reload();pending.at(-1).resolve([]);await retry;assert.equal(view.render().state.value.candidates.length,0);
 const background=refresh();assert.equal(view.render().state.status,'loading','refresh removes old access while validating');pending.at(-1).reject(Error('revoked'));await background;assert.equal(view.render().state.status,'error');
 view.stop();
 hookOverride={state:{status:'ready',value:{candidates:[candidate()],conversations:[]}},reload:async()=>{}};
 const {CompanyJobCandidates}=require('../components/company-job-candidates.tsx');
 const props={userId:'company-a',jobs:[candidate('job-a').job,candidate().job,{id:'foreign',company_user_id:'company-b',title:'Hidden'}],verified:true,jobId:null,candidateId:null};
 const nodes=root=>!root||typeof root!=='object'?[]:[root,...(Array.isArray(root)?root:[root.props?.children]).flat(Infinity).flatMap(nodes)];
 const picker=CompanyJobCandidates(props);const links=nodes(picker).filter(n=>n.type==='a');assert.equal(links.filter(n=>n.props.href.includes('&job=')).length,2);assert.ok(!JSON.stringify(picker).includes('Hidden'));
 assert.notEqual(CompanyJobCandidates({...props,jobId:'job-a'}).key,CompanyJobCandidates({...props,jobId:'job-b'}).key,'ad changes remount the entire workspace');
 assert.equal(CompanyJobCandidates({...props,jobId:'foreign'}).type,'section');assert.equal(CompanyJobCandidates({...props,verified:false}).type,'section');
 // Actual detail callbacks retain job identity in navigation, CV transport and decisions.
 hookOverride={state:{status:'ready',value:{candidates:[candidate()],conversations:[]}},reload:async()=>{}};
 const wrapped=CompanyJobCandidates({...props,jobId:'job-b',candidateId:'same-youth'});const detail=new View(wrapped.type,wrapped.props);let tree=detail.render();detail.flush();
 const cvRequests=[];globalThis.fetch=async(url,options)=>{const p=deferred();cvRequests.push({url,options,...p});return p.promise};
 let button=nodes(tree).find(n=>n.type==='button'&&n.props.children==='Öppna CV');button.props.onClick();await settle();assert.deepEqual(JSON.parse(cvRequests[0].options.body),{jobId:'job-b',youthUserId:'same-youth'});
 const accept=nodes(tree).find(n=>n.type==='button'&&n.props.children==='Acceptera');await Promise.all([accept.props.onClick(),accept.props.onClick()]);await settle();assert.equal(calls.filter(args=>args[0]==='job-b'&&args[1]==='same-youth'&&args[2]==='interested').length,1,'double decision only writes once with this ad');
 detail.stop();cvRequests[0].resolve(Response.json({kind:'text',text:'Old content'}));await settle();assert.ok(!JSON.stringify(detail.render()).includes('Old content'),'late CV cannot open after leaving');
 // Real Supabase SDK: query filters, cancellation, ownership and submitted-only list.
 feedMock=false;delete require.cache[require.resolve('../lib/feeds.ts')];
 client=createClient('https://example.invalid','fictional-anon',{auth:{persistSession:false,autoRefreshToken:false},global:{fetch:async(url,options)=>{const u=new URL(url);requests.push({u,options});const table=u.pathname.split('/').at(-1);const data=table==='jobs'?[{id:'job-b',company_user_id:jobOwner,title:'B'}]:table==='swipe_actions'?[{youth_user_id:'same-youth'},{youth_user_id:'unsubmitted'}]:table==='company_interest_actions'?[]:table==='get_company_candidates'?[{user_id:'same-youth',full_name:'QA'},{user_id:'unsubmitted',full_name:'Draft'}]:table==='application_completions'?[{job_id:'job-b',youth_user_id:'same-youth',status:'submitted'}]:[];return Response.json(data)}}});
 const {getCandidatesForJob}=require('../lib/feeds.ts');const signal=new AbortController().signal;
 const result=await getCandidatesForJob('job-b',{includeReviewed:true,ownerId:'company-a',signal});assert.equal(result.length,1);assert.equal(result[0].youthUserId,'same-youth');
 for(const r of requests){if(r.u.pathname.endsWith('get_company_candidates'))assert.equal(JSON.parse(r.options.body).p_job_id,'job-b');else assert.equal(r.u.searchParams.get(r.u.pathname.endsWith('jobs')?'id':'job_id'),'eq.job-b')}
 const count=requests.length;owner=null;await assert.rejects(getCandidatesForJob('job-b'));owner='company-a';role='youth';await assert.rejects(getCandidatesForJob('job-b'));role='company';await assert.rejects(getCandidatesForJob('job-b',{ownerId:'different'}));assert.equal(requests.length,count);
 jobOwner='company-b';await assert.rejects(getCandidatesForJob('job-b'),/own jobs/);
 console.log('PASS ad-first picker, scoped hook, A/B/user-switch late responses, timeout/retry/revoked access, actual CV callback and SDK job/owner/submitted filters. HTTP transport is simulated; no live RLS/browser claim.');
}finally{Module._load=original}
