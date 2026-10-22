"use client";

import { videoHasExpired } from "@/lib/video-retention";
import { createClient } from "@supabase/supabase-js";
import { getSupabaseClient } from "@/lib/supabase";
import { PROFILE_VIDEO_POLICY as policy, isProfileVideoPath, validateProfileVideo } from "@/lib/profile-video";

export interface YouthVideo {
  id: string;
  owner_id: string;
  storage_path: string | null;
  conversation_id: string | null;
  duration_seconds: number | null;
  first_sent_at?: string | null;
  expires_at?: string;
  deleted_at?: string | null;
  revoked_at: string | null;
}

export async function getVideo(id: string): Promise<YouthVideo | null> {
  const { data, error } = await getSupabaseClient().from("youth_videos").select("id,owner_id,storage_path,conversation_id,duration_seconds,revoked_at,first_sent_at,expires_at,deleted_at").eq("id", id).maybeSingle();
  if (error) throw new Error("Kunde inte hämta videon. Försök igen.");
  return !data?.conversation_id || data.revoked_at ? null : data as YouthVideo;
}

export async function videoPlaybackUrl(video: YouthVideo): Promise<string> {
  if (videoHasExpired(video.expires_at) || video.deleted_at) throw new Error("Videon är inte längre tillgänglig.");
  if (!video.conversation_id || !video.storage_path || !isProfileVideoPath(video.storage_path, video.owner_id)) throw new Error("Ogiltig videosökväg.");
  const { data, error } = await getSupabaseClient().storage.from(policy.bucket).download(video.storage_path, {}, { cache: "no-store" });
  if (error || !data) throw new Error("Videon är inte längre tillgänglig eller så saknar du behörighet.");
  // The JWT is checked on every download. No reusable Storage bearer URL.
  if (videoHasExpired(video.expires_at)) throw new Error("Videon är inte längre tillgänglig.");
  return URL.createObjectURL(data);
}

export async function revokeVideo(video: YouthVideo): Promise<boolean> {
  const db = getSupabaseClient();
  const { data, error } = await db.from("youth_videos").update({ revoked_at: new Date().toISOString() }).eq("id", video.id).select("id");
  if (error || !data?.length) throw new Error("Videon kunde inte tas bort. Försök igen.");
  // Physical deletion is centralized so report exclusions and retries apply.
  return true;
}

/** Standard upload with a task-scoped fetch abort signal; never modify the shared
 * client's transport or upload through a service-role client. */
export async function uploadVideo(file: File, duration: number, userId: string, conversationId: string, signal: AbortSignal): Promise<YouthVideo> {
  if (!conversationId) throw new Error("Välj en chatt innan du laddar upp video.");
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
    const {error:uploadError} = await uploadClient.storage.from(policy.bucket).upload(video.storage_path!,file,{contentType:validation.mimeType,upsert:false,cacheControl:"0"});
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
export async function sendVideoMessage(conversationId: string, userId: string, messageId: string, video: YouthVideo): Promise<void> {
  if (!video || video.conversation_id !== conversationId || video.owner_id !== userId) throw new Error("Videon tillhör inte den här chatten.");
  const db = getSupabaseClient();
  const expected = {id:messageId,conversation_id:conversationId,sender_user_id:userId,
    message_text:"Videomeddelande",video_kind:"file",video_id:video.id};
  const {error} = await db.from("messages").insert(expected);
  if (!error) return;
  const {data} = await db.from("messages").select("id,conversation_id,sender_user_id,video_kind,video_id").eq("id",messageId).maybeSingle();
  if (data && data.conversation_id===conversationId && data.sender_user_id===userId && data.video_kind===expected.video_kind && data.video_id===expected.video_id) return;
  throw new Error("Videon kunde inte skickas. Förhandsvisningen finns kvar så att du kan försöka igen.");
}
