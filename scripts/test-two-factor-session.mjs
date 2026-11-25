import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire, Module } from 'node:module';
import path from 'node:path';
import ts from 'typescript';
const require=createRequire(import.meta.url),originalLoad=Module._load;
Module._extensions['.ts']=(mod,file)=>mod._compile(ts.transpileModule(readFileSync(file,'utf8'),{fileName:file,compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,file);
const owner='11111111-1111-4111-8111-111111111111',sessionId='22222222-2222-4222-8222-222222222222',other='33333333-3333-4333-8333-333333333333';
const originalEnv={url:process.env.NEXT_PUBLIC_SUPABASE_URL,key:process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,service:process.env.SUPABASE_SERVICE_ROLE_KEY};
process.env.NEXT_PUBLIC_SUPABASE_URL='https://qa.invalid';process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY='test-only-public';process.env.SUPABASE_SERVICE_ROLE_KEY='test-only-service';
let claims,actor,alive,rpcError,claimsError,reads=[],rpcs=[],factories=[],waiting;
const userClient={auth:{getClaims:async token=>{reads.push(['claims',token]);if(waiting)return waiting.promise;return{data:{claims},error:claimsError};},getUser:async token=>{reads.push(['user',token]);return{data:{user:actor},error:null};}}};
const sessions={auth:{},rpc(name,args){rpcs.push({name,args});return{abortSignal:async signal=>{assert.ok(signal instanceof AbortSignal);return{data:alive,error:rpcError};}};}};
Module._load=function(name,parent,...rest){
 if(name==='server-only')return{};
 if(name==='@supabase/supabase-js')return{createClient:(url,key,options)=>{factories.push({url,key,options});return key==='test-only-service'?sessions:userClient;}};
 return originalLoad.call(this,name.startsWith('@/')?path.resolve(name.slice(2)):name,parent,...rest);
};
const reset=()=>{claims={sub:owner,session_id:sessionId,aal:'aal2',role:'authenticated',is_anonymous:false,exp:Math.floor(Date.now()/1000)+3600};actor={id:owner};alive=true;rpcError=null;claimsError=null;reads=[];rpcs=[];factories=[];waiting=null;};
try{
 const {verifyTwoFactorSession}=require('../lib/server/two-factor-session.ts');
 reset();await verifyTwoFactorSession(userClient,sessions,owner,'captured-token');assert.deepEqual(rpcs,[{name:'is_personal_data_session_active',args:{p_subject_id:owner,p_session_id:sessionId}}]);assert.ok(reads.every(r=>r[1]==='captured-token'));
 for(const patch of [{aal:'aal1'},{aal:undefined}]){reset();Object.assign(claims,patch);await assert.rejects(verifyTwoFactorSession(userClient,sessions,owner,'captured-token'),err=>err.status===403);assert.equal(rpcs.length,0);}
 for(const patch of [{sub:other},{session_id:'bad'},{role:'anon'},{is_anonymous:true},{exp:1}]){reset();Object.assign(claims,patch);await assert.rejects(verifyTwoFactorSession(userClient,sessions,owner,'captured-token'),err=>err.status===401);assert.equal(rpcs.length,0);}
 reset();alive=false;await assert.rejects(verifyTwoFactorSession(userClient,sessions,owner,'captured-token'),err=>err.status===401);
 reset();rpcError={message:'PRIVATE RPC ERROR'};await assert.rejects(verifyTwoFactorSession(userClient,sessions,owner,'captured-token'),err=>err.status===503&&!err.message.includes('PRIVATE'));
 reset();actor={id:other};await assert.rejects(verifyTwoFactorSession(userClient,sessions,owner,'captured-token'),err=>err.status===401);assert.equal(rpcs.length,0);
 reset();claimsError={message:'PRIVATE CLAIMS ERROR'};await assert.rejects(verifyTwoFactorSession(userClient,sessions,owner,'captured-token'),err=>err.status===401&&!err.message.includes('PRIVATE'));
 reset();let release;waiting={promise:new Promise(r=>{release=r;})};const aborted=new AbortController();const late=verifyTwoFactorSession(userClient,sessions,owner,'captured-token',aborted.signal);aborted.abort();await assert.rejects(late,err=>err.status===503);release({data:{claims},error:null});await Promise.resolve();await Promise.resolve();assert.equal(rpcs.length,0,'Late claims after abort cannot reach session RPC');
 const {GET}=require('../app/api/account/mfa-session/route.ts');
 const request=(headers={})=>new Request('https://qa.invalid/api/account/mfa-session',{headers:{Authorization:'Bearer captured-token','X-Account-Id':owner,...headers}});
 reset();const response=await GET(request());assert.equal(response.status,200);assert.deepEqual(await response.json(),{verified:true});assert.equal(response.headers.get('cache-control'),'no-store');assert.equal(factories.length,2);assert.equal(factories[0].options.global.headers.Authorization,'Bearer captured-token');assert.equal(factories[1].key,'test-only-service');assert.equal(rpcs.length,1);
 for(const h of [{Authorization:''},{'X-Account-Id':'bad'},{Authorization:'Bearer '+ 'x'.repeat(16385)}]){reset();assert.equal((await GET(request(h))).status,401);assert.equal(factories.length,0);}
 reset();claims.aal='aal1';assert.equal((await GET(request())).status,403);assert.equal(rpcs.length,0);
 reset();alive=false;assert.equal((await GET(request())).status,401);
 reset();delete process.env.SUPABASE_SERVICE_ROLE_KEY;assert.equal((await GET(request())).status,503);assert.equal(factories.length,0);process.env.SUPABASE_SERVICE_ROLE_KEY='test-only-service';
 console.log('PASS actual two-factor session verifier and GET route: explicit same-token claims/live identity, AAL2, expiration/role/anonymous checks, active-session RPC, old session denial, cancelled/late claims, authentication/input limits and uncached proof-only response. Auth/DB simulated; no case/admin authorization is granted.');
}finally{Module._load=originalLoad;for(const [key,value]of Object.entries({NEXT_PUBLIC_SUPABASE_URL:originalEnv.url,NEXT_PUBLIC_SUPABASE_ANON_KEY:originalEnv.key,SUPABASE_SERVICE_ROLE_KEY:originalEnv.service})){if(value===undefined)delete process.env[key];else process.env[key]=value;}}
