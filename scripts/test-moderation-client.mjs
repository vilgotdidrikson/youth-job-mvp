import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire,Module} from 'node:module';
import path from 'node:path';
import ts from 'typescript';
const require=createRequire(import.meta.url);
for(const ext of ['.ts','.tsx'])Module._extensions[ext]=(m,file)=>m._compile(ts.transpileModule(readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText,file);
Module._extensions['.css']=m=>{m.exports={__esModule:true,default:new Proxy({},{get:(_,key)=>String(key)})};};
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return{promise,resolve,reject};};
const settle=()=>new Promise(r=>setImmediate(r));
const {createLatestRead}=require('../lib/latest-read.ts');
const realReact=require('react');let active;function activate(view){active=view;}
class View{constructor(element){this.element=element;this.slots=[];this.effects=[];this.index=0;this.updates=0;}render(){activate(this);this.index=0;return this.element.type(this.element.props);}effectsNow(){for(const e of this.effects.filter(Boolean))if(e.pending){e.cleanup?.();e.cleanup=e.fn();e.pending=false;}}stop(){for(const e of this.effects.filter(Boolean))e.cleanup?.();}}
const hooks={...realReact,useState(initial){const v=active,i=v.index++;if(!(i in v.slots))v.slots[i]=typeof initial==='function'?initial():initial;return[v.slots[i],value=>{v.updates++;v.slots[i]=typeof value==='function'?value(v.slots[i]):value;}];},useRef(initial){const v=active,i=v.index++;return v.slots[i]??={current:initial};},useEffect(fn,deps){const v=active,i=v.index++,old=v.effects[i];if(!old||deps.some((d,n)=>!Object.is(d,old.deps[n])))v.effects[i]={fn,deps,pending:true,cleanup:old?.cleanup};}};
const nodes=root=>!root||typeof root!=='object'?[]:[root,...(Array.isArray(root)?root:[root.props?.children]).flat(Infinity).flatMap(nodes)];
const text=root=>root==null||typeof root==='boolean'?'':typeof root!=='object'?String(root):(Array.isArray(root)?root:[root.props?.children]).flat(Infinity).map(text).join('');
const button=(view,label)=>nodes(view.render()).find(n=>n.type==='button'&&text(n).includes(label));
let userId='qa-admin',adminCheck=true,readItems=[],readError=false,requests=[],writes=[],reportRequests=[],submitError=null;
let currentAccess={status:'ready',adminReady:true,isAdmin:true,user:{id:userId,email:'qa@example.invalid'}};
const client={rpc(name,args){const d=deferred();requests.push({name,args,...d});return{abortSignal(signal){requests.at(-1).signal=signal;return d.promise;}};}};
const original=Module._load;
Module._load=function(name,parent,...rest){
 if(name==='react')return hooks;
 if(name==='@/lib/supabase')return{getSupabaseClient:()=>client};
 if(name==='@/hooks/use-require-auth')return{useRequireAuth:()=>({status:'ready',user:{id:userId}})};
 if(name==='@/hooks/use-admin-access')return{useAdminAccess:()=>currentAccess};
 if(name==='@/lib/latest-read')return{createLatestRead:options=>createLatestRead({...options,timeoutMs:20})};
 if(name==='@/lib/reports')return{
  getModerationCasework:async()=>{if(readError)throw Error('Denied');return readItems;},
  reviewModerationCase:(report,status,note)=>{const d=deferred();writes.push({report,status,note,...d});return d.promise;},
  submitReport:()=>{const d=deferred();reportRequests.push(d);if(submitError)d.reject(submitError);return d.promise;},
 };
 if(['@/components/admin/admin-shell','@/components/auth-gate-message','@/components/video-player','./modal-dialog'].includes(name))return{AdminShell:()=>null,AuthGateMessage:()=>null,VideoPlayer:()=>null,ModalDialog:()=>null};
 if(name.startsWith('@/'))return original.call(this,path.resolve(name.slice(2)),parent,...rest);
 return original.call(this,name,parent,...rest);
};
try{
 const {useAdminAccess: runAccessHook}=require('../hooks/use-admin-access.ts');
 let authView=new View({type:()=>runAccessHook(),props:{}});assert.equal(authView.render().isAdmin,false);authView.effectsNow();requests.at(-1).resolve({data:adminCheck,error:null});await settle();assert.equal(authView.render().isAdmin,true);
 userId='qa-other';assert.equal(authView.render().adminReady,false,'Account change immediately removes previous admin grant');assert.equal(authView.render().isAdmin,false);authView.effectsNow();requests.at(-1).resolve({data:false,error:null});await settle();assert.equal(authView.render().isAdmin,false);authView.stop();
 authView=new View({type:()=>runAccessHook(),props:{}});authView.render();authView.effectsNow();const detached=requests.at(-1);authView.stop();detached.resolve({data:true,error:null});await settle();assert.equal(authView.render().isAdmin,false);assert.equal(detached.signal.aborted,true);
 const {ReportDialog}=require('../components/report-dialog.tsx');let wrapper=ReportDialog({targetType:'job',targetId:'qa-job'});
 assert.notEqual(wrapper.key,ReportDialog({targetType:'job',targetId:'other'}).key);
 let dialog=new View(wrapper);dialog.render();dialog.effectsNow();button(dialog,'Anmäl').props.onClick();let form=nodes(dialog.render()).find(n=>n.type==='form');const event={preventDefault(){}};
 const first=form.props.onSubmit(event),second=form.props.onSubmit(event);assert.equal(reportRequests.length,1,'Rapid submissions share one server write');assert.equal(nodes(dialog.render()).some(n=>n.props?.busy),true);reportRequests[0].resolve('qa-report');await Promise.all([first,second]);assert.match(text(dialog.render()),/Anmälan är skickad/);dialog.stop();await form.props.onSubmit(event);assert.equal(reportRequests.length,1,'Detached forms cannot start writes');
 const Page=require('../app/admin/reports/page.tsx').default;
 wrapper=Page();const firstKey=wrapper.key;currentAccess={...currentAccess,user:{id:'qa-admin-b'}};assert.notEqual(Page().key,firstKey);currentAccess={...currentAccess,isAdmin:false};assert.match(text(Page()),/Ingen administratörsåtkomst/);currentAccess={...currentAccess,isAdmin:true};
 const caseRow={id:'qa-case',status:'open',target_type:'conversation',target_summary:'QA conversation',reason:'harassment',created_at:'2026-10-26T12:00:00Z',details:'QA report',target_snapshot:{messages:[]},reviewed_at:null,resolution_note:null};readItems=[caseRow];
 let view=new View(wrapper);view.render();view.effectsNow();await settle();button(view,'Markera åtgärdad').props.onClick();assert.equal(writes.length,0,'Choosing a decision does not save it');button(view,'Avbryt').props.onClick();assert.equal(writes.length,0,'Cancel never saves a decision');
 button(view,'Markera åtgärdad').props.onClick();nodes(view.render()).find(n=>n.type==='textarea').props.onChange({target:{value:'QA decision note'}});form=nodes(view.render()).find(n=>n.type==='form');form.props.onSubmit(event);form.props.onSubmit(event);assert.equal(writes.length,1);assert.equal(writes[0].report.status,'open');assert.equal(writes[0].note,'QA decision note');
 readItems=[{...caseRow,status:'resolved',resolution_note:'QA decision note',reviewed_by_user_id:'qa-admin',reviewed_at:'2026-10-26T12:30:00Z'}];writes[0].resolve();await settle();assert.match(text(view.render()),/Beslutet är sparat/);nodes(view.render()).find(n=>n.type==='select').props.onChange({target:{value:'closed'}});assert.match(text(view.render()),/QA decision note/);
 // A server conflict refreshes the row but keeps the entered note and blocks stale retry.
 view.stop();readItems=[caseRow];view=new View(wrapper);view.render();view.effectsNow();await settle();button(view,'Markera åtgärdad').props.onClick();form=nodes(view.render()).find(n=>n.type==='form');form.props.onSubmit(event);readItems=[{...caseRow,status:'dismissed'}];writes.at(-1).reject(Error('Ärendet har ändrats'));await settle();assert.equal(button(view,'Spara beslut').props.disabled,true);const count=writes.length;nodes(view.render()).find(n=>n.type==='form').props.onSubmit(event);assert.equal(writes.length,count,'A stale decision cannot be sent even with an old submit control');view.stop();
 console.log('PASS: account-scoped admin gate, unmount/late data, report target keys and double-submit guard, explicit cancel, single decision write, saved audit note, conflict refresh and stale retry protection.');
}finally{Module._load=original;}
// Test the real service against the installed SDK's HTTP transport, not a query mock.
let httpStatus=200,httpBody='qa-report',calls=[];
const {createClient}=require('@supabase/supabase-js');
const sdk=createClient('https://example.test','qa-anon',{auth:{persistSession:false,autoRefreshToken:false},global:{fetch:async(url,options)=>{calls.push({url:String(url),body:JSON.parse(options.body),signal:options.signal});return new Response(JSON.stringify(httpBody),{status:httpStatus,headers:{'content-type':'application/json'}});}}});
Module._load=function(name,parent,...rest){if(name==='@/lib/supabase')return{getSupabaseClient:()=>sdk};if(name.startsWith('@/'))return original.call(this,path.resolve(name.slice(2)),parent,...rest);return original.call(this,name,parent,...rest);};
try{
 const {submitReport,reviewModerationCase,getModerationCasework}=require('../lib/reports.ts');await submitReport({targetType:'job',targetId:'qa-job',reason:'privacy',details:'  QA  '});assert.match(calls.at(-1).url,/rpc\/submit_moderation_report$/);assert.equal(calls.at(-1).body.p_details,'QA');assert.ok(calls.at(-1).signal);
 httpBody=null;await reviewModerationCase({id:'qa-report',status:'reviewing'},'resolved','  QA note  ');assert.match(calls.at(-1).url,/review_moderation_report_checked$/);assert.equal(calls.at(-1).body.p_expected_status,'reviewing');assert.equal(calls.at(-1).body.p_resolution_note,'QA note');
 httpBody=[];assert.deepEqual(await getModerationCasework(new AbortController().signal),[]);httpStatus=409;httpBody={code:'PT409',message:'stale'};await assert.rejects(()=>reviewModerationCase({id:'qa-report',status:'open'},'resolved',''),/Ärendet har ändrats/);
 console.log('PASS: real SDK moderation endpoints, trimmed input, expected status, abort signal, empty list and conflict errors.');
}finally{Module._load=original;}
