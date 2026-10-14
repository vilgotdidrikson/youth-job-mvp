"use client";

import { createClient } from "@supabase/supabase-js";
import { getSupabaseClient } from "@/lib/supabase";
import { PROFILE_VIDEO_POLICY as policy, isProfileVideoPath, validateProfileVideo } from "@/lib/profile-video";

export interface YouthVideo {
  id: string;
  owner_id: string;
  storage_path: string;
  conversation_id: string | null;
  duration_seconds: number;
  revoked_at: string | null;
}

export async function getProfileVideo(userId: string): Promise<YouthVideo | null> {
  const db = getSupabaseClient();
  const { data: pointer, error } = await db.from("youth_profile_videos").select("video_id").eq("user_id", userId).maybeSingle();
  if (error) throw new Error("Kunde inte hämta profilvideon. Försök igen.");
  return pointer ? getVideo(pointer.video_id) : null;
}

export async function getVideo(id: string): Promise<YouthVideo | null> {
  const { data, error } = await getSupabaseClient().from("youth_videos").select("id,owner_id,storage_path,conversation_id,duration_seconds,revoked_at").eq("id", id).maybeSingle();
  if (error) throw new Error("Kunde inte hämta videon. Försök igen.");
  return data?.revoked_at ? null : data as YouthVideo | null;
}

export async function videoPlaybackUrl(video: YouthVideo): Promise<string> {
  if (!isProfileVideoPath(video.storage_path, video.owner_id)) throw new Error("Ogiltig videosökväg.");
  const { data, error } = await getSupabaseClient().storage.from(policy.bucket).createSignedUrl(video.storage_path, policy.signedUrlSeconds);
  if (error || !data?.signedUrl) throw new Error("Videon är inte längre tillgänglig eller så saknar du behörighet.");
  return data.signedUrl;
}

export async function revokeVideo(video: YouthVideo): Promise<boolean> {
  const db = getSupabaseClient();
  const { data, error } = await db.from("youth_videos").update({ revoked_at: new Date().toISOString() }).eq("id", video.id).select("id");
  if (error || !data?.length) throw new Error("Videon kunde inte tas bort. Försök igen.");
  // Access is revoked first, even if object cleanup fails. Caller can report it.
  const { error: cleanupError } = await db.storage.from(policy.bucket).remove([video.storage_path]);
  return !cleanupError;
}

export async function replaceProfileVideo(userId: string, video: YouthVideo | null, previous: YouthVideo | null): Promise<boolean> {
  const db = getSupabaseClient();
  let result;
  if (previous) {
    result = video
      ? await db.from("youth_profile_videos").update({video_id:video.id,updated_at:new Date().toISOString()}).eq("user_id",userId).eq("video_id",previous.id).select("user_id")
      : await db.from("youth_profile_videos").delete().eq("user_id",userId).eq("video_id",previous.id).select("user_id");
  } else if (video) {
    result = await db.from("youth_profile_videos").insert({user_id:userId,video_id:video.id}).select("user_id");
  } else return true;
  if (result.error || !result.data?.length) {
    // A lost write response must not turn a successful save into a duplicate or
    // revoke the newly published asset on retry.
    const {data:current,error:readError}=await db.from("youth_profile_videos").select("video_id").eq("user_id",userId).maybeSingle();
    if(readError || (video ? current?.video_id!==video.id : !!current)) {
      throw new Error("Profilvideon har ändrats i en annan vy eller kunde inte sparas. Hämta sidan igen.");
    }
  }
  if (previous) {
    try { return await revokeVideo(previous); } catch { return false; }
  }
  return true;
}

/** Standard upload with a task-scoped fetch abort signal; never modify the shared
 * client's transport or upload through a service-role client. */
export async function uploadVideo(file: File, duration: number, userId: string, conversationId: string | null, signal: AbortSignal): Promise<YouthVideo> {
  const validation = validateProfileVideo({name:file.name,type:file.type.split(";")[0],size:file.size,durationSeconds:duration});
  if (!validation.ok) throw new Error(validation.message);
  signal.throwIfAborted();
  const db = getSupabaseClient();
  const id = crypto.randomUUID();
  const video: YouthVideo = {id,owner_id:userId,storage_path:`${userId}/${id}.${validation.extension}`,conversation_id:conversationId,duration_seconds:duration,revoked_at:null};
  const { error } = await db.from("youth_videos").insert({...video,mime_type:validation.mimeType,size_bytes:file.size});
  if (error) throw new Error("Kunde inte förbereda videon. Kontrollera din session och försök igen.");
  try {
    signal.throwIfAborted();
    const { data: { session } } = await db.auth.getSession();
    if (!session) throw new Error("Logga in igen för att ladda upp video.");
    const uploadClient = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
      accessToken: async () => session.access_token,
      auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},
      global:{fetch:(url,options)=>fetch(url,{...options,signal})},
    });
    const {error:uploadError} = await uploadClient.storage.from(policy.bucket).upload(video.storage_path,file,{contentType:validation.mimeType,upsert:false,cacheControl:"0"});
    if (uploadError) throw new Error("Uppladdningen misslyckades. Kontrollera anslutningen och försök igen.");
    signal.throwIfAborted();
    return video;
  } catch (reason) {
    // An aborted request may have reached storage: revoke and attempt cleanup.
    await revokeVideo(video).catch(() => false);
    throw reason;
  }
}

/** A deterministic message UUID makes retries idempotent, including lost replies. */
export async function sendVideoMessage(conversationId: string, userId: string, messageId: string, video: YouthVideo | null): Promise<void> {
  const db = getSupabaseClient();
  const expected = {id:messageId,conversation_id:conversationId,sender_user_id:userId,
    message_text:video ? "Videomeddelande" : "Min presentationsvideo",video_kind:video ? "file" : "profile",video_id:video?.id ?? null};
  const {error} = await db.from("messages").insert(expected);
  if (!error) return;
  const {data} = await db.from("messages").select("id,conversation_id,sender_user_id,video_kind,video_id").eq("id",messageId).maybeSingle();
  if (data && data.conversation_id===conversationId && data.sender_user_id===userId && data.video_kind===expected.video_kind && data.video_id===expected.video_id) return;
  throw new Error("Videon kunde inte skickas. Förhandsvisningen finns kvar så att du kan försöka igen.");
}
