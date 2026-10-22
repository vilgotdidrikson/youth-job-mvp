// Manual DevStaging-only smoke handler. Temporarily bundle into the authenticated
// cleanup function while its cron config is disabled; restore the normal handler
// immediately afterwards. Never deploy this handler to production.
import { processVideoCleanup } from '../lib/video-cleanup-worker.ts';

export async function runStorageSmoke(client, projectUrl) {
  if (projectUrl !== "https://vwcfjvwfeatvuisojwrh.supabase.co") throw new Error("DevStaging only");
  const youth = '40416000-07aa-4416-9098-fb4be9928558';
  const conversation = '6fa2dac2-c31f-4f31-b245-5489a04ed394';
  const bucket = 'youth-profile-videos';
  const must = result => { if (result.error) throw new Error('Storage smoke step failed'); return result.data; };
  const profile = must(await client.from('youth_profiles').select('full_name').eq('user_id',youth).single());
  const chat = must(await client.from('conversations').select('youth_user_id').eq('id',conversation).single());
  if (profile.full_name !== 'Alex Testsson' || chat.youth_user_id !== youth) throw new Error('Not fictional QA fixtures');
  const due = must(await client.from('youth_videos').select('id').not('conversation_id','is',null).is('deleted_at',null)
    .or(`expires_at.lte.${new Date().toISOString()},revoked_at.not.is.null`));
  if (due.length) throw new Error('Refusing smoke with unrelated due assets');
  const ids = [crypto.randomUUID(),crypto.randomUUID()];
  const paths = ids.map(id=>`${youth}/${id}.mp4`);
  try {
    must(await client.from('youth_videos').insert(ids.map((id,i)=>({id,owner_id:youth,conversation_id:conversation,
      storage_path:paths[i],mime_type:'video/mp4',size_bytes:100,duration_seconds:1}))));
    for (const path of paths) must(await client.storage.from(bucket).upload(path,new Uint8Array(100),{contentType:'video/mp4',cacheControl:'0',upsert:false}));
    must(await client.from('youth_videos').update({expires_at:new Date(Date.now()-1000).toISOString()}).in('id',ids));
    const first = await processVideoCleanup(client);
    if (first.claimed!==2 || first.deleted!==2 || first.retry!==0) throw new Error('Cleanup totals failed');
    const rows = must(await client.from('youth_videos').select('storage_path,mime_type,size_bytes,duration_seconds,deleted_at').in('id',ids));
    if(rows.length!==2 || rows.some(v=>v.storage_path!==null||v.mime_type!==null||v.size_bytes!==null||v.duration_seconds!==null||!v.deleted_at)) throw new Error('Metadata not scrubbed');
    for(const path of paths) {
      const response=await client.storage.from(bucket).download(path,{}, {cache:'no-store'});
      if(!response.error || response.data) throw new Error('Deleted bytes still readable');
    }
    const repeated = await processVideoCleanup(client);
    if(repeated.claimed!==0) throw new Error('Idempotent repeat failed');
    return {passed:true,real_objects_uploaded:2,real_objects_deleted:2,tombstones_scrubbed:2,repeated_claimed:0};
  } finally {
    must(await client.storage.from(bucket).remove(paths));
    must(await client.from('youth_videos').delete().in('id',ids));
  }
}
