// DEV-only. Seed a new disposable application with one static question before each run.
// manual: weekend question; cv: B-driving-license question already answered in the fixture CV.
import assert from 'node:assert/strict';
import {createClient} from '@supabase/supabase-js';
const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
assert.equal(new URL(url).hostname,'vwcfjvwfeatvuisojwrh.supabase.co');
const app=process.env.MNW_TEST_APP_URL ?? 'https://youth-job-mvp-dev.vercel.app';
assert.equal(new URL(app).hostname,'youth-job-mvp-dev.vercel.app');
const mode=process.env.MNW_TEST_STATIC_MODE ?? 'manual';
assert.ok(['manual','cv'].includes(mode));
for (const key of ['MNW_TEST_JOB_ID','MNW_TEST_YOUTH_EMAIL','MNW_TEST_PASSWORD']) assert.ok(process.env[key],'Missing disposable test fixture configuration: '+key);
const client=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
const {data,error}=await client.auth.signInWithPassword({email:process.env.MNW_TEST_YOUTH_EMAIL,password:process.env.MNW_TEST_PASSWORD});assert.equal(error,null);
const jobId=process.env.MNW_TEST_JOB_ID;
async function post(path,body){const r=await fetch(app+path,{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+data.session.access_token},body:JSON.stringify(body)});return{status:r.status,body:await r.json()};}
try{
 const prepared=await post('/api/youth/applications/submit',{action:'prepare',jobId});assert.equal(prepared.status,200);assert.equal(prepared.body.application.status,'needs_completion');assert.equal(prepared.body.application.questions.length,1);
 const initial=await client.from('application_followups').select('id').eq('job_id',jobId);assert.equal(initial.data.length,0,'No followups should be shared before submission');
 const answered=mode==='manual' ? await post('/api/youth/applications/submit',{action:'answers',jobId,answers:{[prepared.body.application.questions[0].id]:'Jag kan arbeta helger.'},submit:true}) : await post('/api/youth/applications/analyze',{jobId});
 assert.equal(answered.status,200);
 if(mode==='manual') assert.equal(answered.body.application.status,'submitted');
 else assert.equal(answered.body.sent,1,'Existing CV evidence should complete the static question');
 let questions=[];for(let i=0;i<12;i++){const {data,error}=await client.from('application_followups').select('criterion_label').eq('job_id',jobId);assert.equal(error,null);questions=data;if(questions.length===(mode==='manual'?1:2))break;await new Promise(resolve=>setTimeout(resolve,3000));}
 assert.deepEqual(questions.map(q=>q.criterion_label).sort(),mode==='manual'?['Erfarenhet av kassa']:['Erfarenhet av kassa','Kan arbeta helger']);
 const original=await client.from('application_completions').select('status').eq('job_id',jobId).single();assert.equal(original.error,null);assert.equal(original.data.status,'submitted');
 console.log('PASS:',mode,'static answer submits the existing application; server asks only the remaining unknown criteria.');
}finally{await client.auth.signOut();}
