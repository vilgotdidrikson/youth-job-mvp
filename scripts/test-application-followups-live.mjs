// DEV-only integration workflow. Seed disposable accounts/jobs separately; never use real users.
import assert from 'node:assert/strict';
import { createClient } from '@supabase/supabase-js';
const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
assert.equal(new URL(url).hostname,'vwcfjvwfeatvuisojwrh.supabase.co','This workflow is restricted to DEV');
const app=process.env.MNW_TEST_APP_URL ?? 'https://youth-job-mvp-dev.vercel.app';
assert.equal(new URL(app).hostname,'youth-job-mvp-dev.vercel.app');
const jobId=process.env.MNW_TEST_JOB_ID,youthId=process.env.MNW_TEST_YOUTH_ID;
for(const value of [jobId,youthId,process.env.MNW_TEST_PASSWORD,process.env.MNW_TEST_YOUTH_EMAIL,process.env.MNW_TEST_COMPANY_EMAIL]) assert.ok(value,'Missing disposable test fixture configuration');
async function login(email){const client=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});const {data,error}=await client.auth.signInWithPassword({email,password:process.env.MNW_TEST_PASSWORD});if(error)throw new Error('Disposable test login failed: '+error.message);return {client,token:data.session.access_token};}
async function post(path,token,body){const response=await fetch(app+path,{method:'POST',headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},body:JSON.stringify(body)});return {status:response.status,body:await response.json()};}
const youth=await login(process.env.MNW_TEST_YOUTH_EMAIL),company=await login(process.env.MNW_TEST_COMPANY_EMAIL);
try {
  assert.equal((await post('/api/youth/applications/submit',null,{action:'prepare',jobId})).status,401);
  assert.equal((await post('/api/youth/applications/submit',company.token,{action:'prepare',jobId})).status,403);
  assert.equal((await post('/api/youth/applications/followups',company.token,{jobId})).status,403);
  assert.equal((await post('/api/youth/applications/followups',youth.token,{jobId:'a4000000-0000-4000-8000-000000000099'})).status,403);
  const start=Date.now();
  const submitted=await post('/api/youth/applications/submit',youth.token,{action:'prepare',jobId});
  assert.equal(submitted.status,200,JSON.stringify(submitted.body));assert.equal(submitted.body.application.status,'submitted');
  console.log('Submission returned successfully in',Date.now()-start,'ms');
  // No follow-up API call: questions must be created by server-side after().
  let questions=[];
  for(let attempt=0;attempt<12;attempt++){
    const {data,error}=await youth.client.from('application_followups').select('*').eq('job_id',jobId);assert.equal(error,null);questions=data;
    if(questions.length===2) break;
    await new Promise(resolve=>setTimeout(resolve,3000));
  }
  assert.equal(questions.length,2,'Server-side submission analysis did not create the two missing-criterion questions');
  assert.ok(!questions.some(q=>q.criterion_label==='B-körkort'),'Known CV fact was asked again');
  console.log('PASS: server created individual questions without another browser request.');
  const cached=await post('/api/youth/applications/followups',youth.token,{jobId});assert.equal(cached.body.cached,true);assert.equal(cached.body.queued,0);
  const weekend=questions.find(q=>q.criterion_label==='Kan arbeta helger'),cash=questions.find(q=>q.criterion_label==='Erfarenhet av kassa');
  const saved=await youth.client.rpc('save_my_application_followup_answers',{p_job_id:jobId,p_answers:{[weekend.id]:'Jag kan arbeta helger.'},p_skip_ids:[cash.id]});assert.equal(saved.error,null);assert.equal(saved.data.pending,0);
  const assessed=await post('/api/company/candidate-assessment',company.token,{jobId,youthUserId:youthId});
  assert.equal(assessed.status,200);assert.equal(assessed.body.assessment.criteria.find(c=>c.label==='Kan arbeta helger').status,'fulfilled');assert.equal(assessed.body.followups.queued,0);
  const sharedCache=await post('/api/youth/applications/followups',youth.token,{jobId});assert.equal(sharedCache.body.cached,true,'Youth and company should share the matching source hash');
  const {data:input,error:inputError}=await company.client.rpc('get_candidate_assessment_input',{p_job_id:jobId,p_youth_user_id:youthId});assert.equal(inputError,null);assert.equal(input.followup_answers.length,1);assert.equal(input.followup_answers[0].answer,'Jag kan arbeta helger.');
  const {data:notifications,error:noticeError}=await company.client.from('notifications').select('href').eq('title','Ansökan kompletterad').order('created_at',{ascending:false}).limit(1);assert.equal(noticeError,null);assert.equal(notifications[0].href,`/company?view=kandidater&job=${jobId}&candidate=${youthId}`);
  const {data:original}=await youth.client.from('application_completions').select('status,followup_analysis_started_at').eq('job_id',jobId).single();assert.equal(original.status,'submitted');assert.equal(original.followup_analysis_started_at,null);
  console.log('PASS: live DEV authorization, post-submission generation, shared cache, answer/skip, existing application, company reassessment and direct candidate notification.');
} finally { await youth.client.auth.signOut();await company.client.auth.signOut(); }
