// Fictitious rows only. Deliberately mixed raw content must never enter the ZIP.
export const HISTORY_SUBJECT='11111111-1111-4111-8111-111111111111';
export const HISTORY_OTHER='22222222-2222-4222-8222-222222222222';
export const HISTORY_TIME='2026-10-30T10:00:00.000Z';
export function historyRows(role='youth') {
 const own=HISTORY_SUBJECT,id=HISTORY_OTHER,t=HISTORY_TIME;
 const company={
  'public.company_profiles':[{user_id:own,verification_status:'verified',verification_submitted_at:t,verified_at:t,updated_at:t,administrator:'QA_PRIVATE',verification_rejection_reason:'QA_PRIVATE',verified_by_user_id:id}],
  'public.company_billing_details':[{user_id:own,country_code:'SE',version:2,updated_at:t,invoice_email:'QA_PRIVATE',reference:'QA_PRIVATE',address_line1:'QA_PRIVATE'}],
 };
 const owner={
  'public.jobs':[{id,company_user_id:own,status:'closed',publication_status:'published',job_kind:role==='private'?'private_task':'employment',is_active:false,job_category_manual:true,created_at:t,first_published_at:null,title:'QA_PRIVATE',description:'QA_PRIVATE',workplaces:[{contact:'QA_PRIVATE'}],image_url:'QA_PRIVATE'}],
  'public.company_match_profiles':[{company_user_id:own,profile_version:4,created_at:t,updated_at:t,culture_summary:'QA_PRIVATE',source_notes:'QA_PRIVATE',company_values:['QA_PRIVATE']}],
  'public.company_recruitment_controls':[{company_user_id:own,restriction:'limited',changed_at:t,changed_by:id,reason:'QA_PRIVATE'}],
  'public.recruitment_outcomes':[{company_user_id:own,job_id:id,outcome:'no_hire',recorded_at:t}],
 };
 const youth={
  'public.application_completions':[{youth_user_id:own,job_id:id,profile_version:1,status:'withdrawn',created_at:t,submitted_at:t,supplemented_at:null,question_batch_version:0,withdrawn_at:t,answers:{answer:'QA_PRIVATE'},questions:[{text:'QA_PRIVATE'}],job_title:'QA_PRIVATE',company_name:'QA_PRIVATE'}],
  'public.application_followups':[{id,youth_user_id:own,job_id:id,job_profile_version:3,status:'answered',question_source:'company',created_at:t,answered_at:t,answer:'QA_PRIVATE',question:'QA_PRIVATE',criterion_key:'QA_PRIVATE',asked_by:id,request_key:id}],
  'private.application_disclosures':[{youth_user_id:own,job_id:id,revision:5,created_at:t,updated_at:t,selected_keys:['QA_PRIVATE'],packet:{text:'QA_PRIVATE'},matching_input:{text:'QA_PRIVATE'},source_token:'QA_PRIVATE'}],
  'public.candidate_assessments':[{id,youth_user_id:own,job_id:id,job_profile_version:3,created_at:t,company_user_id:id,input_hash:'QA_PRIVATE',result:{text:'QA_PRIVATE'},criteria_snapshot:[{text:'QA_PRIVATE'}]}],
 };
 return role==='youth'?youth:role==='company'?{...company,...owner}:{'public.private_profiles':[{user_id:own,updated_at:t,display_name:'QA_PRIVATE',city:'QA_PRIVATE'}],...owner};
}
// Independent acceptance contract: exact keys expected in downloadable records.
export const historyFields={
 'public.company_profiles':['user_id','verification_status','verification_submitted_at','verified_at','updated_at'],
 'public.private_profiles':['user_id','updated_at'],
 'public.company_billing_details':['user_id','country_code','version','updated_at'],
 'public.application_completions':['youth_user_id','job_id','profile_version','status','created_at','submitted_at','supplemented_at','question_batch_version','withdrawn_at'],
 'public.application_followups':['id','youth_user_id','job_id','job_profile_version','status','question_source','created_at','answered_at'],
 'private.application_disclosures':['youth_user_id','job_id','revision','created_at','updated_at'],
 'public.candidate_assessments':['id','youth_user_id','job_id','job_profile_version','created_at'],
 'public.jobs':['id','company_user_id','status','publication_status','job_kind','is_active','job_category_manual','created_at','first_published_at'],
 'public.company_match_profiles':['company_user_id','profile_version','created_at','updated_at'],
 'public.company_recruitment_controls':['company_user_id','restriction','changed_at'],
 'public.recruitment_outcomes':['company_user_id','job_id','outcome','recorded_at'],
};
