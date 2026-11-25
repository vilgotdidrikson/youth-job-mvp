import { createClient } from "@supabase/supabase-js";
import { processVideoCleanup } from "../../../lib/video-cleanup-worker.ts";

// Gateway JWT verification is replaced by an independent 256-bit Vault token.
// User JWTs never authorize this worker. No request body or caller paths are used.
Deno.serve(async request => {
  if (request.method !== "POST") return new Response(null, { status: 405 });
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  if (!/^[a-f0-9]{64}$/.test(token)) return new Response(null, { status: 401 });
  const client = createClient(Deno.env.get("SUPABASE_URL"), Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: valid, error } = await client.rpc("validate_video_cleanup_token", { p_token: token });
  if (error) return new Response(null, { status: 503 });
  if (valid !== true) return new Response(null, { status: 401 });
  try {
    return Response.json(await processVideoCleanup(client), { headers: { "Cache-Control": "no-store" } });
  } catch { return new Response(null, { status: 503 }); }
});
