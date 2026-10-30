import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire,Module} from 'node:module';
import ts from 'typescript';
import {unzipSync,strFromU8} from 'fflate';
const require=createRequire(import.meta.url),oldLoad=Module._load,oldTs=Module._extensions['.ts'];
Module._load=function(n,...args){return n==='server-only'?{}:oldLoad.call(this,n,...args);};
Module._extensions['.ts']=(m,f)=>m._compile(ts.transpileModule(readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText,f);
const {buildStructuredPersonalDataExport:build,StructuredExportError}=require('../lib/server/structured-personal-data-export.ts');
const inventory=require('../docs/privacy/personal-data-inventory.json');
const subject='11111111-1111-4111-8111-111111111111',other='22222222-2222-4222-8222-222222222222',time='2026-10-30T10:00:00.000Z';
let passed=0;
function test(name,fn){fn();passed++;console.log('PASS '+name);}
function fixture(){
 const rows={
  'public.profiles':[{id:subject,role:'youth'}],
  'public.youth_profiles':[{user_id:subject,onboarding_completed:true,cv_generated:false,cv_uploaded:null,short_onboarding_completed:true,recruitment_profile_version:3,updated_at:time,cv_text:'QA_PRIVATE',documents:[{url:'QA_PRIVATE'}],recruitment_profile:{text:'QA_PRIVATE'}}],
  'public.youth_application_drafts':[{id:other,youth_user_id:subject,job_id:other,created_at:time,updated_at:time}],
  'public.youth_saved_jobs':[{id:other,youth_user_id:subject,job_id:other,created_at:time}],
  'public.youth_job_impressions':[{youth_user_id:subject,job_id:other,first_seen_at:time}],
  'public.youth_job_dismissals':[{youth_user_id:subject,job_id:other,dismissed_at:time}],
  'public.swipe_actions':[{id:other,youth_user_id:subject,job_id:other,decision:'interested',created_at:time}],
  'public.application_workplace_preferences':[{youth_user_id:subject,job_id:other,workplace_id:other,updated_at:time,workplace_snapshot:{contact:'QA_PRIVATE'}}],
  'public.messages':[{message_text:'QA_PRIVATE',sender_user_id:other}],
 };
 const categories=[...inventory.groups,...inventory.outsideCatalog].map(g=>({id:g.id,reviewState:'pending',sources:(g.relations??[]).map(relation=>rows[relation]?{relation,status:'collected',rows:rows[relation]}:{relation,status:'not_collected'})}));
 const b={subjectId:subject,reviewState:'pending',consistency:'non_transactional',collection:{version:1,subjectId:subject,startedAt:time,finishedAt:time,reviewState:'pending',visibility:'caller_rls',consistency:'non_transactional',categories},cv:{files:[{ownerId:subject,bucketId:'youth-documents',name:'dokument-1.pdf',mimeType:'application/pdf',status:'included',bytes:new TextEncoder().encode('%PDF-1.7 QA_PRIVATE')}]}};
 const m={exportId:other,createdAt:time,information:{controller:'QA',contact:'qa@example.invalid',purposes:['QA'],recipients:['QA'],retention:['QA'],sources:['QA'],rights:['QA'],automatedProcessing:['QA']}};
 return {b,m,source:relation=>categories.flatMap(c=>c.sources).find(s=>s.relation===relation)};
}
function rejects(change){const f=fixture();change(f);assert.throws(()=>build(f.b,f.m),e=>e instanceof StructuredExportError&&!e.message.includes('QA_PRIVATE'));}
try{
 test('automatic real ZIP contains all eight approved structured sources and no text or original bytes',()=>{
  const {b,m}=fixture(),out=build(b,m),entries=unzipSync(out.bytes);
  const account=JSON.parse(strFromU8(entries['uppgifter/account.json'])),discovery=JSON.parse(strFromU8(entries['uppgifter/own-discovery.json']));
  assert.equal(account.records.length,2);assert.equal(discovery.records.length,6);
  assert.equal(account.records[0].role,'youth');assert.equal(discovery.records.find(r=>r.source==='public.swipe_actions').decision,'interested');
  assert.equal(account.records[1].cv_uploaded,null);assert.equal(account.records[1].recruitment_profile_version,3);
  assert.equal(out.manifest.coverage,'needs_completion');assert.equal(out.manifest.pendingCategories.length,24);assert.equal(out.manifest.files.length,0);
  assert.equal(account.status,'partially_included');assert.equal(discovery.needsCompletion,true);
  for(const bytes of Object.values(entries))assert.ok(!strFromU8(bytes).includes('QA_PRIVATE'));
  assert.match(strFromU8(entries['LAS-MIG.html']),/Delvis inkluderad/);
 });
 for(const relation of ['public.youth_application_drafts','public.youth_saved_jobs','public.youth_job_impressions','public.youth_job_dismissals','public.swipe_actions','public.application_workplace_preferences'])test('foreign owned activity aborts entire package: '+relation,()=>rejects(f=>{f.source(relation).rows[0].youth_user_id=other;}));
 for(const status of ['unavailable','not_collected'])test('unread source remains incomplete: '+status,()=>{
  const f=fixture();f.source('public.youth_saved_jobs').status=status;delete f.source('public.youth_saved_jobs').rows;
  const out=build(f.b,f.m),data=JSON.parse(strFromU8(unzipSync(out.bytes)['uppgifter/own-discovery.json']));
  assert.ok(!data.records.some(r=>r.source==='public.youth_saved_jobs'));assert.equal(out.manifest.coverage,'needs_completion');
 });
 test('empty visible activity does not become absent or not applicable',()=>{const f=fixture();for(const s of f.b.collection.categories.find(c=>c.id==='own-discovery').sources)if(s.status==='collected')s.rows=[];const out=build(f.b,f.m);assert.ok(out.manifest.pendingCategories.includes('own-discovery'));assert.equal(unzipSync(out.bytes)['uppgifter/own-discovery.json'],undefined);});
 for(const accountRole of ['company','private'])test('non-youth account only projects own protected role: '+accountRole,()=>{
  const f=fixture();f.source('public.profiles').rows[0].role=accountRole;for(const s of f.b.collection.categories.flatMap(c=>c.sources))if(s.relation!=='public.profiles'&&s.status==='collected')s.rows=[];
  const out=build(f.b,f.m),a=JSON.parse(strFromU8(unzipSync(out.bytes)['uppgifter/account.json']));assert.equal(a.records.length,1);assert.equal(a.records[0].role,accountRole);
 });
 for(const mode of ['foreign','role','empty','duplicate','unread'])test('invalid protected account fails: '+mode,()=>rejects(f=>{const s=f.source('public.profiles');if(mode==='foreign')s.rows[0].id=other;if(mode==='role')s.rows[0].role='admin';if(mode==='empty')s.rows=[];if(mode==='duplicate')s.rows.push(s.rows[0]);if(mode==='unread')s.status='not_collected';}));
 test('non-youth cannot project unexpected youth rows',()=>rejects(f=>{f.source('public.profiles').rows[0].role='company';}));
 for(const mode of ['missing','duplicate','misplaced','duplicate-source','subject','version','future','before','pending','visibility'])test('invalid collection envelope fails: '+mode,()=>rejects(f=>{
  const c=f.b.collection;
  if(mode==='missing')c.categories.pop();if(mode==='duplicate')c.categories[1]=c.categories[0];
  if(mode==='misplaced'){const s=f.source('public.swipe_actions');c.categories.find(c=>c.id==='own-discovery').sources=c.categories.find(c=>c.id==='own-discovery').sources.filter(x=>x!==s);c.categories[0].sources.push(s);}
  if(mode==='duplicate-source')c.categories[0].sources.push(f.source('public.profiles'));
  if(mode==='subject')c.subjectId=other;if(mode==='version')c.version=2;if(mode==='future')c.finishedAt='2099-01-01T00:00:00Z';if(mode==='before')c.startedAt='2099-01-01T00:00:00Z';if(mode==='pending')c.categories[0].reviewState='approved';if(mode==='visibility')c.visibility='service_role';
 }));
 for(const [relation,field,value] of [
  ['public.swipe_actions','decision','QA_PRIVATE'],['public.youth_saved_jobs','job_id','QA_PRIVATE'],['public.youth_saved_jobs','created_at','QA_PRIVATE'],
  ['public.youth_profiles','onboarding_completed','QA_PRIVATE'],['public.youth_profiles','recruitment_profile_version',-1],['public.youth_profiles','recruitment_profile_version',1.5],
  ['public.application_workplace_preferences','workplace_id',null],['public.youth_job_dismissals','dismissed_at',undefined],
 ])test('malformed allowed scalar aborts rather than publishing arbitrary text: '+field+'/'+value,()=>rejects(f=>{const r=f.source(relation).rows[0];if(value===undefined)delete r[field];else r[field]=value;}));
 test('duplicate activity identities abort instead of hiding pagination errors',()=>rejects(f=>{const s=f.source('public.youth_saved_jobs');s.rows.push(s.rows[0]);}));
 test('unknown columns never become automatically exportable',()=>{const f=fixture();f.source('public.profiles').rows[0].futureColumn={secret:'QA_PRIVATE'};const out=build(f.b,f.m);for(const bytes of Object.values(unzipSync(out.bytes)))assert.ok(!strFromU8(bytes).includes('QA_PRIVATE'));});
 test('getters cannot run even on excluded raw columns',()=>{let calls=0;rejects(f=>Object.defineProperty(f.source('public.profiles').rows[0],'extra',{enumerable:true,get(){calls++;return 'QA_PRIVATE';}}));assert.equal(calls,0);});
 test('nulls and offset timestamps remain valid structured scalars',()=>{const f=fixture();f.source('public.youth_saved_jobs').rows[0].created_at='2026-10-30T12:00:00.123456+02:00';f.source('public.youth_profiles').rows[0].updated_at=null;assert.equal(build(f.b,f.m).manifest.coverage,'needs_completion');});
 test('projection does not mutate source bundle',()=>{const f=fixture(),before=JSON.stringify(f.b);build(f.b,f.m);assert.equal(JSON.stringify(f.b),before);});
 console.log(`PASS ${passed} structured export policy checks. Fictitious local sources and actual ZIP; no live data or public endpoint.`);
}finally{Module._load=oldLoad;if(oldTs)Module._extensions['.ts']=oldTs;else delete Module._extensions['.ts'];}
