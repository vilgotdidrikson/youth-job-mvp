import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire,Module} from 'node:module';
import {generateKeyPairSync,sign} from 'node:crypto';
import path from 'node:path';
import ts from 'typescript';
const require=createRequire(import.meta.url),load=Module._load,extension=Module._extensions['.ts'],sdk=require('@supabase/supabase-js');
const id='11111111-1111-4111-8111-111111111111',sid='22222222-2222-4222-8222-222222222222',fid='33333333-3333-4333-8333-333333333333';
const keys=generateKeyPairSync('ec',{namedCurve:'P-256'}),jwk={...keys.publicKey.export({format:'jwk'}),kid:'qa-sensitive',alg:'ES256',use:'sig'};
function jwt(aal,session=sid){const encode=v=>Buffer.from(JSON.stringify(v)).toString('base64url');const data=encode({alg:'ES256',kid:jwk.kid,typ:'JWT'})+'.'+encode({sub:id,session_id:session,aal,role:'authenticated',aud:'authenticated',iss:'https://vwcfjvwfeatvuisojwrh.supabase.co/auth/v1',iat:Math.floor(Date.now()/1000),exp:Math.floor(Date.now()/1000)+3600});return data+'.'+sign('sha256',Buffer.from(data),{key:keys.privateKey,dsaEncoding:'ieee-p1363'}).toString('base64url');}
const original=jwt('aal1'),temporary=jwt('aal1',fid),upgraded=jwt('aal2',fid);
const names=['MATCHNWORK_EXPORT_PREVIEW_ENABLED','MATCHNWORK_EXPORT_STORAGE_READY','MATCHNWORK_EXPORT_INFORMATION','NEXT_PUBLIC_SUPABASE_URL','NEXT_PUBLIC_SUPABASE_ANON_KEY','SUPABASE_SERVICE_ROLE_KEY'];
const saved=Object.fromEntries(names.map(n=>[n,process.env[n]]));
Object.assign(process.env,{MATCHNWORK_EXPORT_PREVIEW_ENABLED:'true',MATCHNWORK_EXPORT_STORAGE_READY:'true',MATCHNWORK_EXPORT_INFORMATION:JSON.stringify({controller:'QA',contact:'qa@example.invalid',purposes:['QA'],recipients:['QA'],retention:['QA'],sources:['QA'],rights:['QA'],automatedProcessing:['QA']}),NEXT_PUBLIC_SUPABASE_URL:'https://vwcfjvwfeatvuisojwrh.supabase.co',NEXT_PUBLIC_SUPABASE_ANON_KEY:'qa-public',SUPABASE_SERVICE_ROLE_KEY:'qa-service'});
let scenario='missing',calls=[],passed=0,cancellation=null;
const factor={id:fid,factor_type:'totp',status:'verified',created_at:new Date().toISOString()};
const user=()=>({id,email:'qa-sensitive@example.invalid',role:'authenticated',aud:'authenticated',created_at:new Date().toISOString(),factors:scenario==='none'||scenario==='removedlate'&&calls.some(c=>c.path==='/auth/v1/logout')||scenario==='added'&&!calls.some(c=>c.path==='/auth/v1/token')||scenario==='addedlate'&&!calls.some(c=>c.path==='/auth/v1/logout')?[]:scenario==='phone'?[{...factor,factor_type:'phone'}]:[factor]});
async function transport(input,init){
 const url=new URL(String(input)),authorization=new Headers(init?.headers).get('authorization'),body=typeof init?.body==='string'?JSON.parse(init.body):null;
 calls.push({path:url.pathname,authorization,method:init?.method??'GET'});
 if(url.pathname.endsWith('/.well-known/jwks.json'))return Response.json({keys:[jwk]});
 if(url.pathname==='/auth/v1/user'){
  assert.ok([original,temporary,upgraded].some(t=>authorization==='Bearer '+t));
  return Response.json(user());
 }
 if(url.pathname==='/auth/v1/token'){
  assert.notEqual(authorization,'Bearer '+original);assert.deepEqual(body,{email:user().email,password:'qa-password',gotrue_meta_security:{}});
  return Response.json({user:user(),access_token:temporary,refresh_token:'qa-refresh',token_type:'bearer',expires_in:3600});
 }
 if(url.pathname===`/auth/v1/factors/${fid}/challenge`){assert.equal(authorization,'Bearer '+temporary);return Response.json({id:'qa-challenge',expires_at:Math.floor(Date.now()/1000)+60});}
 if(url.pathname===`/auth/v1/factors/${fid}/verify`){
  assert.equal(authorization,'Bearer '+temporary);assert.deepEqual(body,{challenge_id:'qa-challenge',code:'123456'});
  if(['wrong','rate','offline'].includes(scenario))return Response.json({code:scenario==='rate'?'over_request_rate_limit':'mfa_verification_failed',msg:'QA_PRIVATE'}, {status:scenario==='rate'?429:scenario==='offline'?503:422});
  if(scenario==='cancel')cancellation.abort();
  return Response.json({user:scenario==='foreign'?{...user(),id:fid}:user(),access_token:scenario==='weak'?temporary:upgraded,refresh_token:'qa-refresh-upgraded',token_type:'bearer',expires_in:3600});
 }
 if(url.pathname==='/auth/v1/logout'){
  assert.notEqual(authorization,'Bearer '+original);assert.equal(url.searchParams.get('scope'),'local');
  if(scenario==='cleanup')return Response.json({message:'QA_PRIVATE'},{status:500});
  return new Response(null,{status:204});
 }
 if(url.pathname.endsWith('/is_personal_data_session_active')){assert.equal(authorization,'Bearer qa-service');return Response.json(true);}
 if(url.pathname.endsWith('/consume_api_quota')){assert.equal(authorization,'Bearer '+original);return Response.json(true);}
 if(url.pathname.endsWith('/latest_personal_data_export')){assert.equal(authorization,'Bearer qa-service');return Response.json({status:'none'});}
 throw Error('Unexpected operation '+url.pathname);
}
Module._extensions['.ts']=(m,f)=>m._compile(ts.transpileModule(readFileSync(f.endsWith('/lib/server/account-reauthentication.ts')&&process.env.MNW_REAUTH_BASELINE?process.env.MNW_REAUTH_BASELINE:f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText,f);
Module._load=function(n,parent,...args){if(n==='server-only')return{};if(n==='@supabase/supabase-js'&&parent?.filename.includes('/app/api/account/'))return{...sdk,createClient:(url,key,options)=>sdk.createClient(url,key,{...options,global:{...options.global,fetch:transport}})};if(n.startsWith('@/'))return load.call(this,path.resolve(n.slice(2)),parent,...args);return load.call(this,n,parent,...args);};
const routes=[['delete',require('../app/api/account/route.ts').DELETE],['create',require('../app/api/account/export-preview/route.ts').POST],['recover',require('../app/api/account/export-preview/recover/route.ts').POST]];
function request(route,code){return new Request('https://app.example.invalid/api/account'+(route==='delete'?'':route==='create'?'/export-preview':'/export-preview/recover'),{method:route==='delete'?'DELETE':'POST',headers:{Authorization:'Bearer '+original,'Content-Type':'application/json'},body:JSON.stringify({expectedUserId:id,password:'qa-password',...(code!==undefined?{totpCode:code}:{})})});}
try{
 scenario='missing';calls=[];const authOptions={auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},global:{fetch:transport}};
 const {reauthenticateAccount}=require('../lib/server/account-reauthentication.ts');
 await assert.rejects(reauthenticateAccount(sdk.createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,'qa-public',{...authOptions,global:{...authOptions.global,headers:{Authorization:'Bearer '+original}}}),sdk.createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,'qa-public',authOptions),id,'qa-password'),error=>error.status===403,'A verified factor must require a code in the server helper');
 for(const [name,run]of routes){
  for(const [mode,code,status]of [['missing',undefined,403],['added',undefined,403],['addedlate',undefined,409],['removedlate','123456',409],['wrong','123456',403],['rate','123456',429],['offline','123456',502],['foreign','123456',502],['weak','123456',502],['cleanup','123456',502],['phone','123456',403]]){
   scenario=mode;calls=[];const response=await run(request(name,code));assert.equal(response.status,status,`${name} ${mode}`);assert.ok(!(await response.text()).includes('QA_PRIVATE'));
   assert.ok(calls.some(c=>c.path==='/auth/v1/logout'),'Temporary session is closed even when MFA fails');
   assert.ok(calls.every(c=>c.path.startsWith('/auth/')||c.path.endsWith('/consume_api_quota')||c.path.endsWith('/is_personal_data_session_active')),'No deletion, collection, file or package read before MFA');
   if(['missing','phone'].includes(mode))assert.ok(!calls.some(c=>c.path.endsWith('/challenge')));
   passed++;console.log('PASS actual '+name+' route blocks '+mode+' before sensitive work');
  }
  for(const code of ['',null,{},'12345','1234567','abcdef']){scenario='missing';calls=[];assert.equal((await run(request(name,code))).status,400);assert.equal(calls.length,0);passed++;}
 }
 scenario='cancel';calls=[];cancellation=new AbortController();await assert.rejects(reauthenticateAccount(sdk.createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,'qa-public',{...authOptions,global:{...authOptions.global,headers:{Authorization:'Bearer '+original}}}),sdk.createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,'qa-public',authOptions),id,'qa-password','123456',cancellation.signal),error=>error.status===502);assert.equal(calls.at(-1).path,'/auth/v1/logout');assert.ok(!calls.some(c=>c.path==='/auth/v1/user'&&c.authorization==='Bearer '+upgraded),'Cancelled verification never continues to assurance or privileged work');passed++;
 scenario='ok';calls=[];const result=await routes[2][1](request('recover','123456'));assert.equal(result.status,200);assert.deepEqual(await result.json(),{status:'none'});
 assert.ok(calls.findIndex(c=>c.path==='/auth/v1/logout')<calls.findIndex(c=>c.path.endsWith('/latest_personal_data_export')));
 assert.equal(calls.find(c=>c.path==='/auth/v1/logout').authorization,'Bearer '+upgraded);
 assert.ok(calls.some(c=>c.path==='/auth/v1/user'&&c.authorization==='Bearer '+upgraded),'Explicit AAL token is validated at Auth');passed++;
 console.log(`PASS ${passed} sensitive MFA route checks: actual handlers/helpers/installed SDK and locally signed JWT, simulated Auth/RPC. No live accounts, factors, deletions or packages created.`);
}finally{Module._load=load;if(extension)Module._extensions['.ts']=extension;else delete Module._extensions['.ts'];for(const n of names)if(saved[n]===undefined)delete process.env[n];else process.env[n]=saved[n];}
