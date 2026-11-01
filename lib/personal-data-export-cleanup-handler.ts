import type { SupabaseClient } from "@supabase/supabase-js";
import { processPersonalDataExportCleanup } from "./personal-data-export-cleanup";

const headers = { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" };
/** Independent Vault token, never a user JWT or a caller-supplied object path. */
export function createPersonalDataExportCleanupHandler(createClient: () => SupabaseClient) {
  return async (request: Request): Promise<Response> => {
    if (request.method !== "POST") return new Response(null, { status: 405, headers });
    const token = request.headers.get("authorization")?.match(/^Bearer ([a-f0-9]{64})$/)?.[1];
    if (!token) return new Response(null, { status: 401, headers });
    if (new URL(request.url).search) return new Response(null, { status: 400, headers });
    try {
      const client = createClient();
      const { data: valid, error } = await client.rpc("validate_personal_data_export_cleanup_token", { p_token: token });
      if (error) return new Response(null, { status: 503, headers });
      if (valid !== true) return new Response(null, { status: 401, headers });
      return Response.json(await processPersonalDataExportCleanup(client), { headers });
    } catch { return new Response(null, { status: 503, headers }); }
  };
}
