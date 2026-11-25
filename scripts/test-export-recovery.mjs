import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire,Module} from 'node:module';
import {createHash,generateKeyPairSync,sign} from 'node:crypto';
import path from 'node:path';
import ts from 'typescript';
import {zipSync,strToU8} from 'fflate';
const require=createRequire(import.meta.url),load=Module._load,ext=Module._extensions['.ts'],sdk=require('@supabase/supabase-js');
const subject='11111111-1111-4111-8111-111111111111',other='22222222-2222-4222-8222-222222222222',sid='33333333-3333-4333-8333-333333333333';
const keys=generateKeyPairSync('ec',{namedCurve:'P-256'}),jwk={...keys.publicKey.export({format:'jwk'}),kid:'qa-recovery',alg:'ES256',use:'sig'};
function token(session){const encode=v=>Buffer.from(JSON.stringify(v)).toString('base64url');const data=encode({alg:'ES256',kid:jwk.kid,typ:'JWT'})+'.'+encode({sub:subject,session_id:session,role:'authenticated',aud:'authenticated',iss:'https://vwcfjvwfeatvuisojwrh.supabase.co/auth/v1',exp:Math.floor(Date.now()/1000)+3600});return data+'.'+sign('sha256',Buffer.from(data),{key:keys.privateKey,dsaEncoding:'ieee-p1363'}).toString('base64url');}
const originalToken=token(sid),temporaryToken=token(other),bytes=zipSync({'QA.txt':strToU8('Fiktivt återhämtningsprov Åäö')});
const user={id:subject,email:'qa-recovery@example.invalid',aud:'authenticated',created_at:new Date().toISOString()};
const names=['MATCHNWORK_EXPORT_PREVIEW_ENABLED','MATCHNWORK_EXPORT_STORAGE_READY','NEXT_PUBLIC_SUPABASE_URL','NEXT_PUBLIC_SUPABASE_ANON_KEY','SUPABASE_SERVICE_ROLE_KEY'],saved=Object.fromEntries(names.map(n=>[n,process.env[n]]));
let mode,steps,sessionChecks,expiry,passed=0;
function reset(){mode='ready';steps=[];sessionChecks=0;expiry=new Date(Date.now()+3600000).toISOString();Object.assign(process.env,{MATCHNWORK_EXPORT_PREVIEW_ENABLED:'true',MATCHNWORK_EXPORT_STORAGE_READY:'true',NEXT_PUBLIC_SUPABASE_URL:'https://vwcfjvwfeatvuisojwrh.supabase.co',NEXT_PUBLIC_SUPABASE_ANON_KEY:'qa-public',SUPABASE_SERVICE_ROLE_KEY:'qa-service'});}
async function transport(input,init){
 const url=new URL(String(input)),headers=new Headers(init?.headers),auth=headers.get('authorization'),params=init?.body&&typeof init.body==='string'?JSON.parse(init.body):null;
 if(url.pathname.endsWith('/.well-known/jwks.json'))return Response.json({keys:[jwk]});
 if(url.pathname==='/auth/v1/user'){steps.push('identity');assert.equal(auth,'Bearer '+originalToken);return Response.json(mode==='foreign identity'?{...user,id:other}:user);}
 if(url.pathname==='/auth/v1/token'){steps.push('password');assert.deepEqual(params,{email:user.email,password:'qa-password',gotrue_meta_security:{}});if(mode==='wrong password')return Response.json({code:'invalid_credentials',msg:'QA_PRIVATE'},{status:400});return Response.json({access_token:temporaryToken,refresh_token:'qa-refresh',expires_in:3600,token_type:'bearer',user});}
 if(url.pathname==='/auth/v1/logout'){steps.push('logout');assert.equal(auth,'Bearer '+temporaryToken);assert.equal(url.searchParams.get('scope'),'local');return mode==='logout failed'?Response.json({message:'QA_PRIVATE'},{status:500}):new Response(null,{status:204});}
 if(url.pathname.endsWith('/consume_api_quota')){steps.push('quota');assert.equal(auth,'Bearer '+originalToken);assert.deepEqual(params,{p_endpoint:'personal-data-export-recovery',p_limit:3});return Response.json(mode==='quota'?false:true);}
 if(url.pathname.endsWith('/is_personal_data_session_active')){steps.push('session');sessionChecks++;assert.equal(auth,'Bearer qa-service');assert.deepEqual(params,{p_subject_id:subject,p_session_id:sid});return Response.json(!(mode==='revoked before'||mode==='revoked after'&&sessionChecks===2));}
 if(url.pathname.endsWith('/latest_personal_data_export')){
  steps.push('latest');assert.equal(auth,'Bearer qa-service');assert.deepEqual(params,{p_subject_id:subject});assert.ok(steps.includes('logout'));
  if(mode==='hanging')return new Promise(()=>{});
  if(['none','expired','failed'].includes(mode))return Response.json({status:mode});
  if(mode==='lookup error')return Response.json({message:'QA_PRIVATE'},{status:500});
  if(mode==='bad status')return Response.json({status:'anything'});
  return Response.json({status:mode==='building'?'building':'ready',id:other,subjectId:mode==='foreign metadata'?other:subject,expiresAt:mode==='expired metadata'?'2000-01-01T00:00:00Z':mode==='numeric expiry'?12345:expiry,...(mode==='extra metadata'?{path:'QA_PRIVATE'}:{})});
 }
 if(url.pathname.endsWith('/read_personal_data_export')){steps.push('read');assert.equal(auth,'Bearer qa-service');assert.deepEqual(params,{p_subject_id:subject,p_export_id:other});if(mode==='expired at read')return Response.json({status:'unavailable'});return Response.json({status:'ready',id:other,subjectId:subject,path:subject+'/'+other+'.zip',expiresAt:expiry,sizeBytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')});}
 if(url.pathname.includes('/storage/v1/object/')){steps.push('download');assert.equal(auth,'Bearer qa-service');assert.notEqual(init?.method,'POST');assert.ok(url.pathname.endsWith('/personal-data-exports/'+subject+'/'+other+'.zip'));const output=bytes.slice();if(mode==='corrupt bytes')output[output.length-1]^=1;return new Response(output);}
 throw Error('Unexpected network operation '+url.pathname);
}
Module._extensions['.ts']=(m,f)=>m._compile(ts.transpileModule(readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText,f);
Module._load=function(n,parent,...args){if(n==='server-only')return{};if(n==='@supabase/supabase-js'&&parent?.filename.endsWith('/export-preview/recover/route.ts'))return{...sdk,createClient:(url,key,options)=>sdk.createClient(url,key,{...options,global:{...options.global,fetch:transport}})};if(n.startsWith('@/'))return load.call(this,path.resolve(n.slice(2)),parent,...args);return load.call(this,n,parent,...args);};
const {POST}=require('../app/api/account/export-preview/recover/route.ts');
function request(value={expectedUserId:subject,password:'qa-password'},headers={},extra={}){return new Request('https://qa.example.invalid/api/account/export-preview/recover',{method:'POST',headers:{Authorization:'Bearer '+originalToken,'Content-Type':'application/json',...headers},body:typeof value==='string'?value:JSON.stringify(value),...extra});}
async function test(name,fn){reset();await fn();passed++;console.log('PASS '+name);}
function secure(r){assert.match(r.headers.get('cache-control'),/no-store/);assert.equal(r.headers.get('x-content-type-options'),'nosniff');assert.equal(r.headers.get('vary'),'Authorization');}
try{
 for(const [env,value,status]of [['MATCHNWORK_EXPORT_PREVIEW_ENABLED','false',404],['MATCHNWORK_EXPORT_STORAGE_READY','false',503],['NEXT_PUBLIC_SUPABASE_URL','https://prod.example.invalid',404],['SUPABASE_SERVICE_ROLE_KEY','',503]])await test('gate '+env,async()=>{process.env[env]=value;assert.equal((await POST(request())).status,status);assert.equal(steps.length,0);});
 for(const [headers,status]of [[{Origin:'https://evil.invalid'},403],[{'sec-fetch-site':'cross-site'},403],[{Authorization:''},401],[{'Content-Type':'text/plain'},415],[{'Content-Length':'8193'},413]])await test('request guard '+status,async()=>{assert.equal((await POST(request(undefined,headers))).status,status);assert.equal(steps.length,0);});
 for(const value of [{expectedUserId:subject,password:'qa-password',id:other},{expectedUserId:subject,password:''},{expectedUserId:'bad',password:'qa-password'},' '.repeat(8193),'not JSON'])await test('reject invalid body without Auth',async()=>{assert.ok([400,413].includes((await POST(request(value))).status));assert.equal(steps.length,0);});
 for(const [scenario,status]of [['wrong password',403],['foreign identity',401],['revoked before',401],['revoked after',401],['quota',429],['logout failed',502],['lookup error',503],['bad status',503],['foreign metadata',503],['expired metadata',503],['numeric expiry',503],['extra metadata',503],['expired at read',503],['corrupt bytes',503]])await test('withhold package: '+scenario,async()=>{mode=scenario;const r=await POST(request());assert.equal(r.status,status);secure(r);assert.equal(r.headers.get('content-disposition'),null);assert.ok(!(await r.text()).includes('QA_PRIVATE'));if(['wrong password','quota','logout failed','revoked before','foreign identity'].includes(mode))assert.ok(!steps.includes('latest'));});
 for(const status of ['none','building','expired','failed'])await test('safe status '+status+' never creates/downloads a package',async()=>{mode=status;const r=await POST(request());assert.equal(r.status,200);secure(r);const output=await r.json();assert.deepEqual(output,status==='building'?{status,expiresAt:expiry}:{status});assert.equal(sessionChecks,2);assert.ok(!steps.includes('download'));});
 await test('recover exact existing ZIP with original ID and expiry',async()=>{const r=await POST(request());assert.equal(r.status,200);secure(r);assert.equal(r.headers.get('x-matchnwork-export-expires'),expiry);assert.equal(r.headers.get('x-matchnwork-export-coverage'),'needs_completion');assert.ok(r.headers.get('content-disposition').includes(other));assert.deepEqual(new Uint8Array(await r.arrayBuffer()),bytes);assert.equal(sessionChecks,2);assert.equal(steps.filter(s=>s==='read').length,2);assert.equal(steps.at(-2),'identity');assert.equal(steps.at(-1),'session');});
 await test('cancelled lookup returns no late download or job mutation',async()=>{mode='hanging';const c=new AbortController(),pending=POST(request(undefined,{}, {signal:c.signal}));while(!steps.includes('latest'))await new Promise(r=>setTimeout(r,1));c.abort();assert.equal((await pending).status,408);assert.ok(!steps.includes('download'));});
 console.log(`PASS ${passed} recovery route checks; actual handler/helpers/SDK/ZIP, simulated remote Auth and Storage.`);
}finally{Module._load=load;if(ext)Module._extensions['.ts']=ext;else delete Module._extensions['.ts'];for(const n of names)if(saved[n]===undefined)delete process.env[n];else process.env[n]=saved[n];}
