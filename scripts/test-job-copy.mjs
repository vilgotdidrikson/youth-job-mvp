import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire,Module} from 'node:module';
import path from 'node:path';
import ts from 'typescript';
const require=createRequire(import.meta.url);
Module._extensions['.ts']=(module,file)=>module._compile(ts.transpileModule(readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,file);
const {createCopyJobDraft,draftSalary,validateDraftPublication,hasJobDraftContent,EMPTY_JOB_FORM}=require('../lib/job-copy.ts');
const job={id:'original-job',title:'Testannons',description:'Beskrivning med datum som ska granskas',company_user_id:'company-a',company_name:'Testföretag',city:'Stockholm',address:'Testgatan 1',postal_code:'11111',longitude:18,latitude:59,salary_per_hour:'Enligt avtal, 135 kr/tim + OB',employment_type:'Deltid',category:'Butik',requirements:'Publik information som skiljer sig från urvalet',benefits:'Introduktion',image_url:'https://example.invalid/original.jpg',status:'active',is_active:true,publication_status:'published',open_positions:3,created_at:'old-publication',min_age:16,max_age:24,is_boosted:true,applications:[{private:'must not copy'}],hires:12};
const criteria={job_id:job.id,role_summary:'Sparad rollbeskrivning',must_haves:['Kan arbeta helger'],trainable_requirements:['Kassa'],top_traits:['Noggrann'],candidate_questions:[{id:'old-question',question:'När kan du börja?'}],profile_version:7};
const original=structuredClone({job,criteria});let next=0;
for(const status of ['active','paused','closed']){
const draft=createCopyJobDraft({...job,status},criteria,()=>`new-place-${++next}`);
assert.equal(draft.title,job.title);assert.equal(draft.description,job.description);assert.equal(draft.listingRequirements,job.requirements);assert.equal(draft.requirements,'Kan arbeta helger');assert.equal(draft.matchRoleSummary,criteria.role_summary);assert.deepEqual(draft.candidateQuestions,['När kan du börja?']);assert.equal(draft.salaryText,job.salary_per_hour);assert.equal(draftSalary(draft),job.salary_per_hour);assert.equal(draft.openPositions,'3');assert.deepEqual(draft.imageUrls,['https://example.invalid/original.jpg']);
for(const field of ['id','company_user_id','company_name','status','is_active','publication_status','created_at','is_boosted','applications','hires','profile_version','job_id'])assert.ok(!(field in draft),field+' must not follow a copy');
assert.throws(()=>validateDraftPublication(draft),/Granska/);validateDraftPublication({...draft,copyReviewed:true});
const reloaded=JSON.parse(JSON.stringify(draft));assert.deepEqual(reloaded,draft);assert.equal(reloaded.copyReviewed,false);
draft.workplaces[0].city='Changed';draft.candidateQuestions.push('New question');draft.imageUrls.push('https://example.invalid/new.jpg');
assert.deepEqual({job,criteria},original,'copy edits may never mutate original data');
}
const places=[{id:'old-a',name:'A',address:'A 1',postal_code:'11111',city:'Stockholm',longitude:18,latitude:59},{id:'old-b',name:'B',address:'B 1',postal_code:'22222',city:'Göteborg',longitude:12,latitude:58}];
const multi=createCopyJobDraft({...job,workplaces:places},null,()=>`fresh-${++next}`);assert.equal(multi.workplaces.length,2);assert.notEqual(multi.workplaces[0].id,places[0].id);assert.notEqual(multi.workplaces[1].id,places[1].id);assert.equal(multi.workplaces[1].city,'Göteborg');assert.equal(multi.requirements,job.requirements);assert.equal(createCopyJobDraft({...job,open_positions:0},null).openPositions,'1');
for(const openPositions of ['0','-1','1.5','NaN','99999999999999999'])assert.throws(()=>validateDraftPublication({...EMPTY_JOB_FORM,openPositions}));
assert.throws(()=>validateDraftPublication({...EMPTY_JOB_FORM,imagePending:true}),/bilden/);
assert.equal(hasJobDraftContent(EMPTY_JOB_FORM),false);assert.equal(hasJobDraftContent({...EMPTY_JOB_FORM,category:'Butik'}),true);assert.equal(hasJobDraftContent({...EMPTY_JOB_FORM,imageUrls:['https://example.invalid/a.jpg']}),true);
assert.equal(draftSalary({...EMPTY_JOB_FORM,salaryFrom:'120',salaryTo:'150'}),'120–150 kr/tim');
let currentUser='company-a',role='company',reads=0,failCriteria=false,switchDuringLoad=false;
const load=Module._load;
Module._load=function(request,parent,...rest){if(request==='@/lib/auth')return {getCurrentUser:async()=>currentUser?{id:currentUser}:null,getUserProfile:async()=>({role})};if(request==='@/lib/jobs')return {getJobById:async()=>{reads++;return structuredClone(job)}};if(request==='@/lib/match-profiles')return {getJobMatchProfile:async()=>{if(failCriteria)throw new Error('criteria unavailable');if(switchDuringLoad)currentUser='company-b';return structuredClone(criteria)}};if(request.startsWith('@/'))return load.call(this,path.resolve(request.slice(2)),parent,...rest);return load.call(this,request,parent,...rest);};
try{
const {loadOwnJobCopy}=require('../lib/job-copy-client.ts');
assert.equal((await loadOwnJobCopy(job.id)).title,job.title);
currentUser='company-b';await assert.rejects(loadOwnJobCopy(job.id),/egna annonser/);
currentUser=null;await assert.rejects(loadOwnJobCopy(job.id),/Logga in/);
currentUser='company-a';role='youth';const before=reads;await assert.rejects(loadOwnJobCopy(job.id),/Logga in/);assert.equal(reads,before);
role='company';failCriteria=true;await assert.rejects(loadOwnJobCopy(job.id),/criteria unavailable/);failCriteria=false;switchDuringLoad=true;await assert.rejects(loadOwnJobCopy(job.id),/Kontot har ändrats/);
}finally{Module._load=load;}
console.log('PASS copy drafts: active/paused/closed, editable allowlist, independent criteria/public text, exact salary, image and multi-location persistence, fresh IDs, review/position/image guards, foreign owner and session-change denial.');
