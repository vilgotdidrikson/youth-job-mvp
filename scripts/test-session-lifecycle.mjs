// Exercises the actual SessionProvider callbacks with controlled React hooks/transport.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire,Module} from 'node:module';
import path from 'node:path';
import ts from 'typescript';
const require=createRequire(import.meta.url),originalLoad=Module._load;
const originalTimers={setTimeout:globalThis.setTimeout,clearTimeout:globalThis.clearTimeout,window:globalThis.window};
const timers=new Map();let timerId=0;
globalThis.setTimeout=(fn,ms)=>{const id=++timerId;timers.set(id,{fn,ms});return id;};globalThis.clearTimeout=id=>timers.delete(id);globalThis.window={setTimeout:globalThis.setTimeout};
const tick=(ms=0)=>{for(const[id,t]of [...timers])if(t.ms===ms){timers.delete(id);t.fn();}};
const settle=async()=>{for(let i=0;i<6;i++)await Promise.resolve();};
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return{promise,resolve,reject};};
let currentView,callback,profiles=[],users=[],signOutDeferred=null;
const react=require('react');
const hooks={...react,useRef(initial){const v=currentView,i=v.index++;return v.slots[i]??={current:initial};},useState(initial){const v=currentView,i=v.index++;if(!(i in v.slots))v.slots[i]=typeof initial==='function'?initial():initial;return[v.slots[i],x=>{v.slots[i]=typeof x==='function'?x(v.slots[i]):x;v.updates++;}];},useCallback(fn,deps){const v=currentView,i=v.index++,old=v.slots[i];if(!old||deps.some((d,n)=>!Object.is(d,old.deps[n])))v.slots[i]={fn,deps};return v.slots[i].fn;},useEffect(fn,deps){const v=currentView,i=v.index++,old=v.effects[i];if(!old||deps.some((d,n)=>!Object.is(d,old.deps[n])))v.effects[i]={fn,deps,pending:true,cleanup:old?.cleanup};}};
for(const ext of ['.ts','.tsx'])Module._extensions[ext]=(m,file)=>m._compile(ts.transpileModule(readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText,file);
Module._load=function(name,parent,...rest){
 if(name==='react')return hooks;
 if(name==='@/lib/auth')return{getCurrentUser(){const d=deferred();users.push(d);return d.promise;},getUserProfile(id){const d=deferred();profiles.push({id,...d});return d.promise;},signOut:()=>signOutDeferred?.promise??Promise.resolve()};
 if(name==='@/lib/supabase')return{getSupabaseClient:()=>({auth:{onAuthStateChange(fn){callback=fn;return{data:{subscription:{unsubscribe(){callback=null;}}}};}}})};
 if(name.startsWith('@/'))return originalLoad.call(this,path.resolve(name.slice(2)),parent,...rest);
 return originalLoad.call(this,name,parent,...rest);
};
const A={id:'youth-a'},B={id:'company-b'},pa={id:A.id,role:'youth'},pb={id:B.id,role:'company'};
let view;
try{
 const{SessionProvider}=require('../hooks/use-session.ts');
 const create=()=>{profiles=[];users=[];timers.clear();signOutDeferred=null;view={slots:[],effects:[],index:0,updates:0,read(){currentView=view;this.index=0;return SessionProvider({children:null}).props.value;},start(){this.read();for(const e of this.effects.filter(Boolean)){e.cleanup=e.fn();e.pending=false;}},stop(){for(const e of this.effects.filter(Boolean))e.cleanup?.();}};view.start();return view;};
 const emit=(event,user)=>callback(event,user?{user}:null);
 create();emit('SIGNED_IN',A);tick();const old=profiles[0];emit('SIGNED_OUT');old.resolve(pa);await settle();assert.equal(view.read().profile,null,'A late profile must not reappear after sign-out');assert.equal(view.read().user,null);view.stop();
 create();const pending=view.read().refresh();emit('SIGNED_OUT');users[0].resolve(A);await settle();assert.equal(view.read().user,null,'A late getUser must not sign the account back in');await pending;view.stop();
 create();emit('SIGNED_IN',A);tick();const profileA=profiles[0];emit('SIGNED_IN',B);tick();assert.equal(profiles.at(-1).id,B.id,'New identity must start its own profile read');profiles.at(-1).resolve(pb);await settle();profileA.resolve(pa);await settle();assert.equal(view.read().user.id,B.id);assert.equal(view.read().profile.id,B.id,'Late profile A must not overwrite profile B');view.stop();
 create();emit('SIGNED_IN',A);emit('SIGNED_OUT');tick();await settle();assert.equal(profiles.length,0,'Queued auth callback must be invalidated by sign-out');assert.equal(view.read().user,null);view.stop();
 create();emit('SIGNED_IN',A);tick();profiles[0].resolve(pa);await settle();const before=profiles.length;emit('TOKEN_REFRESHED',{...A});tick();await settle();assert.equal(profiles.length,before,'Token rotations do not refetch an unchanged profile');const updates=view.updates;view.stop();tick();await settle();assert.equal(view.updates,updates,'Unmount must suppress later state writes');
 create();emit('SIGNED_IN',A);tick();const tooLate=profiles[0];tick(15000);await settle();assert.equal(view.read().loading,false);assert.match(view.read().error,/i tid/);tooLate.resolve(pa);await settle();assert.equal(view.read().profile,null,'A timed-out reply cannot clear the error');const retry=view.read().refresh();users[0].resolve(A);await settle();profiles.at(-1).resolve(pa);await retry;assert.equal(view.read().profile.id,A.id);assert.equal(view.read().error,null);view.stop();
 create();emit('SIGNED_IN',A);tick();profiles[0].resolve(pa);await settle();signOutDeferred=deferred();const leaving=view.read().logout();emit('SIGNED_IN',B);tick();profiles.at(-1).resolve(pb);await settle();signOutDeferred.resolve();await leaving;assert.equal(view.read().user.id,B.id,'Late logout completion cannot clear a newer account');view.stop();
 create();emit('SIGNED_IN',A);tick();profiles[0].resolve(pa);await settle();signOutDeferred=deferred();const failedLogout=view.read().logout();signOutDeferred.reject(new Error('QA offline logout'));await assert.rejects(failedLogout,/offline/);assert.equal(view.read().user.id,A.id);assert.match(view.read().error,/offline/);view.stop();
 create();emit('SIGNED_IN',A);tick();const detached=profiles[0],writes=view.updates;view.stop();detached.resolve(pa);await settle();assert.equal(view.updates,writes,'Detached profile cannot write after unmount');
 console.log('PASS actual session callbacks: late profile/getUser after logout, A-to-B account switch, queued events, token rotation, timeout/retry, failed or late logout and unmount. Transport simulated.');
}finally{view?.stop();Module._load=originalLoad;globalThis.setTimeout=originalTimers.setTimeout;globalThis.clearTimeout=originalTimers.clearTimeout;if(originalTimers.window===undefined)delete globalThis.window;else globalThis.window=originalTimers.window;}
