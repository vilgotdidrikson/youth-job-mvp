import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire,Module} from 'node:module';
import path from 'node:path';
import ts from 'typescript';
const require=createRequire(import.meta.url),original=Module._load;
for(const ext of ['.ts','.tsx'])Module._extensions[ext]=(m,file)=>m._compile(ts.transpileModule(readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText,file);
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return{promise,resolve,reject};};
const settle=async()=>{for(let i=0;i<12;i++)await Promise.resolve();};
let userReply={data:{user:{id:'A',email:'qa@example.invalid'}},error:null},resetReply={error:null},verification,sharedWrites=0,isolatedWrites=0,resetArgs,clientOptions;
const originalWindow=globalThis.window;globalThis.window={location:{origin:'https://app.example.invalid'}};
const shared={auth:{getUser:async()=>userReply,signOut:async()=>{sharedWrites++;return{error:null};},signInWithPassword:async()=>{sharedWrites++;},updateUser:async()=>{sharedWrites++;return{error:null};},resetPasswordForEmail:async(...args)=>{resetArgs=args;return resetReply;}}};
const isolated={auth:{signInWithPassword:()=>verification.promise,updateUser:async()=>{isolatedWrites++;return{error:null};}}};
Module._load=function(name,parent,...rest){if(name==='@/lib/supabase')return{getSupabaseClient:()=>shared};if(name==='@supabase/supabase-js')return{createClient:(_url,_key,options)=>{clientOptions=options;return isolated;}};if(name.startsWith('@/'))return original.call(this,path.resolve(name.slice(2)),parent,...rest);return original.call(this,name,parent,...rest);};
try{
 const auth=require('../lib/auth.ts');
 userReply={data:{user:null},error:{status:503,message:'Temporary outage'}};await assert.rejects(auth.getCurrentUser(),/Kunde inte nå servern/);assert.equal(sharedWrites,0,'Server failure must not sign out the shared client');
 userReply={data:{user:null},error:{status:401,message:'Invalid JWT'}};assert.equal(await auth.getCurrentUser(),null);assert.equal(sharedWrites,0,'Late invalid-user response must not clear a newer account');
 await auth.requestPasswordReset('  QA@EXAMPLE.INVALID ');assert.equal(resetArgs[0],'qa@example.invalid');assert.equal(resetArgs[1].redirectTo,'https://app.example.invalid/reset-password');resetReply={error:{code:'over_email_send_rate_limit'}};await assert.rejects(auth.requestPasswordReset('qa@example.invalid'),/För många försök/);
 await assert.rejects(auth.updatePassword('short'),/8 tecken/);assert.equal(sharedWrites,0);
 userReply={data:{user:{id:'A',email:'qa@example.invalid'}},error:null};verification=deferred();const changing=auth.changePassword('test-only-current','test-only-new');await settle();assert.equal(clientOptions.auth.persistSession,false);userReply={data:{user:{id:'B',email:'other@example.invalid'}},error:null};verification.resolve({data:{user:{id:'A'}},error:null});await changing;assert.equal(sharedWrites,0);assert.equal(isolatedWrites,1,'Password mutation stays in the isolated reauthentication session');
 verification=deferred();userReply={data:{user:{id:'A',email:'qa@example.invalid'}},error:null};const denied=auth.changePassword('wrong','test-only-new');verification.resolve({data:{user:null},error:{status:400}});await assert.rejects(denied,/nuvarande/);assert.equal(isolatedWrites,1);
 console.log('PASS auth service: transient server failure, stale identity, reset normalization/rate limit, minimum password and isolated reauthentication. Transport simulated.');
}finally{Module._load=original;globalThis.window=originalWindow;}
const realReact=require('react'),realTimers={set:globalThis.setTimeout,clear:globalThis.clearTimeout,formData:globalThis.FormData};let view,listener,sessionRead,passwordWrite,resetWrite,logoutReply,logoutCalls,passwordCalls,resetCalls;
const timers=new Map();let timerId=0;globalThis.setTimeout=(fn,ms)=>{const id=++timerId;timers.set(id,{fn,ms});return id;};globalThis.clearTimeout=id=>timers.delete(id);
globalThis.FormData=class{constructor(form){this.values=form;}get(name){return this.values[name];}};
const tick=ms=>{for(const[id,t]of [...timers])if(t.ms===ms){timers.delete(id);t.fn();}};
const hooks={...realReact,useState(initial){const v=view,i=v.index++;if(!(i in v.slots))v.slots[i]=typeof initial==='function'?initial():initial;return[v.slots[i],x=>{v.slots[i]=typeof x==='function'?x(v.slots[i]):x;v.updates++;}];},useRef(initial){const v=view,i=v.index++;return v.slots[i]??={current:initial};},useEffect(fn,deps){const v=view,i=v.index++,old=v.effects[i];if(!old||deps.some((d,n)=>!Object.is(d,old.deps[n])))v.effects[i]={fn,deps,cleanup:old?.cleanup};}};
Module._load=function(name,parent,...rest){
 if(name==='react')return hooks;
 if(name==='@/lib/auth')return{updatePassword:()=>{passwordCalls++;return passwordWrite.promise;},requestPasswordReset:email=>{resetCalls.push(email);return resetWrite.promise;}};
 if(name==='@/lib/supabase')return{getSupabaseClient:()=>({auth:{getSession:()=>sessionRead.promise,onAuthStateChange(fn){listener=fn;return{data:{subscription:{unsubscribe(){listener=null;}}}};},signOut:async()=>{logoutCalls++;return logoutReply;}}})};
 if(name==='next/link')return{__esModule:true,default:'a'};
 if(name.startsWith('@/components/'))return new Proxy({},{get:(_,key)=>key});
 if(name.startsWith('@/'))return original.call(this,path.resolve(name.slice(2)),parent,...rest);
 return original.call(this,name,parent,...rest);
};
const nodes=root=>!root||typeof root!=='object'?[]:[root,...(Array.isArray(root)?root:[root.props?.children]).flat(Infinity).flatMap(nodes)];
const text=root=>root==null||typeof root==='boolean'?'':typeof root!=='object'?String(root):(Array.isArray(root)?root:[root.props?.children]).flat(Infinity).map(text).join('');
const create=(Page,url='https://app.example.invalid/reset-password?type=recovery')=>{timers.clear();sessionRead=deferred();passwordWrite=deferred();resetWrite=deferred();logoutReply={error:null};logoutCalls=0;passwordCalls=0;resetCalls=[];globalThis.window={location:{href:url}};view={slots:[],effects:[],index:0,updates:0,render(){view.index=0;return Page();},start(){view.render();for(const e of view.effects.filter(Boolean))e.cleanup=e.fn();},stop(){for(const e of view.effects.filter(Boolean))e.cleanup?.();}};view.start();return view;};
const fillPassword=()=>{for(const field of nodes(view.render()).filter(n=>n.props?.autoComplete==='new-password'))field.props.onChange({target:{value:'test-only-new-password'}});};
try{
 const Reset=require('../app/reset-password/page.tsx').default,Forgot=require('../app/forgot-password/page.tsx').default;
 create(Reset);listener('PASSWORD_RECOVERY',{user:{id:'A'}});sessionRead.resolve({data:{session:null},error:{message:'late failure'}});await settle();assert.ok(nodes(view.render()).some(n=>n.props?.autoComplete==='new-password'),'A late failed read cannot overwrite a valid recovery event');fillPassword();const form=nodes(view.render()).find(n=>n.type==='form');const event={preventDefault(){}};const first=form.props.onSubmit(event),duplicate=form.props.onSubmit(event);assert.equal(passwordCalls,1);logoutReply={error:{message:'offline'}};passwordWrite.resolve();await Promise.all([first,duplicate]);assert.match(text(view.render()),/Lösenordet är uppdaterat/);assert.match(text(view.render()),/utloggningen kunde inte bekräftas/);assert.equal(nodes(view.render()).some(n=>n.props?.autoComplete==='new-password'),false);logoutReply={error:null};await nodes(view.render()).find(n=>n.type==='button'&&text(n).includes('Försök logga ut')).props.onClick();await settle();assert.equal(passwordCalls,1,'Retrying logout cannot mutate the password again');assert.equal(logoutCalls,2);view.stop();
 create(Reset);tick(15000);await settle();assert.match(text(view.render()),/Kunde inte verifiera/);assert.match(text(view.render()),/Begär en ny länk/);view.stop();
 create(Reset,'https://app.example.invalid/reset-password?error_description=expired');assert.match(text(view.render()),/ogiltig eller har gått ut/);listener('PASSWORD_RECOVERY',{user:{id:'A'}});assert.equal(nodes(view.render()).some(n=>n.props?.autoComplete==='new-password'),false);view.stop();
 create(Reset);listener('PASSWORD_RECOVERY',{user:{id:'A'}});fillPassword();const detached=nodes(view.render()).find(n=>n.type==='form').props.onSubmit(event);view.stop();const writes=view.updates;passwordWrite.resolve();await detached;assert.equal(logoutCalls,0);assert.equal(view.updates,writes,'Detached recovery cannot sign out a newer screen');
 create(Reset);listener('PASSWORD_RECOVERY',{user:{id:'A'}});fillPassword();const staleForm=nodes(view.render()).find(n=>n.type==='form');listener('SIGNED_IN',{user:{id:'B'}});await staleForm.props.onSubmit(event);assert.equal(passwordCalls,0,'Old recovery control cannot mutate a newly signed-in account');view.stop();
 create(Reset);listener('PASSWORD_RECOVERY',{user:{id:'A'}});fillPassword();const oldAccount=nodes(view.render()).find(n=>n.type==='form').props.onSubmit(event);listener('SIGNED_IN',{user:{id:'B'}});passwordWrite.resolve();await oldAccount;assert.equal(logoutCalls,0,'Late password completion cannot log a newer account out');view.stop();
 create(Forgot);const submit=nodes(view.render()).find(n=>n.type==='form').props.onSubmit;const submitted={preventDefault(){},currentTarget:{email:'autofilled@example.invalid'}};const one=submit(submitted),two=submit(submitted);assert.deepEqual(resetCalls,['autofilled@example.invalid']);view.stop();const before=view.updates;resetWrite.resolve();await Promise.all([one,two]);assert.equal(view.updates,before);
 console.log('PASS actual recovery forms: late/failed/expired links, timeout, one password write, truthful partial success, logout-only retry, autofill, double submission and unmount. Transport simulated.');
}finally{view?.stop();Module._load=original;globalThis.setTimeout=realTimers.set;globalThis.clearTimeout=realTimers.clear;globalThis.FormData=realTimers.formData;if(originalWindow===undefined)delete globalThis.window;else globalThis.window=originalWindow;}
