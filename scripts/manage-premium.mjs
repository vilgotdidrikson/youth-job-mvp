/*
 * Manual Phase 5 premium fulfilment. This is intentionally service-role only.
 *
 * Grant:
 *   node --env-file=.env.local scripts/manage-premium.mjs grant <company-user-id> <job-id> <source-reference> [product-code] [start-at]
 *
 * End:
 *   node --env-file=.env.local scripts/manage-premium.mjs end <entitlement-id> <reason> <source-reference>
 */
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const [action, ...args] = process.argv.slice(2);
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceRoleKey) {
  throw new Error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in the server environment.");
}

const supabase = createClient(url, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
});

if (action === "grant") {
  const [companyUserId, jobId, sourceReference, productCode = "job_boost_7d", startAt = new Date().toISOString()] = args;
  if (!companyUserId || !jobId || !sourceReference) {
    throw new Error("Usage: grant <company-user-id> <job-id> <source-reference> [product-code] [start-at]");
  }

  const { data, error } = await supabase.rpc("activate_premium", {
    p_company_user_id: companyUserId,
    p_product_code: productCode,
    p_job_id: jobId,
    p_starts_at: startAt,
    p_source: "manual",
    p_source_reference: sourceReference,
    p_idempotency_key: randomUUID(),
  });
  if (error) throw new Error(error.message);
  console.log(JSON.stringify(data, null, 2));
} else if (action === "end") {
  const [entitlementId, reason, sourceReference] = args;
  if (!entitlementId || !reason || !sourceReference) {
    throw new Error("Usage: end <entitlement-id> <reason> <source-reference>");
  }

  const { data, error } = await supabase.rpc("end_premium", {
    p_entitlement_id: entitlementId,
    p_reason: reason,
    p_source: "manual",
    p_source_reference: sourceReference,
    p_idempotency_key: randomUUID(),
  });
  if (error) throw new Error(error.message);
  console.log(JSON.stringify(data, null, 2));
} else {
  throw new Error("Usage: manage-premium.mjs <grant|end> ...");
}

