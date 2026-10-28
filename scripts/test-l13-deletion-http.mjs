// Only disposable QA accounts in DevStaging; no real recipients or recruitment.
import assert from 'node:assert/strict';
import {randomBytes,randomUUID} from 'node:crypto';
const base='https://vwcfjvwfeatvuisojwrh.supabase.co',app='https://youth-job-mvp-dev.vercel.app',key=process.env.MNW_L13_ANON_KEY;
if(!key)throw Error('Provide MNW_L13_ANON_KEY (public DevStaging key).');
const password=randomBytes(24).toString('base64url'),prefix=`qa-l13-delete-${Date.now()}-${randomUUID().slice(0,8)}`;
const accounts=[];let passed=0,cacheObserved=false,cacheWaitMs=0;
const check=(condition,label)=>{assert.ok(condition,label);passed++;console.log(`PASS ${label}`);};
async function request(url,method='GET',body,token,bytes=false){
 const headers={apikey:key,...(token?{Authorization:`Bearer ${token}`}:{})};
 if(body!==undefined)headers['Content-Type']=bytes?'application/pdf':'application/json';
 const response=await fetch(url,{method,headers,body:body===undefined?undefined:bytes?body:JSON.stringify(body),signal:AbortSignal.timeout(25000)});
 const text=await response.text();let data;try{data=JSON.parse(text);}catch{data=null;}
 return{status:response.status,ok:response.ok,data,isPdf:response.headers.get("content-type")?.includes("application/pdf")&&text.startsWith("%PDF-")};
}
try {
 for(const label of ['a','b']) {
  const result=await request(`${base}/auth/v1/signup`,'POST',{email:`${prefix}-${label}@example.invalid`,password,data:{role:'youth'}});
  if(result.data?.user?.id)accounts.push({id:result.data.user.id,token:result.data.access_token,deleted:false});
  check(result.ok&&typeof result.data?.access_token==='string',`disposable ${label} signs in`);
 }
 const [a,b]=accounts;
 // Safe rollout probe: old code would fail password verification, not delete.
 check((await request(`${app}/api/account`,'DELETE',{password:'intentionally-wrong-qa-password',expectedUserId:a.id},b.token)).status===409,'wrong account rejected before password verification');
 check((await request(`${app}/api/account`,'DELETE',{password,expectedUserId:a.id},b.token)).status===409,'same-password account switch cannot delete the new account');
 check((await request(`${base}/auth/v1/user`,'GET',undefined,b.token)).status===200,'second account remains intact');
 check((await request(`${app}/api/account`,'DELETE',{password:'intentionally-wrong-qa-password',expectedUserId:a.id},a.token)).status===403,'own account still requires the correct password');
 const file=`${a.id}/qa-l13-private.pdf`;
 check((await request(`${base}/storage/v1/object/youth-documents/${file}`,'POST',Buffer.from('%PDF-1.4\n% Fictional QA L13\n%%EOF\n'),a.token,true)).ok,'private disposable PDF uploaded');
 check((await request(`${base}/storage/v1/object/authenticated/youth-documents/${file}`,'GET',undefined,a.token)).status===200,'owner can read PDF before deletion');
 const removed=await request(`${app}/api/account`,'DELETE',{password,expectedUserId:a.id},a.token);
 check(removed.status===204,'confirmed owner deletes account');a.deleted=true;const deletedAt=Date.now();
 check([401,403,404].includes((await request(`${base}/auth/v1/user`,'GET',undefined,a.token)).status),'deleted identity rejects old access token');
 const blocked=result=>[400,401,403,404].includes(result.status);
 const objectUrl=`${base}/storage/v1/object/authenticated/youth-documents/${file}`;
 check(blocked(await request(`${objectUrl}?cacheNonce=${randomUUID()}`,'GET',undefined,a.token)),'fresh private-file request is denied after deletion');
 let cached=await request(objectUrl,'GET',undefined,a.token);
 cacheObserved=cached.status===200&&cached.isPdf;
 // Deletion invalidates the CDN asynchronously. Verify the previously warm URL
 // too; nonce-only testing must not conceal a cache that never expires.
 while(cached.status===200&&cached.isPdf&&Date.now()-deletedAt<90000) {
  await new Promise(resolve=>setTimeout(resolve,5000));
  cached=await request(objectUrl,'GET',undefined,a.token);
 }
 cacheWaitMs=Date.now()-deletedAt;
 check(blocked(cached),'previously cached private URL also stops serving the file within 90 seconds');
 check((await request(`${app}/api/account`,'DELETE',{password,expectedUserId:a.id},a.token)).status===401,'repeat deletion is denied');
} finally {
 for(const account of accounts.filter(a=>!a.deleted&&a.token)) {
  try{account.deleted=(await request(`${app}/api/account`,'DELETE',{password,expectedUserId:account.id},account.token)).status===204;}catch{/* Report only fixture IDs, never credentials. */}
 }
 const remaining=accounts.filter(a=>!a.deleted).map(a=>a.id);
 console.log(JSON.stringify({fixturePrefix:prefix,passed,cacheObserved,cacheWaitMs,remainingFixtureIds:remaining}));
 if(remaining.length)process.exitCode=1;
}
