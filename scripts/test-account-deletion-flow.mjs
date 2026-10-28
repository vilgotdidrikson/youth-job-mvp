import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire,Module} from 'node:module';
import path from 'node:path';
import ts from 'typescript';
const require=createRequire(import.meta.url),originalLoad=Module._load;
for(const ext of ['.ts','.tsx'])Module._extensions[ext]=(m,f)=>m._compile(ts.transpileModule(readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText,f);
const envNames=['NEXT_PUBLIC_SUPABASE_URL','NEXT_PUBLIC_SUPABASE_ANON_KEY','SUPABASE_SERVICE_ROLE_KEY'];
const env=Object.fromEntries(envNames.map(k=>[k,process.env[k]]));
process.env.NEXT_PUBLIC_SUPABASE_URL='https://qa.supabase.co';process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY='qa-anon';process.env.SUPABASE_SERVICE_ROLE_KEY='qa-service';
let actor='A',userError=null,passwordError=null,verifiedId='A',adminMember=false,adminError=null,deletes=[],passwordChecks=[],clients=[],storageReads=0;
const admin={from:table=>({select:()=>({eq:()=>({maybeSingle:async()=>({data:table==='admin_users'?(adminMember?{user_id:actor}:null):{role:'youth'},error:adminError})}),or:async()=>({data:[],error:null})}),insert:async()=>({error:null})}),storage:{from:()=>({list:async()=>{storageReads++;return{data:[],error:null};}})},auth:{admin:{deleteUser:async id=>{deletes.push(id);return{error:null};}}}};
Module._load=function(name,parent,...args){if(name==='@supabase/supabase-js')return{createClient:(url,key,options)=>{clients.push({key,options});return key==='qa-service'?admin:{auth:{getUser:async()=>({data:{user:actor?{id:actor,email:'qa@example.invalid'}:null},error:userError}),signInWithPassword:async value=>{passwordChecks.push(value);return{data:{user:verifiedId?{id:verifiedId}:null},error:passwordError};}}};}};return originalLoad.call(this,name,parent,...args);};
const {DELETE}=require('../app/api/account/route.ts');
const request=body=>new Request('https://app.example.invalid/api/account',{method:'DELETE',headers:{Authorization:'Bearer qa-token','Content-Type':'application/json'},body:JSON.stringify(body)});
const reset=()=>{actor='A';userError=null;passwordError=null;verifiedId='A';adminMember=false;adminError=null;deletes=[];passwordChecks=[];clients=[];storageReads=0;};
try {
 reset();actor='B';verifiedId='B';assert.equal((await DELETE(request({password:'shared-qa-password',expectedUserId:'A'}))).status,409);assert.equal(passwordChecks.length,0);assert.equal(storageReads,0);assert.equal(deletes.length,0);assert.equal(clients.some(c=>c.key==='qa-service'),false,'Account mismatch is rejected before privileged access');
 for(const body of [null,[],{password:'qa'},{password:{nested:'qa'},expectedUserId:'A'},{password:'x'.repeat(1025),expectedUserId:'A'}]){reset();assert.equal((await DELETE(request(body))).status,400);assert.equal(passwordChecks.length,0);assert.equal(deletes.length,0);}
 reset();userError={message:'offline'};assert.equal((await DELETE(request({password:'qa',expectedUserId:'A'}))).status,401);assert.equal(passwordChecks.length,0);
 for(const [error,status] of [[{status:400},403],[{status:429},429],[{status:503},502],[{name:'Network'},502]]){reset();passwordError=error;assert.equal((await DELETE(request({password:'qa',expectedUserId:'A'}))).status,status);assert.equal(storageReads,0);assert.equal(deletes.length,0);}
 reset();verifiedId='B';assert.equal((await DELETE(request({password:'qa',expectedUserId:'A'}))).status,403);assert.equal(deletes.length,0);
 reset();adminMember=true;assert.equal((await DELETE(request({password:'qa',expectedUserId:'A'}))).status,409);assert.equal(storageReads,0);
 reset();assert.equal((await DELETE(request({password:'qa',expectedUserId:'A'}))).status,204);assert.deepEqual(deletes,['A']);assert.equal(storageReads,3);assert.equal(passwordChecks.length,1);assert.equal(clients[1].options.global,undefined,'Password verification uses a separate client');assert.ok(clients.every(c=>c.options.auth.persistSession===false&&c.options.auth.autoRefreshToken===false));
}finally{Module._load=originalLoad;for(const k of envNames)if(env[k]===undefined)delete process.env[k];else process.env[k]=env[k];}
// Actual deletion client with controlled Auth storage and HTTP.
const originals={fetch:globalThis.fetch,formData:globalThis.FormData,setTimeout:globalThis.setTimeout,clearTimeout:globalThis.clearTimeout};
let session={user:{id:'A'},access_token:'qa-token-A'},sessionError=null,httpStatus=204,httpFailure=false,httpCalls=[];
Module._load=function(name,parent,...args){if(name==='./supabase'&&parent.filename.endsWith('account-deletion.ts'))return{getSupabaseClient:()=>({auth:{getSession:async()=>({data:{session},error:sessionError})}})};return originalLoad.call(this,name,parent,...args);};
const {deleteOwnAccount,AccountDeletionError}=require('../lib/account-deletion.ts');
globalThis.fetch=async(url,options)=>{httpCalls.push({url,options});if(httpFailure)throw Error('network');return new Response(httpStatus===204?null:JSON.stringify({error:'QA response'}),{status:httpStatus,headers:{'Content-Type':'application/json'}});};
try {
 const signal=new AbortController().signal;
 await deleteOwnAccount('A','qa-password',signal);assert.deepEqual(JSON.parse(httpCalls[0].options.body),{password:'qa-password',expectedUserId:'A'});assert.equal(httpCalls[0].options.headers.Authorization,'Bearer qa-token-A');
 session={user:{id:'B'},access_token:'qa-token-B'};await assert.rejects(deleteOwnAccount('A','qa-password',signal),/har ändrats/);assert.equal(httpCalls.length,1);
 session={user:{id:'A'},access_token:'qa-token-A'};for(const status of [403,502,200]){httpStatus=status;await assert.rejects(deleteOwnAccount('A','qa-password',signal),e=>e instanceof AccountDeletionError&&e.uncertain===(status>=500||status<400));}
 httpFailure=true;await assert.rejects(deleteOwnAccount('A','qa-password',signal),e=>e.uncertain);httpFailure=false;
 const aborted=new AbortController();aborted.abort();const before=httpCalls.length;await assert.rejects(deleteOwnAccount('A','qa-password',aborted.signal));assert.equal(httpCalls.length,before);
}finally{Module._load=originalLoad;globalThis.fetch=originals.fetch;}
// Actual component callbacks. Native dialog/focus mechanics are not simulated.
const react=require('react'),deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return{promise,resolve,reject};};
let view,reply,calls=[],timers=new Map(),timerId=0;
const nodes=n=>!n||typeof n!=='object'?[]:[n,...(Array.isArray(n)?n:[n.props?.children]).flat(Infinity).flatMap(nodes)];
const text=n=>n==null||typeof n==='boolean'?'':typeof n!=='object'?String(n):(Array.isArray(n)?n:[n.props?.children]).flat(Infinity).map(text).join('');
const hooks={...react,useState(initial){const v=view,i=v.index++;if(!(i in v.slots))v.slots[i]=typeof initial==='function'?initial():initial;return[v.slots[i],x=>{v.slots[i]=typeof x==='function'?x(v.slots[i]):x;v.updates++;}];},useRef(initial){const i=view.index++;return view.slots[i]??={current:initial};},useEffect(fn){const i=view.index++;view.effects[i]??={fn};}};
Module._load=function(name,parent,...args){if(name==='react')return hooks;if(name.endsWith('.module.css'))return{__esModule:true,default:new Proxy({},{get:(_,key)=>String(key)})};if(name==='@/lib/account-deletion')return{AccountDeletionError,deleteOwnAccount:(...args)=>{calls.push(args);return reply.promise;}};if(name==='@/components/modal-dialog')return{ModalDialog:'dialog'};if(name==='@/components/password-input')return{PasswordInput:'password-input'};if(name.startsWith('@/'))return originalLoad.call(this,path.resolve(name.slice(2)),parent,...args);return originalLoad.call(this,name,parent,...args);};
globalThis.FormData=class{constructor(form){this.values=form;}get(key){return this.values[key];}};
globalThis.setTimeout=(fn,ms)=>{const id=++timerId;timers.set(id,{fn,ms});return id;};globalThis.clearTimeout=id=>timers.delete(id);
const Wrapper=require('../components/delete-account-control.tsx').DeleteAccountControl;assert.notEqual(Wrapper({userId:'A',role:'youth'}).key,Wrapper({userId:'B',role:'youth'}).key);const Control=Wrapper({userId:'A',role:'youth'}).type;
const create=()=>{reply=deferred();calls=[];timers.clear();view={slots:[],effects:[],index:0,updates:0,render(){this.index=0;return Control({userId:'A',role:'youth'});},stop(){for(const e of this.effects.filter(Boolean))e.cleanup?.();}};view.render();for(const e of view.effects.filter(Boolean))e.cleanup=e.fn();nodes(view.render()).find(n=>n.type==='button').props.onClick();};
const submit=()=>nodes(view.render()).find(n=>n.type==='form').props.onSubmit,event={preventDefault(){},currentTarget:{password:'qa-password',confirmDeletion:'yes'}};
const settle=async()=>{for(let i=0;i<15;i++)await Promise.resolve();};
try{
 create();await submit()({...event,currentTarget:{password:'qa-password'}});assert.equal(calls.length,0);assert.match(text(view.render()),/bekräfta/);view.stop();
 create();const send=submit(),one=send(event),two=send(event);assert.equal(calls.length,1);assert.equal(calls[0][0],'A');nodes(view.render()).find(n=>n.type==='dialog').props.onClose();assert.ok(nodes(view.render()).some(n=>n.type==='form'),'Busy dialog cannot be dismissed through stale callbacks');reply.resolve();await Promise.all([one,two]);assert.match(text(view.render()),/Raderingen är bekräftad/);assert.equal(nodes(view.render()).some(n=>n.props?.name==='password'),false);await send(event);assert.equal(calls.length,1,'No repeat deletion after success');view.stop();
 create();const failure=submit()(event);reply.reject(new AccountDeletionError('Lösenordet stämmer inte.'));await failure;assert.equal(nodes(view.render()).find(n=>n.props?.name==='password').props.value,'');assert.equal(nodes(view.render()).find(n=>n.props?.name==='confirmDeletion').props.checked,false);view.stop();
 create();const timeout=submit()(event);for(const timer of [...timers.values()])if(timer.ms===30000)timer.fn();await timeout;assert.match(text(view.render()),/kunde inte bekräftas/);assert.ok(nodes(view.render()).some(n=>n.type==='a'&&n.props.href==='/login'));reply.resolve();await settle();assert.doesNotMatch(text(view.render()),/Raderingen är bekräftad/);view.stop();assert.equal(timers.size,0);
 create();const detached=submit()(event);view.stop();const before=view.updates;reply.resolve();await detached;assert.equal(view.updates,before);assert.equal(calls[0][2].aborted,true);
 console.log('PASS real DELETE handler, deletion client and dialog callbacks: owner mismatch before privileged access, input/reauth errors, admin protection, exact success, checked token snapshot, double submission, explicit confirmation, password clearing, unknown outcome, late response and unmount. Auth/HTTP simulated.');
}finally{view?.stop();Module._load=originalLoad;globalThis.fetch=originals.fetch;globalThis.FormData=originals.formData;globalThis.setTimeout=originals.setTimeout;globalThis.clearTimeout=originals.clearTimeout;}
