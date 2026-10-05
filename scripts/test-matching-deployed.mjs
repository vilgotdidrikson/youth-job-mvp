// Test only disposable QA accounts created by the staging matching fixture.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createClient} from '@supabase/supabase-js';
const actors=JSON.parse(readFileSync(process.env.MATCHING_QA_ACTORS,'utf8'));
const state=JSON.parse(readFileSync(process.env.MATCHING_QA_STATE,'utf8'));
const app=process.env.MATCHING_QA_APP_URL ?? 'https://youth-job-mvp-dev.vercel.app';
assert.ok(['youth-job-mvp-dev.vercel.app','127.0.0.1','localhost'].includes(new URL(app).hostname),'DevStaging/local only');
const body={jobId:state.jobId,youthUserId:state.youthId};
async function api(path,name,body) {
 const actor=actors.find(a=>a.name===name);
 const r=await fetch(app+path,{method:'POST',headers:{'Content-Type':'application/json',...(actor?{Authorization:'Bearer '+actor.token}:{})},body:JSON.stringify(body)});
 const data=await r.json();return {status:r.status,data};
}
for(const name of process.env.MATCHING_QA_QUICK ? [] : ['companyB','youthB',null]){
 for(const path of ['/api/company/candidate-assessment','/api/company/candidate-cv']){
  const r=await api(path,name,body);assert.ok([401,403].includes(r.status),name+': '+path+'='+r.status);
 }
}
if(!process.env.MATCHING_QA_QUICK) console.log('PASS: deployed company/youth/anonymous API denials');
const cv=await api('/api/company/candidate-cv','companyA',body);assert.equal(cv.status,200,JSON.stringify(cv.data));assert.equal(cv.data.kind,'pdf');
const pdf=await fetch(cv.data.url);assert.equal(pdf.status,200);assert.ok((await pdf.text()).startsWith('%PDF-'));console.log('PASS: deployed authorized CV and signed PDF download');
const result=await api('/api/company/candidate-assessment','companyA',body);assert.equal(result.status,200,JSON.stringify(result.data));assert.equal(result.data.pdfStatus,'read',JSON.stringify(result.data));assert.ok(result.data.assessment.criteria.some(c=>c.status==='fulfilled'));console.log('PASS: deployed PDF extraction and candidate assessment; temporary='+Boolean(result.data.temporary));
if(process.env.MATCHING_QA_QUICK) process.exit(0);
const db=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,{accessToken:async()=>actors.find(a=>a.name==='companyA').token,auth:{persistSession:false,autoRefreshToken:false}});
const {data:match,error}=await db.rpc('review_candidate_and_match',{p_job_id:state.jobId,p_youth_user_id:state.youthId,p_decision:'interested'});if(error)throw error;const m=Array.isArray(match)?match[0]:match;assert.ok(m.match_id&&m.conversation_id);state.matchId=m.match_id;state.conversationId=m.conversation_id;
const youth=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,{accessToken:async()=>actors.find(a=>a.name==='youthA').token,auth:{persistSession:false,autoRefreshToken:false}});
const message='Synthetic QA message '+Date.now();const {error:messageError}=await youth.from('messages').insert({conversation_id:m.conversation_id,sender_user_id:state.youthId,message_text:message});if(messageError)throw messageError;
const {data:messages,error:readError}=await db.from('messages').select('message_text').eq('conversation_id',m.conversation_id);if(readError)throw readError;assert.ok(messages.some(i=>i.message_text===message));
console.log('PASS: submitted application → match → conversation → youth message → company read');
const {error:blockError}=await youth.from('user_blocks').insert({blocker_user_id:state.youthId,blocked_user_id:state.companyId});if(blockError)throw blockError;
try {
 for(const route of ['/api/company/candidate-cv','/api/company/candidate-assessment']) assert.equal((await api(route,'companyA',body)).status,403);
 assert.ok((await db.storage.from('youth-documents').download(state.path)).error);
 console.log('PASS: blocking revokes fresh CV reads, assessments and Storage access');
} finally {await youth.from('user_blocks').delete().eq('blocker_user_id',state.youthId).eq('blocked_user_id',state.companyId);}
