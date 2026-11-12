// Real PostgreSQL/PGlite execution of the new RPCs and existing save/preview.
// Source extraction, analysis transport and Auth identities are local fixtures.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
const modulePath = process.env.MNW_CASE_PGLITE_MODULE;
const { PGlite } = await import(modulePath ? pathToFileURL(modulePath).href : '@electric-sql/pglite');
const db = new PGlite();
const migration = name => readFileSync(`supabase/migrations/${name}`, 'utf8');
const extract = (sql, start, end = 'end $$;') => {
  const from = sql.indexOf(start), to = sql.indexOf(end, from);
  assert.ok(from >= 0 && to > from, `Missing repository function: ${start}`);
  return sql.slice(from, to + end.length);
};
const youth='11111111-1111-4111-8111-111111111111',other='22222222-2222-4222-8222-222222222222',company='33333333-3333-4333-8333-333333333333',job='44444444-4444-4444-8444-444444444444',otherJob='55555555-5555-4555-8555-555555555555';
let passed=0;
const check=(value,label)=>{assert.ok(value,label);passed++;console.log('PASS '+label);};
const scalar=async(sql,args=[])=>Object.values((await db.query(sql,args)).rows[0])[0];
const as=async(id,operation,role='authenticated')=>{
  await db.exec(`begin;set local role ${role};`);
  await db.query("select set_config('request.jwt.claim.sub',$1,true)",[id??'']);
  try {const value=await operation();await db.exec('commit');return value;}catch(e){await db.exec('rollback');throw e;}
};
const denied=async(operation,code,label)=>{await assert.rejects(operation,e=>e.code===code,label);passed++;console.log('PASS '+label);};
const correct=(revision=1,token='new',selection=[],expectedYouth=youth)=>scalar('select public.correct_my_application_disclosure($1,$2,$3,$4,$5)',[job,selection,token,revision,expectedYouth]);
try {
 await db.exec(`create role authenticated;create role anon;create schema auth;create schema private;
 grant usage on schema auth,private,public to authenticated,anon;
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 create table public.profiles(id uuid primary key,role text);
 create table public.youth_profiles(user_id uuid primary key,token text);
 create table public.jobs(id uuid primary key,company_user_id uuid,title text,status text,is_active boolean,publication_status text);
 create table public.swipe_actions(job_id uuid,youth_user_id uuid,decision text);
 create table public.application_completions(job_id uuid,youth_user_id uuid,status text);
 create table public.notifications(id uuid default gen_random_uuid(),user_id uuid,type text,title text,body text,href text);
 create table private.application_disclosures(job_id uuid,youth_user_id uuid,revision integer default 1,selected_keys text[],source_token text,packet jsonb,matching_input jsonb,updated_at timestamptz default now(),primary key(job_id,youth_user_id));
 create table private.analysis_calls(job_id uuid,youth_user_id uuid);
 create table private.blocks(blocked boolean);insert into private.blocks values(false);
 create function public.users_are_blocked(a uuid,b uuid) returns boolean language sql as $$select blocked from private.blocks$$;
 create function private.build_application_disclosure(j uuid,y uuid,keys text[]) returns jsonb language sql as $$
 select jsonb_build_object('source_token',token,'packet',jsonb_build_object('job_id',j,'youth_user_id',y,'cv',token),'options','[]'::jsonb,'matching_input',jsonb_build_object('cv',token)) from public.youth_profiles where user_id=y$$;
 create function private.shared_application_packet(j uuid,y uuid) returns jsonb language sql as $$
 select packet||jsonb_build_object('revision',revision) from private.application_disclosures where job_id=j and youth_user_id=y$$;
 create function private.enqueue_application_analysis(j uuid,y uuid) returns void language sql as $$insert into private.analysis_calls values(j,y)$$;
 revoke all on all tables in schema public,private from authenticated,anon;
 `);
 const rpcs=migration('20261019155522_n19_private_disclosure_rpcs.sql');
 await db.exec(extract(rpcs,'create function private.get_my_application_disclosure_preview'));
 await db.exec(`create function public.get_my_application_disclosure_preview(p_job_id uuid,p_selection text[]) returns jsonb language sql security invoker as $$select private.get_my_application_disclosure_preview(p_job_id,p_selection)$$;`);
 await db.exec(extract(migration('20261105132128_n19_disclosure_http_conflicts.sql'),'create or replace function private.save_my_application_disclosure'));
 const existingFunctions=async()=>JSON.stringify((await db.query("select n.nspname,p.proname,pg_get_functiondef(p.oid) definition,p.proacl from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('public','private') and p.proname not in ('get_my_application_correction_preview','correct_my_application_disclosure') order by n.nspname,p.proname")).rows);
 const beforeFunctions=await existingFunctions();
 await db.exec(migration('20261112180000_l13_application_corrections.sql'));
 check(await existingFunctions()===beforeFunctions,'migration leaves existing function definitions and execute grants unchanged');
 const disclosures=migration('20261019155114_n19_application_disclosures.sql');
 await db.exec(`create function public.is_verified_company(p uuid) returns boolean language sql as $$select p='${company}'::uuid$$;
 create table public.candidate_assessments(job_id uuid,youth_user_id uuid,company_user_id uuid,result jsonb);
 alter table public.candidate_assessments enable row level security;
 grant select on public.candidate_assessments to authenticated;`);
 await db.exec(extract(disclosures,'create function private.disclosure_company_access','$$;'));
 await db.exec(extract(disclosures,'create function private.can_read_disclosed_assessment','using(private.can_read_disclosed_assessment(job_id,youth_user_id,company_user_id,result));'));
 await db.query("insert into public.profiles values($1,'youth'),($2,'youth'),($3,'company')",[youth,other,company]);
 await db.query("insert into public.youth_profiles values($1,'new'),($2,'other')",[youth,other]);
 for(const j of [job,otherJob]) {
  await db.query("insert into public.jobs values($1,$2,'QA jobb','active',true,'published')",[j,company]);
  await db.query("insert into public.application_completions values($1,$2,'submitted')",[j,youth]);
  await db.query("insert into public.swipe_actions values($1,$2,'interested')",[j,youth]);
  await db.query("insert into private.application_disclosures(job_id,youth_user_id,selected_keys,source_token,packet,matching_input) values($1::uuid,$2::uuid,'{}','old',jsonb_build_object('job_id',$1::uuid::text,'youth_user_id',$2::uuid::text,'cv','old'),'{}')",[j,youth]);
 }
 await db.query("insert into public.candidate_assessments values($1,$2,$3,'{\"policyVersion\":10,\"disclosureRevision\":1}')",[job,youth,company]);
 await db.exec('begin');
 await db.query("select set_config('request.jwt.claim.sub',$1,true)",[youth]);
 await scalar('select private.save_my_application_disclosure($1,$2,$3)',[job,[],'new']);
 check(await scalar('select count(*)::int from public.notifications')===0,'baseline existing save reproduces re-sharing without a recipient notification');
 await db.exec('rollback');
 check(await as(company,()=>scalar('select count(*)::int from public.candidate_assessments'))===1,'actual existing RLS policy permits the original current assessment');
 check(await as(other,()=>scalar('select count(*)::int from public.candidate_assessments'))===0,'actual existing RLS policy denies a foreign account');
 check((await as(youth,()=>scalar('select public.get_my_application_correction_preview($1,null)',[job]))).base_revision===1,'saved preview binds the existing revision');
 const preview=await as(youth,()=>scalar('select public.get_my_application_correction_preview($1,$2)',[job,[]]));
 check(preview.base_revision===1&&!preview.is_saved&&preview.source_token==='new','fresh profile preview retains the base application revision');
 await denied(()=>as(null,()=>correct(),'anon'),'42501','anonymous cannot invoke correction');
 await denied(()=>as(null,()=>correct()),'42501','missing identity denied inside authenticated role');
 await denied(()=>as(company,()=>correct()),'42501','company cannot correct youth material');
 await denied(()=>as(other,()=>correct()),'42501','other youth cannot correct this application');
 await denied(()=>as(youth,()=>correct(1,'new',[],other)),'42501','switched-account request is bound to the preview owner');
 await denied(()=>as(youth,()=>correct(null)),'22023','missing expected revision is rejected');
 await denied(()=>as(youth,()=>correct(2)),'PT409','future revision is rejected');
 await denied(()=>as(youth,()=>correct(1,'stale')),'PT409','stale profile token cannot overwrite the snapshot');
 check(await scalar('select count(*)::int from public.notifications')===0,'failed corrections create no notification');
 // Force a notification failure after the actual save and analysis enqueue.
 await db.exec("alter table public.notifications add constraint fail_notification check(false)");
 await denied(()=>as(youth,()=>correct()),'23514','notification failure aborts the transaction');
 check(await scalar('select revision from private.application_disclosures where job_id=$1',[job])===1,'failed notification rolls back the disclosure revision');
 check(await scalar('select count(*)::int from private.analysis_calls')===0,'failed notification rolls back queued analysis');
 await db.exec('alter table public.notifications drop constraint fail_notification');
 const result=await as(youth,()=>correct());
 check(result.revision===2&&result.cv==='new','correction uses the existing save to publish a new revision');
 check(await as(company,()=>scalar('select count(*)::int from public.candidate_assessments'))===0,'actual existing RLS hides the old assessment after correction');
 await db.query("insert into public.candidate_assessments values($1,$2,$3,'{\"policyVersion\":10,\"disclosureRevision\":2}')",[job,youth,company]);
 check(await as(company,()=>scalar('select count(*)::int from public.candidate_assessments'))===1,'actual existing RLS exposes only the new revision result');
 const notices=(await db.query('select * from public.notifications')).rows;
 check(notices.length===1&&notices[0].user_id===company,'only the current employer receives a receipt');
 check(notices[0].href===`/company?view=kandidater&job=${job}`&&!JSON.stringify(notices[0]).includes(youth)&&!notices[0].body.includes('new'),'notice has job context without candidate identity or source content');
 check(await scalar('select revision from private.application_disclosures where job_id=$1',[otherJob])===1,'another application keeps its previous snapshot');
 check(await scalar('select count(*)::int from private.analysis_calls')===1,'one new analysis request is queued');
 check((await as(youth,()=>correct())).revision===2,'lost receipt retry returns the already committed revision');
 check(await scalar('select count(*)::int from public.notifications')===1&&await scalar('select count(*)::int from private.analysis_calls')===1,'retry creates neither duplicate notice nor duplicate model job');
 await db.query("update public.youth_profiles set token='newer' where user_id=$1",[youth]);
 await denied(()=>as(youth,()=>correct(1,'newer')),'PT409','old application revision cannot overwrite a later share');
 check((await as(youth,()=>correct(2,'newer'))).revision===3,'new preview permits a later correction');
 await db.exec('update private.blocks set blocked=true');
 await denied(()=>as(youth,()=>correct(3,'newer')),'42501','blocked contact is checked even for an idempotent retry');
 await db.exec('update private.blocks set blocked=false');
 await db.query("update public.application_completions set status='withdrawn' where job_id=$1",[job]);
 await denied(()=>as(youth,()=>correct(3,'newer')),'42501','withdrawal stops retry and correction');
 await db.query("update public.application_completions set status='needs_completion' where job_id=$1",[job]);
 await denied(()=>as(youth,()=>correct(3,'newer')),'42501','an unsent application cannot use the correction endpoint');
 await db.query("update public.application_completions set status='submitted' where job_id=$1",[job]);
 await db.query("update public.swipe_actions set decision='skip' where job_id=$1",[job]);
 await denied(()=>as(youth,()=>correct(3,'newer')),'42501','revoked interested swipe denies correction');
 await denied(()=>as(youth,()=>db.query('select * from private.application_disclosures')),'42501','new RPCs do not grant direct disclosure access');
 check((await db.query("select proname,prosecdef,proconfig from pg_proc where proname in ('correct_my_application_disclosure','get_my_application_correction_preview') and pronamespace='public'::regnamespace")).rows.every(r=>!r.prosecdef&&r.proconfig.includes('search_path=""')),'public wrappers stay invokers with an empty search path');
 console.log(`PASS ${passed} application correction PostgreSQL checks (local fixtures only)`);
} finally { await db.close(); }
