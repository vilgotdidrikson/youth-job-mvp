// Exact DevStaging only; one fictional account and private PDF, no AI or real email.
import assert from 'node:assert/strict';
import {createInterface} from 'node:readline';
import {once} from 'node:events';
import {randomUUID} from 'node:crypto';
console.log('Ready for private disposable QA configuration on stdin.');
const input=createInterface({input:process.stdin});const[line]=await once(input,'line');input.close();process.stdin.pause();
const cfg=JSON.parse(line),base='https://vwcfjvwfeatvuisojwrh.supabase.co',app='https://youth-job-mvp-dev.vercel.app';
assert.match(cfg.id,/^[0-9a-f-]{36}$/);assert.equal(cfg.email,`qa-l06-http-${cfg.id}@example.invalid`);
const nextPassword=randomUUID()+randomUUID(),path=`${cfg.id}/qa-l06-private.pdf`;let token,password=cfg.password,passed=0,deleted=false;
const check=(ok,label)=>{assert.ok(ok,label);passed++;console.log('PASS: '+label);};
async function request(url,method='GET',body,auth=token,headers={}){
 const response=await fetch(url,{method,headers:{apikey:cfg.anonKey,...(auth?{Authorization:`Bearer ${auth}`}:{}) ,...(body===undefined?{}:{'Content-Type':'application/json'}),...headers},body:body instanceof Uint8Array?body:body===undefined?undefined:JSON.stringify(body),cache:'no-store',signal:AbortSignal.timeout(60000)});
 const raw=await response.text();let data;try{data=raw?JSON.parse(raw):null;}catch{data=raw;}return{ok:response.ok,status:response.status,data};
}
const login=p=>request(`${base}/auth/v1/token?grant_type=password`,'POST',{email:cfg.email,password:p},null);
try{
 const settings=await request(`${base}/auth/v1/settings`,'GET',undefined,null);check(settings.ok,'public auth settings available');console.log(JSON.stringify({emailConfirmationRequired:settings.data.mailer_autoconfirm===false,signupDisabled:settings.data.disable_signup===true}));
 const wrong=await login('intentionally-wrong-qa-password');check(wrong.status===400,'wrong password denied');
 const signed=await login(password);check(signed.ok&&signed.data.user.id===cfg.id,'valid fictitious account signs in');token=signed.data.access_token;
 check((await request(`${base}/auth/v1/user`)).data?.id===cfg.id,'server verifies current user');
 const changed=await request(`${base}/auth/v1/user`,'PUT',{password:nextPassword});check(changed.ok,'real authenticated password update succeeds');password=nextPassword;
 check((await login(cfg.password)).status===400,'old password no longer authenticates');
 const fresh=await login(password);check(fresh.ok&&fresh.data.user.id===cfg.id,'new password authenticates');token=fresh.data.access_token;
 check((await request(`${base}/auth/v1/logout?scope=global`,'POST')).ok,'server confirms global sign-out');
 const refresh=await request(`${base}/auth/v1/token?grant_type=refresh_token`,'POST',{refresh_token:fresh.data.refresh_token},null);check(!refresh.ok&&[400,401,403].includes(refresh.status),'signed-out refresh token cannot restore session');
 const afterLogout=await login(password);check(afterLogout.ok,'account can sign in again after logout');token=afterLogout.data.access_token;
 const uploaded=await request(`${base}/storage/v1/object/youth-documents/${path}`,'POST',Buffer.from('%PDF-1.4\n% QA L06 fictional private document\n%%EOF\n'),token,{'Content-Type':'application/pdf'});check(uploaded.ok,'disposable account uploads a private PDF');
 check((await request(`${app}/api/account`,'DELETE',{password:'intentionally-wrong-qa-password',expectedUserId:cfg.id})).status===403,'account deletion requires correct password');
 check((await request(`${base}/auth/v1/user`)).data?.id===cfg.id,'failed deletion preserves account');
 const removed=await request(`${app}/api/account`,'DELETE',{password,expectedUserId:cfg.id});check(removed.status===204,'verified account deletion removes identity and files');deleted=true;
 check([401,403,404].includes((await request(`${base}/auth/v1/user`)).status),'deleted user cannot authenticate using old access token');
 const protectedApi=await request(`${app}/api/company/candidate-cv`,'POST',{});check(protectedApi.status===401,'protected app API rejects deleted identity');
 const profile=await request(`${base}/rest/v1/youth_profiles?select=user_id&user_id=eq.${cfg.id}`);check((profile.ok&&profile.data.length===0)||[401,403].includes(profile.status),'deleted private profile is inaccessible');
 const file=await request(`${base}/storage/v1/object/authenticated/youth-documents/${path}`);check([400,401,403,404].includes(file.status),'deleted private PDF cannot be downloaded');
 console.log(JSON.stringify({passed,deleted,fixtureScope:'qa-l06-http',emailDeliveryTested:false}));
}catch(error){console.error('FAIL:',error.message);process.exitCode=1;}
finally{
 if(!deleted&&token){let result=await request(`${app}/api/account`,'DELETE',{password,expectedUserId:cfg.id});if(result.status===403)result=await request(`${app}/api/account`,'DELETE',{password:nextPassword,expectedUserId:cfg.id});deleted=result.status===204;console.log(JSON.stringify({cleanupDeleted:deleted,fixtureScope:'qa-l06-http'}));}
 process.stdin.destroy();
}
