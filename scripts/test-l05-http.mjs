/* DevStaging-only disposable HTTP fixtures. Credentials arrive on hidden stdin, never files/logs.
 * Run after scripts/sql/l05-http-fixture.sql; remove its temporary users after this suite.
 */
import assert from 'node:assert/strict';
import {createInterface} from 'node:readline';
import {once} from 'node:events';
import {randomUUID} from 'node:crypto';
console.log('Ready for private QA configuration on stdin.');
const input=createInterface({input:process.stdin});
const [line]=await once(input,'line');input.close();process.stdin.pause();
const cfg=JSON.parse(line);
const base='https://vwcfjvwfeatvuisojwrh.supabase.co';
const app='https://youth-job-mvp-dev.vercel.app';
assert.equal(cfg.actors.length,5);for(const a of cfg.actors)assert.match(a.email,/^qa-l05-http-[0-9a-f-]+@example\.invalid$/);
const actors=Object.fromEntries(cfg.actors.map(a=>[a.name,a]));
const tokens={};let passed=0;const skipped=[];let cvUploaded=false,videoUploaded=false,accountCleanupAvailable=false;
const videoBytes=5*1024*1024; // Exercises streaming above Vercel's buffered 4.5 MB limit.
const videoId=randomUUID();const videoPath=`${actors.youth.id}/${videoId}.mp4`;
function check(ok,label){assert.ok(ok,label);passed++;console.log(`PASS: ${label}`);}
async function request(url,actor,method='GET',body,headers={}){
 const h={apikey:cfg.anonKey,...headers};if(actor)h.Authorization=`Bearer ${tokens[actor]}`;
 if(body!=null&&!(body instanceof Uint8Array)){h['Content-Type']='application/json';body=JSON.stringify(body);}
 const res=await fetch(url,{method,headers:h,body,cache:"no-store",signal:AbortSignal.timeout(url.includes('/auth/v1/')?60000:30000)});
 const raw=await res.text();let data;try{data=raw?JSON.parse(raw):null;}catch{data=raw;}
 return{status:res.status,ok:res.ok,data,type:res.headers.get('content-type'),cacheControl:res.headers.get('cache-control'),cacheStatus:res.headers.get('cf-cache-status'),age:res.headers.get('age')};
}
const rest=(actor,path,method='GET',body)=>request(`${base}/rest/v1/${path}`,actor,method,body);
const rpc=(actor,name,body={})=>rest(actor,`rpc/${name}`,'POST',body);
const denied=r=>[400,401,403,404,409].includes(r.status)||(r.ok&&Array.isArray(r.data)&&r.data.length===0);
const reportArgs={p_target_type:'conversation',p_target_id:cfg.conversation,p_reason:'harassment',p_details:'QA L05 HTTP fictional report'};
let failure;
try{
 await Promise.all(cfg.actors.map(async a=>{let res;try{res=await request(`${base}/auth/v1/token?grant_type=password`,null,'POST',{email:a.email,password:a.password});}catch(reason){throw Error(`QA ${a.name} authentication request failed: ${reason.message}`);}assert.ok(res.ok&&res.data?.access_token,`QA ${a.name} could not authenticate (${res.status}): ${res.data?.msg||res.data?.error_description||res.data?.message||'no detail'}`);tokens[a.name]=res.data.access_token;}));
 check(Object.keys(tokens).length===5,'five real authenticated test roles');
 const canDelete=await request(`${app}/api/account`,'youth','DELETE',{});accountCleanupAvailable=canDelete.status===400&&typeof canDelete.data?.error==='string';
 if(!accountCleanupAvailable)skipped.push('Real video bytes skipped: self-service test-account cleanup endpoint unavailable.');
 // Normal CV sharing is tested through the actual private Storage API.
 const pdf=Buffer.from('%PDF-1.4\n% QA L05 fictional private CV fixture\n%%EOF\n');
 let res=await request(`${base}/storage/v1/object/youth-documents/${cfg.cvPath}`,'youth','POST',pdf,{'Content-Type':'application/pdf','x-upsert':'false'});check(res.ok,`owner uploads private CV (${res.status})`);cvUploaded=true;
 const signed=await request(`${base}/storage/v1/object/sign/youth-documents/${cfg.cvPath}`,'company','POST',{expiresIn:30});check(signed.ok&&typeof signed.data?.signedURL==='string','right company signs explicitly shared original CV');
 const signedPath=signed.data.signedURL;const signedUrl=signedPath.startsWith('http')?signedPath:signedPath.startsWith('/storage/v1/')?base+signedPath:`${base}/storage/v1${signedPath.startsWith('/')?'':'/'}${signedPath}`;
 const downloaded=await fetch(signedUrl,{signal:AbortSignal.timeout(15000)});check(downloaded.ok&&(await downloaded.text()).includes('QA L05'),'signed CV URL returns the real private file');
 for(const actor of ['outsider','wrongCompany',null])check(denied(await request(`${base}/storage/v1/object/sign/youth-documents/${cfg.cvPath}`,actor,'POST',{expiresIn:30})),`${actor??'anonymous'} cannot sign the private CV`);
 check((await rpc('company','get_application_disclosure',{p_job_id:cfg.job,p_youth_user_id:actors.youth.id})).ok,'right company reads the shared application');
 for(const actor of ['outsider','wrongCompany',null])check(denied(await rpc(actor,'get_application_disclosure',{p_job_id:cfg.job,p_youth_user_id:actors.youth.id})),`${actor??'anonymous'} denied application RPC`);
 check(denied(await rpc('company','get_application_disclosure',{p_job_id:cfg.otherJob,p_youth_user_id:actors.youth.id})),'same candidate on wrong job is denied');
 check(denied(await rpc('wrongCompany','get_company_candidates',{p_job_id:cfg.job})),'wrong company denied candidate list');
 for(const actor of ['outsider','company',null])check(denied(await rest(actor,`youth_profiles?select=user_id,full_name,address&user_id=eq.${actors.youth.id}`)),`${actor??'anonymous'} cannot read general youth profile`);
 check(denied(await rest('outsider',`conversations?select=id&id=eq.${cfg.conversation}`))&&denied(await rest('outsider',`messages?select=id&conversation_id=eq.${cfg.conversation}`)),'outsider denied conversations and messages');
 check(denied(await rpc('outsider','submit_moderation_report',{p_target_type:'job',p_target_id:cfg.pausedJob,p_reason:'privacy'})),'paused unrelated job cannot expose a report snapshot');
 check(denied(await rpc('outsider','submit_moderation_report',{...reportArgs,p_target_type:'message',p_target_id:cfg.message})),'foreign message cannot be reported as a data-read shortcut');
 if(accountCleanupAvailable){
  res=await rest('youth','youth_videos','POST',{id:videoId,owner_id:actors.youth.id,conversation_id:cfg.conversation,storage_path:videoPath,mime_type:'video/mp4',size_bytes:videoBytes,duration_seconds:1});check(res.ok,'owner registers conversation-scoped video fixture');
  res=await request(`${base}/storage/v1/object/youth-profile-videos/${videoPath}`,'youth','POST',new Uint8Array(videoBytes),{'Content-Type':'video/mp4','cache-control':'max-age=0'});check(res.ok,'owner uploads private video fixture bytes');videoUploaded=true;
  res=await rest('youth','messages','POST',{conversation_id:cfg.conversation,sender_user_id:actors.youth.id,message_text:'QA L05 HTTP video',video_kind:'file',video_id:videoId});check(res.ok,'video explicitly shared in the matched conversation');
  res=await request(`${app}/api/videos/playback`,'company','POST',{videoId});check(res.ok&&res.data.length===videoBytes,'right recipient streams 5 MB of real video bytes');
  check(denied(await request(`${base}/storage/v1/object/authenticated/youth-profile-videos/${videoPath}`,'company')),'even the recipient cannot bypass playback checks through direct Storage');
  check(denied(await request(`${base}/storage/v1/object/sign/youth-profile-videos/${videoPath}`,'company','POST',{expiresIn:30})),'recipient cannot create a reusable video bearer URL');
  for(const actor of ['outsider','wrongCompany',null]){check(denied(await request(`${app}/api/videos/playback`,actor,'POST',{videoId})),`${actor??'anonymous'} denied video playback`);check(denied(await request(`${base}/storage/v1/object/authenticated/youth-profile-videos/${videoPath}`,actor)),`${actor??'anonymous'} denied direct private video bytes`);}
 }
 const reports=await Promise.all([rpc('youth','submit_moderation_report',reportArgs),rpc('youth','submit_moderation_report',reportArgs)]);
 check(reports.every(r=>r.ok)&&reports[0].data===reports[1].data,'simultaneous report submissions return one case');const reportId=reports[0].data;
 check(denied(await rpc('outsider','get_moderation_casework'))&&denied(await rpc(null,'get_moderation_casework')),'ordinary and anonymous callers denied admin casework');
 res=await rpc('youth','block_conversation_user',{p_conversation_id:cfg.conversation});check(res.ok,'participant blocks the contact');
 for(const actor of ['youth','company'])check(denied(await rest(actor,'messages','POST',{conversation_id:cfg.conversation,sender_user_id:actors[actor].id,message_text:'QA blocked HTTP send'})),`block prevents ${actor} from sending`);
 res=await rpc('outsider','users_are_blocked',{first_user:actors.youth.id,second_user:actors.company.id});check(res.ok&&res.data===false,'unrelated account cannot discover third-party blocking');
 check(denied(await rpc('company','get_application_disclosure',{p_job_id:cfg.job,p_youth_user_id:actors.youth.id})),'block revokes shared application access');
 check(denied(await request(`${base}/storage/v1/object/sign/youth-documents/${cfg.cvPath}`,'company','POST',{expiresIn:30})),'block prevents new signed CV URLs');
 if(videoUploaded)check(denied(await request(`${app}/api/videos/playback`,'company','POST',{videoId})),'block prevents a new download after a previously authorized playback');
 res=await rpc('company','submit_moderation_report',{...reportArgs,p_reason:'privacy'});check(res.ok,'blocked participant can still report the conversation');
 const adminRead=await rpc('admin','get_moderation_casework');const ownCase=adminRead.data?.find(r=>r.id===reportId);check(adminRead.ok&&ownCase,'admin reads the submitted case');
 if(videoUploaded)check(ownCase.target_snapshot?.video_ids?.includes(videoId),'conversation report preserves its video evidence reference');
 const decision={p_report_id:reportId,p_status:'resolved',p_expected_status:'open',p_resolution_note:'QA L05 INTERNAL ADMIN NOTE'};
 const decisions=await Promise.all([rpc('admin','review_moderation_report_checked',decision),rpc('admin','review_moderation_report_checked',decision)]);check(decisions.every(r=>r.ok),'simultaneous identical admin decisions are idempotent');
 res=await rest('youth',`notifications?select=id&type=eq.moderation_report&user_id=eq.${actors.youth.id}`);check(res.ok&&res.data.length===1,'exactly one outcome notification');
 res=await rpc('admin','get_moderation_casework');check(res.data?.find(r=>r.id===reportId)?.resolution_note===decision.p_resolution_note,'admin reads the persisted decision note');
 check(denied(await rest('youth',`moderation_reports?select=resolution_note&id=eq.${reportId}`)),'reporter cannot read internal admin note through REST');
 res=await rest('youth',`moderation_reports?select=id,status&id=eq.${reportId}`);check(res.ok&&res.data[0]?.status==='resolved','reporter can follow the case status');
 check(denied(await rpc('admin','review_moderation_report',{p_report_id:reportId,p_status:'reviewing',p_resolution_note:null})),'legacy endpoint cannot reopen a final decision');
 check((await rpc('company','block_conversation_user',{p_conversation_id:cfg.conversation})).ok,'reciprocal block created');
 check((await rpc('youth','unblock_user',{p_blocked_user_id:actors.company.id})).ok,'one side removes only its own block');
 check(denied(await rest('youth','messages','POST',{conversation_id:cfg.conversation,sender_user_id:actors.youth.id,message_text:'QA reciprocal block send'})),'reciprocal block still prevents communication');
 check((await rpc('company','unblock_user',{p_blocked_user_id:actors.youth.id})).ok,'second side removes its own block');
 check((await rest('company','messages','POST',{conversation_id:cfg.conversation,sender_user_id:actors.company.id,message_text:'QA restored communication'})).ok,'communication works after both sides unblock');
 if(videoUploaded)check((await request(`${app}/api/videos/playback`,'company','POST',{videoId})).ok,'video playback works again after both sides unblock');
 const cvApi=await request(`${app}/api/company/candidate-cv`,'wrongCompany','POST',{jobId:cfg.job,youthUserId:actors.youth.id});
 if(cvApi.type?.includes('application/json'))check(cvApi.status===403,'deployed candidate-CV API denies wrong company');else skipped.push('Deployed candidate-CV API behind deployment protection; direct RPC/Storage tests passed.');
}catch(reason){failure=reason;console.error('FAIL:',reason.message);}
finally{
 if(cvUploaded&&!videoUploaded){const res=await request(`${base}/storage/v1/object/youth-documents`,'youth','DELETE',{prefixes:[cfg.cvPath]});check(res.ok,'test CV bytes cleaned up by owner');}
 if(videoUploaded){const res=await request(`${app}/api/account`,'youth','DELETE',{password:actors.youth.password});check(res.status===204,'disposable youth account and private file bytes cleaned up');}
 console.log(JSON.stringify({passed,skipped,videoBytesTested:videoUploaded,youthDeleted:videoUploaded,requiresSqlCleanup:true,fixtureScope:'qa-l05-http'}));
}
process.stdin.destroy();if(failure)process.exitCode=1;
