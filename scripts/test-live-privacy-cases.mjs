// Opt-in, DevStaging only. No handler grants, MFA factors, emails or accepted cases.
import assert from'node:assert/strict';import{randomBytes,randomUUID}from'node:crypto';import{writeFileSync}from'node:fs';import{createClient}from'@supabase/supabase-js';
const base='https://vwcfjvwfeatvuisojwrh.supabase.co',app='https://youth-job-mvp-dev.vercel.app';
assert.equal(process.env.MNW_LIVE_PRIVACY_CASES_ALLOW_WRITES,'true');assert.equal(process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/,''),base);
const key=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;assert.ok(key);const password=randomBytes(24).toString('base64url'),prefix='qa-privacy-case-http-'+Date.now(),client=createClient(base,key,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
let id,token,deleted=false,count=0;const fetchBounded=(url,init={})=>fetch(url,{...init,signal:AbortSignal.timeout(30000)});const ok=(v,m)=>{assert.ok(v,m);count++;console.log('PASS '+m);};
async function api(input,opts={}){return fetchBounded(app+(opts.admin?'/api/admin/privacy-cases':'/api/account/privacy-cases'),{method:'POST',headers:{Authorization:'Bearer '+token,'X-Account-Id':id,'Content-Type':'application/json',...opts.headers},body:JSON.stringify(input)});}
try{
 const config=await fetchBounded(base+'/auth/v1/settings',{headers:{apikey:key}});const settings=await config.json();ok(config.ok&&settings.mailer_autoconfirm===true&&settings.external?.email===true,'auto-confirm preflight; no verification email');
 const result=await client.auth.signUp({email:prefix+'@example.invalid',password,options:{data:{role:'youth'}}});id=result.data.user?.id;token=result.data.session?.access_token;ok(!result.error&&!!id&&!!token,'single disposable account receives real Auth session');
 const first=await api({action:'list',cursor:null});const page=await first.json();ok(first.status===200&&page.available===false&&page.cases.length===0,'deployed own route reads real empty history and configured unavailable intake');ok(first.headers.get('cache-control').includes('no-store'),'deployed history forbids cache');
 const create=await api({action:'create',id:randomUUID(),kind:'access',body:'QA synthetic probe; this must not be accepted without a handler.'});ok(create.status===503,'deployed unattended intake rejects new case');
 const other=await api({action:'list',cursor:null},{headers:{'X-Account-Id':randomUUID()}});ok(other.status===401,'real token cannot claim another account');
 const admin=await api({action:'list',cursor:null,password,totpCode:'123456'},{admin:true});ok(admin.status===403,'ordinary youth cannot read admin queue with invented code');
 const again=await api({action:'list',cursor:null});const state=await again.json();ok(again.status===200&&state.cases.length===0,'rejected intake and admin attempt create no own case');
 console.log('PASS '+count+' real Auth/deployed API checks. Positive handler/TOTP workflow is not tested.');
}catch(e){console.error(JSON.stringify({type:e.name,message:e instanceof assert.AssertionError?e.message:undefined}));process.exitCode=1;}
finally{
 if(id&&token){try{const r=await fetchBounded(app+'/api/account',{method:'DELETE',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify({expectedUserId:id,password})});deleted=r.status===204;}catch{}}
 writeFileSync('/tmp/mnw-privacy-case-http-fixture.json',JSON.stringify({id,remaining:id&&!deleted?[id]:[]}),{mode:0o600});
 console.log(JSON.stringify({passed:count,remainingFixtureIds:id&&!deleted?[id]:[]}));if(id&&!deleted)process.exitCode=1;
}
