import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire, Module } from 'node:module';
import path from 'node:path';
import ts from 'typescript';
const require = createRequire(import.meta.url);
for (const ext of ['.ts', '.tsx']) Module._extensions[ext] = (m, file) => m._compile(ts.transpileModule(readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText, file);
Module._extensions['.css'] = m => { m.exports = { __esModule: true, default: new Proxy({}, { get: (_, name) => String(name) }) }; };
const { createLatestRead } = require('../lib/latest-read.ts');
const deferred = () => { let resolve, reject; const promise = new Promise((a,b) => {resolve=a;reject=b;}); return {promise,resolve,reject}; };
const settle = () => new Promise(resolve => setImmediate(resolve));
let updates=[],pending=[];
const reader=createLatestRead({read:args=>{const p=deferred();pending.push({...p,args});return p.promise;},update:s=>updates.push(s),errorMessage:'Läsfel',timeoutMs:15});
const first=reader.load('first'),second=reader.load('second');
pending[1].resolve('current');await second;pending[0].resolve('stale');await first;
assert.deepEqual(updates.at(-1),{status:'ready',value:'current'},'Old responses cannot replace the current result');
const hung=reader.load('hung');await hung;
assert.equal(updates.at(-1).status,'error','A hung transport must leave loading even if it ignores abort');
pending.at(-1).resolve('late');await settle();assert.equal(updates.at(-1).status,'error');
const retry=reader.load('retry');pending.at(-1).resolve('recovered');await retry;assert.equal(updates.at(-1).value,'recovered');
const stopped=reader.load('cancelled');reader.stop();const count=updates.length;pending.at(-1).resolve('ignored');await stopped;assert.equal(updates.length,count);

// Execute actual component callbacks and effect cleanup; transport is deterministic.
const realReact=require('react');let active;
class View {
 constructor(element){this.element=element;this.slots=[];this.effects=[];this.index=0;}
 render(){active=this;this.index=0;return this.element.type(this.element.props);}
 effectsNow(){for(const item of this.effects.filter(Boolean))if(item.pending){item.cleanup?.();item.cleanup=item.fn();item.pending=false;}}
 replay(){for(const item of this.effects.filter(Boolean)){item.cleanup?.();item.cleanup=item.fn();}}
 stop(){for(const item of this.effects.filter(Boolean))item.cleanup?.();}
}
const hooks={...realReact,
 useState(initial){const v=active,i=v.index++;if(!(i in v.slots))v.slots[i]=typeof initial==='function'?initial():initial;return [v.slots[i],value=>{v.slots[i]=typeof value==='function'?value(v.slots[i]):value;}];},
 useRef(initial){const v=active,i=v.index++;return v.slots[i]??={current:initial};},
 useEffect(fn,deps){const v=active,i=v.index++,old=v.effects[i];if(!old||deps.some((d,n)=>!Object.is(d,old.deps[n])))v.effects[i]={fn,deps,pending:true,cleanup:old?.cleanup};},
};
let sdkOverride=null;
let job='qa-job',user='qa-youth',statusMode='ok',completionStatus=null,refresh;
const requests=[],writes=[],navigations=[];
globalThis.window={dispatchEvent(){}};
const client={rpc(name,args){const p=deferred();const request={name,args,...p};if(name==='save_my_application_disclosure'){writes.push(request);return p.promise;}return {abortSignal(signal){request.signal=signal;requests.push(request);return p.promise;}};},from(table){const filters={};const chain={select(){return chain;},eq(k,v){filters[k]=v;return chain;},abortSignal(signal){assert.ok(signal);return chain;},async maybeSingle(){assert.equal(table,'application_completions');assert.equal(filters.job_id,job);assert.equal(filters.youth_user_id,user);return {data:completionStatus?{status:completionStatus}:null,error:statusMode==='error'?{message:'Denied'}:null};}};return chain;}};
const original=Module._load;
Module._load=function(name,parent,...rest){
 if(name==='react')return hooks;
 if(name==='next/navigation')return {useSearchParams:()=>({get:()=>job}),useRouter:()=>({push:url=>navigations.push(url)})};
 if(name==='next/link')return {__esModule:true,default:'a'};
 if(name==='@/hooks/use-require-auth')return {useRequireAuth:()=>({user:{id:user},profile:{role:'youth'},status:'ready'})};
 if(name==='@/lib/supabase')return {getSupabaseClient:()=>sdkOverride??client};
 if(name==='@/lib/visible-refresh')return {subscribeVisibleRefresh:fn=>{refresh=fn;return()=>{};}};
 if(name==='@/lib/application-completions')return {prepareApplication:async id=>{writes.push({name:'prepare',args:{id}});}};
 if(name==='@/lib/application-evidence')return {applicationSourceInput:()=>''};
 if(name==='@/components/job-requirements-insight')return {JobRequirementsInsight:()=>null};
 if(name.startsWith('@/'))return original.call(this,path.resolve(name.slice(2)),parent,...rest);
 return original.call(this,name,parent,...rest);
};
try {
 const {CandidateRecruitmentProfile}=require('../components/candidate-recruitment-profile.tsx');
 const Page=require('../app/applications/preview/page.tsx').default;
 const nodes=root=>!root||typeof root!=='object'?[]:[root,...(Array.isArray(root)?root:[root.props?.children]).flat(Infinity).flatMap(n=>nodes(n))];
 const packet={job_id:job,youth_user_id:user,cv:{text:'QA',documents:[]}};
 let wrapper=CandidateRecruitmentProfile({jobId:job,youthId:user});
 assert.notEqual(wrapper.key,CandidateRecruitmentProfile({jobId:job,youthId:'other'}).key);
 assert.notEqual(wrapper.key,CandidateRecruitmentProfile({jobId:'other',youthId:user}).key);
 let view=new View(wrapper);view.render();view.effectsNow();requests.at(-1).resolve({data:packet});await settle();
 assert.equal(view.render().props.packet,packet);
 const background=refresh();assert.equal(view.render().type.name,'DisclosureLoadState','Refreshing discards old content while checking current access');
 requests.at(-1).resolve({error:{message:'Denied'}});await background;
 assert.ok(view.render().props.error);view.render().props.retry();requests.at(-1).resolve({data:packet});await settle();assert.equal(view.render().props.packet,packet);
 view.replay();const oldRequest=requests.at(-1);view.stop();oldRequest.resolve({data:packet});await settle();
 // Wrong-scope RPC data must not be displayed even during a rolling deployment.
 view=new View(wrapper);view.render();view.effectsNow();requests.at(-1).resolve({data:{...packet,job_id:'other'}});await settle();assert.ok(view.render().props.error);view.stop();
 const previewWrapper=()=>{const suspense=Page();return suspense.props.children.type();};
 wrapper=previewWrapper();user='other';assert.notEqual(wrapper.key,previewWrapper().key);user='qa-youth';job='other-job';assert.notEqual(wrapper.key,previewWrapper().key);job='qa-job';
 const preview={packet,options:[{key:'skill:0',label:'Kunskap',text:'Servering'},{key:'licences:0',label:'Behörighet',text:'HLR'}],selected_keys:[],source_token:'review-token',is_saved:false,matching_input:{}};
 view=new View(previewWrapper());view.render();view.effectsNow();await settle();requests.at(-1).resolve({data:preview});await settle();
 const staleSend=nodes(view.render()).find(n=>n.type==='button'&&n.props.children==='Dela underlaget och skicka ansökan');
 const input=nodes(view.render()).find(n=>n.type==='input');input.props.onChange({target:{checked:true}});await settle();
 staleSend.props.onClick();assert.equal(writes.length,0,'An old event callback must not send stale selections');
 assert.deepEqual(requests.at(-1).args.p_selection,['skill:0']);assert.ok(nodes(view.render()).find(n=>n.type==='button'&&n.props.children==='Dela underlaget och skicka ansökan').props.disabled,'The old preview cannot be sent during a changed selection');
 requests.at(-1).resolve({error:{message:'Offline'}});await settle();
 assert.ok(nodes(view.render()).find(n=>n.type==='button'&&n.props.children==='Dela underlaget och skicka ansökan').props.disabled,'Failed selection must keep submission disabled');
 let retryNode=nodes(view.render()).find(n=>n.type?.name==='DisclosureLoadState');retryNode.props.retry();await settle();
 assert.deepEqual(requests.at(-1).args.p_selection,['skill:0'],'Retry must preserve the failed desired selection');
 requests.at(-1).resolve({data:{...preview,selected_keys:['skill:0']}});await settle();
 let send=nodes(view.render()).find(n=>n.type==='button'&&n.props.children==='Dela underlaget och skicka ansökan');send.props.onClick();send.props.onClick();
 assert.equal(writes.length,1,'Two rapid clicks must perform one save');assert.deepEqual(writes[0].args.p_selection,['skill:0']);assert.equal(writes[0].args.p_source_token,'review-token');
 view.stop();send.props.onClick();assert.equal(writes.length,1,'A detached old handler cannot start another save');writes[0].resolve({error:null});await settle();assert.equal(writes.length,1,'Unmount must not start a later submission');assert.deepEqual(navigations,[]);
 // Strict Mode effect replay must create a usable reader rather than revive a stopped one.
 view=new View(previewWrapper());view.render();view.effectsNow();view.replay();await settle();requests.at(-1).resolve({data:preview});await settle();assert.ok(nodes(view.render()).some(n=>n.type==='button'));view.stop();
 statusMode='error';view=new View(previewWrapper());view.render();view.effectsNow();await settle();assert.ok(nodes(view.render()).some(n=>n.type?.name==='DisclosureLoadState'&&n.props.error));view.stop();statusMode='ok';
 completionStatus='withdrawn';const before=requests.length;view=new View(previewWrapper());view.render();view.effectsNow();await settle();assert.ok(nodes(view.render()).some(n=>n.props?.children==='Ansökan är återkallad'));assert.equal(requests.length,before,'Withdrawn applications never request new sharing data');view.stop();
 completionStatus=null;
 const deliver=async(saved=false)=>{const v=new View(previewWrapper());v.render();v.effectsNow();await settle();requests.at(-1).resolve({data:{...preview,is_saved:saved}});await settle();return v;};
 view=await deliver();let writeCount=writes.length;
 send=nodes(view.render()).find(n=>n.type==='button'&&n.props.children==='Dela underlaget och skicka ansökan');send.props.onClick();writes.at(-1).resolve({error:null});await settle();
 assert.equal(writes.length,writeCount+2,'Successful initial share saves then submits');assert.equal(writes.at(-1).name,'prepare');assert.equal(navigations.at(-1),'/applications?job=qa-job');view.stop();
 completionStatus='submitted';view=await deliver();writeCount=writes.length;
 nodes(view.render()).find(n=>n.type==='button'&&n.props.children==='Spara uppdaterad delning').props.onClick();writes.at(-1).resolve({error:null});await settle();assert.equal(writes.length,writeCount+1,'Updating an existing submitted application never submits it again');view.stop();
 view=await deliver(true);writeCount=writes.length;nodes(view.render()).find(n=>n.type==='button'&&n.props.children==='Till mina ansökningar').props.onClick();await settle();assert.equal(writes.length,writeCount,'Returning from saved sharing does not write');view.stop();
 completionStatus=null;
 view=await deliver();const inputs=nodes(view.render()).filter(n=>n.type==='input');
 inputs[0].props.onChange({target:{checked:true}});inputs[1].props.onChange({target:{checked:true}});await settle();assert.deepEqual(requests.at(-1).args.p_selection,['skill:0','licences:0'],'Rapid choices combine from current intent, not stale render props');view.stop();
 // Verify the actual components serialize their scoped reads through the installed SDK.
 const {createClient}=require('@supabase/supabase-js');const transports=[];
 sdkOverride=createClient('https://qa.invalid','synthetic-qa-key',{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},global:{fetch:async(input,init)=>{
  const url=new URL(input);transports.push(url);assert.ok(init.signal);
  if(url.pathname.endsWith('/application_completions')){assert.equal(url.searchParams.get('select'),'status');assert.equal(url.searchParams.get('job_id'),'eq.qa-job');assert.equal(url.searchParams.get('youth_user_id'),'eq.qa-youth');return Response.json([{status:'submitted'}]);}
  const body=JSON.parse(init.body);assert.equal(body.p_job_id,'qa-job');
  if(url.pathname.endsWith('/get_application_disclosure')){assert.equal(body.p_youth_user_id,'qa-youth');return Response.json(packet);}
  assert.ok(url.pathname.endsWith('/get_my_application_disclosure_preview'));return Response.json(preview);
 }}});
 view=new View(previewWrapper());view.render();view.effectsNow();for(let i=0;i<8;i++)await settle();assert.ok(nodes(view.render()).some(n=>n.type==='button'&&n.props.children==='Spara uppdaterad delning'));view.stop();
 view=new View(CandidateRecruitmentProfile({jobId:job,youthId:user}));view.render();view.effectsNow();for(let i=0;i<8;i++)await settle();assert.equal(view.render().props.packet.job_id,'qa-job');view.stop();assert.equal(transports.length,3);
 sdkOverride=null;
 console.log('PASS: latest-only reads, timeout/late results, cancellation, candidate/job/account keys, refresh revocation, wrong-scope payload, failed selection/retry, no stale send, synchronous write lock, unmount before submission, Strict Mode replay, status failure, withdrawal, successful save/submit, rapid selections and real SDK serialization.');
}finally{Module._load=original;}
