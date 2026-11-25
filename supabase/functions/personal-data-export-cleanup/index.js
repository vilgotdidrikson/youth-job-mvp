import { createClient } from "@supabase/supabase-js";
import { createPersonalDataExportCleanupHandler } from "../../../lib/personal-data-export-cleanup-handler.ts";

// Gateway JWT checking is replaced by independent 256-bit Vault authentication
// in the shared handler. Uploads and caller paths are never accepted here.
Deno.serve(createPersonalDataExportCleanupHandler(() => {
  const active = AbortSignal.timeout(50000);
  return createClient(Deno.env.get("SUPABASE_URL"), Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { fetch: (input, init) => fetch(input, { ...init, cache: "no-store", signal: init?.signal ? AbortSignal.any([active, init.signal]) : active }) },
  });
}));
