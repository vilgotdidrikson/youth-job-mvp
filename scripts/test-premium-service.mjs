/*
 * Disposable-staging integration test for Phase 5 premium RPCs.
 *
 * Required:
 * PREMIUM_TEST_SUPABASE_URL
 * PREMIUM_TEST_SERVICE_ROLE_KEY
 * PREMIUM_TEST_COMPANY_ID
 * PREMIUM_TEST_JOB_ID
 * PREMIUM_TEST_ALLOW_WRITES=true
 *
 * Run:
 * node --env-file=.env.premium scripts/test-premium-service.mjs
 */
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const required = [
  "PREMIUM_TEST_SUPABASE_URL",
  "PREMIUM_TEST_SERVICE_ROLE_KEY",
  "PREMIUM_TEST_COMPANY_ID",
  "PREMIUM_TEST_JOB_ID",
  "PREMIUM_TEST_ALLOW_WRITES",
];
const missing = required.filter((name) => !process.env[name]);
if (missing.length) throw new Error(`Missing premium test environment variables: ${missing.join(", ")}`);
if (process.env.PREMIUM_TEST_ALLOW_WRITES !== "true") {
  throw new Error("Set PREMIUM_TEST_ALLOW_WRITES=true only for disposable staging data.");
}

const supabase = createClient(
  process.env.PREMIUM_TEST_SUPABASE_URL,
  process.env.PREMIUM_TEST_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false } },
);
const companyId = process.env.PREMIUM_TEST_COMPANY_ID;
const jobId = process.env.PREMIUM_TEST_JOB_ID;
const productCode = `premium_test_${randomUUID().replaceAll("-", "").slice(0, 16)}`;
const sourceReference = `premium-test-${randomUUID()}`;
const idempotencyKey = randomUUID();

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const { error: productError } = await supabase.from("premium_products").insert({
  code: productCode,
  name: "Kort testboost",
  kind: "job_boost",
  scope: "job",
  default_duration: "00:00:01",
  active: true,
});
if (productError) throw new Error(`Could not create test product: ${productError.message}`);

try {
  const activationArgs = {
    p_company_user_id: companyId,
    p_product_code: productCode,
    p_job_id: jobId,
    p_starts_at: new Date().toISOString(),
    p_source: "manual",
    p_source_reference: sourceReference,
    p_idempotency_key: idempotencyKey,
  };
  const first = await supabase.rpc("activate_premium", activationArgs);
  if (first.error) throw new Error(`Activation failed: ${first.error.message}`);
  const firstRow = Array.isArray(first.data) ? first.data[0] : null;
  assert(firstRow?.result === "created" && firstRow.entitlement_id, "Activation did not create an entitlement.");

  const replay = await supabase.rpc("activate_premium", activationArgs);
  if (replay.error) throw new Error(`Idempotency replay failed: ${replay.error.message}`);
  const replayRow = Array.isArray(replay.data) ? replay.data[0] : null;
  assert(replayRow?.result === "replayed", "Repeated activation was not replayed.");
  assert(replayRow.entitlement_id === firstRow.entitlement_id, "Repeated activation created another entitlement.");

  const immediate = await supabase.rpc("premium_effective_boosts", { p_job_ids: [jobId] });
  if (immediate.error) throw new Error(`Boost status lookup failed: ${immediate.error.message}`);
  assert(immediate.data?.some((row) => row.job_id === jobId && row.is_boosted === true), "Active boost was not effective.");

  await new Promise((resolve) => setTimeout(resolve, 1_250));
  const expired = await supabase.rpc("premium_effective_boosts", { p_job_ids: [jobId] });
  if (expired.error) throw new Error(`Expired boost lookup failed: ${expired.error.message}`);
  assert(!expired.data?.some((row) => row.job_id === jobId && row.is_boosted === true), "Expired boost remained effective.");

  const endArgs = {
    p_entitlement_id: firstRow.entitlement_id,
    p_reason: "premium_test_cleanup",
    p_source: "manual",
    p_source_reference: `${sourceReference}:end`,
    p_idempotency_key: randomUUID(),
  };
  const ended = await supabase.rpc("end_premium", endArgs);
  if (ended.error) throw new Error(`Ending failed: ${ended.error.message}`);
  const endedRow = Array.isArray(ended.data) ? ended.data[0] : null;
  assert(endedRow?.result === "ended", "Ending did not return ended.");

  const endedReplay = await supabase.rpc("end_premium", endArgs);
  if (endedReplay.error) throw new Error(`End idempotency replay failed: ${endedReplay.error.message}`);
  const endedReplayRow = Array.isArray(endedReplay.data) ? endedReplay.data[0] : null;
  assert(endedReplayRow?.result === "replayed", "Repeated ending was not replayed.");

  console.log("PASS: premium activation, idempotency, expiry and ending");
} finally {
  await supabase.from("premium_products").update({ active: false }).eq("code", productCode);
}

