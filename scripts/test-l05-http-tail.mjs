// DevStaging-only continuation of the 49 passing core HTTP checks. No media uploads.
import assert from 'node:assert/strict';
import {createInterface} from 'node:readline';
import {once} from 'node:events';
console.log('Ready for private disposable QA configuration on stdin.');
const input=createInterface({input:process.stdin});const[line]=await once(input,'line');input.close();process.stdin.pause();
const cfg=JSON.parse(line),base='https://vwcfjvwfeatvuisojwrh.supabase.co';
assert.equal(cfg.actors.length,5);for(const a of cfg.actors)assert.match(a.email,/^qa-l05-http-[0-9a-f-]+@example\.invalid$/);
const actors=Object.fromEntries(cfg.actors.map(a=>[a.name,a])),tokens={};let count=0;
const check=(condition,label)=>{assert.ok(condition,label);console.log('PASS: '+label);count++;};
async function request(url,actor,method='POST',body){
 const response=await fetch(url,{method,headers:{apikey:cfg.anonKey,'Content-Type':'application/json',...(actor?{Authorization:`Bearer ${tokens[actor]}`}:{})},body:body===undefined?undefined:JSON.stringify(body),cache:'no-store',signal:AbortSignal.timeout(60000)});
 const raw=await response.text();let data;try{data=JSON.parse(raw);}catch{data=raw;}return{ok:response.ok,status:response.status,data};
}
const rpc=(actor,name,body={})=>request(`${base}/rest/v1/rpc/${name}`,actor,'POST',body);
try{
 await Promise.all(cfg.actors.map(async a=>{const r=await request(`${base}/auth/v1/token?grant_type=password`,null,'POST',{email:a.email,password:a.password});assert.ok(r.ok&&r.data?.access_token,`Authentication failed: ${a.name} (${r.status})`);tokens[a.name]=r.data.access_token;}));
 check(Object.keys(tokens).length===5,'five disposable roles authenticated');
 const report=await rpc('youth','submit_moderation_report',{p_target_type:'conversation',p_target_id:cfg.conversation,p_reason:'harassment',p_details:'QA L05 HTTP fictional report'});check(report.ok,'authorized test report submitted');
 check((await rpc('admin','review_moderation_report_checked',{p_report_id:report.data,p_status:'resolved',p_expected_status:'open',p_resolution_note:'QA final continuation'})).ok,'admin saves final decision');
 const legacy=await rpc('admin','review_moderation_report',{p_report_id:report.data,p_status:'reviewing',p_resolution_note:null});check(legacy.status===409&&legacy.data?.code==='PT409','legacy endpoint returns HTTP 409 without reopening final decision');
 const stale=await rpc('admin','review_moderation_report_checked',{p_report_id:report.data,p_status:'dismissed',p_expected_status:'open',p_resolution_note:'QA stale decision'});check(stale.status===409&&stale.data?.code==='PT409','stale checked decision returns HTTP 409 without retry loop');
 check((await rpc('youth','block_conversation_user',{p_conversation_id:cfg.conversation})).ok,'youth blocks contact');
 check((await rpc('company','block_conversation_user',{p_conversation_id:cfg.conversation})).ok,'company creates reciprocal block');
 check((await rpc('youth','unblock_user',{p_blocked_user_id:actors.company.id})).ok,'youth removes only own block');
 const send=body=>request(`${base}/rest/v1/messages`,'youth','POST',{conversation_id:cfg.conversation,sender_user_id:actors.youth.id,...body});
 const denied=await send({message_text:'QA reciprocal block attempt'});check(!denied.ok&&[400,401,403,409].includes(denied.status),'remaining reciprocal block prevents sending');
 check((await rpc('company','unblock_user',{p_blocked_user_id:actors.youth.id})).ok,'company removes own block');
 check((await send({message_text:'QA restored communication'})).ok,'communication restored after both sides unblock');
 const cv=await request('https://youth-job-mvp-dev.vercel.app/api/company/candidate-cv','wrongCompany','POST',{jobId:cfg.job,youthUserId:actors.youth.id});check(cv.status===403,'deployed candidate-CV API denies wrong company');
 console.log(JSON.stringify({passed:count,fixtureScope:'qa-l05-http',requiresSqlCleanup:true,noMediaUploaded:true}));
}catch(error){console.error('FAIL:',error.message);process.exitCode=1;}
finally{process.stdin.destroy();}
