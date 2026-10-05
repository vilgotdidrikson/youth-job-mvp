/*
 * Disposable-staging end-to-end test for account deletion. It creates its own
 * throwaway admin, company and youth accounts with the staging service-role
 * key, builds a full data graph, deletes the accounts through the deployed
 * /api/account route and asserts the retention map in docs/account-deletion.md.
 * It never targets production and always cleans up the accounts it created.
 *
 * Run: node --env-file=.env.deletion scripts/test-staging-account-deletion.mjs
 */
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const required = [
  "DELETION_TEST_APP_URL", "DELETION_TEST_SUPABASE_URL", "DELETION_TEST_ANON_KEY",
  "DELETION_TEST_SERVICE_ROLE_KEY", "DELETION_TEST_ALLOW_WRITES",
];
const missing = required.filter((name) => !process.env[name]);
if (missing.length) throw new Error(`Missing deletion test environment variables: ${missing.join(", ")}`);

const url = process.env.DELETION_TEST_SUPABASE_URL.replace(/\/$/, "");
const appUrl = process.env.DELETION_TEST_APP_URL.replace(/\/$/, "");
if (new URL(url).hostname !== "vwcfjvwfeatvuisojwrh.supabase.co") {
  throw new Error("Refusing to run: DELETION_TEST_SUPABASE_URL is not MatchnWork DevStaging.");
}
// A local `next dev` is allowed; the Supabase guard above still pins all data to DevStaging.
if (!["youth-job-mvp-dev.vercel.app", "localhost", "127.0.0.1"].includes(new URL(appUrl).hostname)) {
  throw new Error("Refusing to run: DELETION_TEST_APP_URL is not the Employo dev deployment or a local dev server.");
}
if (process.env.DELETION_TEST_ALLOW_WRITES !== "true") {
  throw new Error("Set DELETION_TEST_ALLOW_WRITES=true only for disposable staging test data.");
}

const anonKey = process.env.DELETION_TEST_ANON_KEY;
const emailDomain = process.env.DELETION_TEST_EMAIL_DOMAIN ?? "example.com";
const clientOptions = { auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false } };
const service = createClient(url, process.env.DELETION_TEST_SERVICE_ROLE_KEY, clientOptions);
const run = randomUUID().slice(0, 8);
const password = `Deletion-${randomUUID()}`;
const createdUserIds = [];
const cleanup = { reportIds: [], orderIds: [] };
// 1x1 transparent PNG; job-images only accepts image MIME types.
const PNG_BYTES = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=", "base64");

let failures = 0;
function check(name, condition, detail = "") {
  if (condition) console.log(`ok   ${name}`);
  else {
    failures += 1;
    console.error(`FAIL ${name}${detail ? ` (${detail})` : ""}`);
  }
}

function must(result, step) {
  if (result.error) throw new Error(`${step}: ${result.error.message}`);
  return result.data;
}

async function createAccount(label, role) {
  const email = `deletion-test+${label}-${run}@${emailDomain}`;
  const data = must(await service.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { role } }), `create ${label}`);
  createdUserIds.push(data.user.id);
  return { id: data.user.id, email };
}

async function signIn(account) {
  const client = createClient(url, anonKey, clientOptions);
  const data = must(await client.auth.signInWithPassword({ email: account.email, password }), `sign in ${account.email}`);
  return { client, token: data.session.access_token };
}

async function deleteViaApi(account) {
  const { token } = await signIn(account);
  const response = await fetch(`${appUrl}/api/account`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ password }),
  });
  return response.status;
}

async function authUserExists(userId) {
  const { data, error } = await service.auth.admin.getUserById(userId);
  return !error && Boolean(data?.user);
}

async function count(table, column, value) {
  const { count: rows, error } = await service.from(table).select("*", { count: "exact", head: true }).eq(column, value);
  if (error) throw new Error(`count ${table}: ${error.message}`);
  return rows ?? 0;
}

async function storageCount(bucket, userId) {
  const data = must(await service.storage.from(bucket).list(userId, { limit: 100 }), `list ${bucket}`);
  return data.filter((entry) => entry.id).length;
}

try {
  // Fixtures: an admin verifies the company, so verified_by_user_id points at the admin.
  const admin = await createAccount("admin", "private");
  const company = await createAccount("company", "company");
  const youth = await createAccount("youth", "youth");
  const bystander = await createAccount("bystander", "youth");
  must(await service.from("admin_users").insert({ user_id: admin.id }), "grant admin");
  must(await service.from("company_profiles").update({ company_name: `Raderingstest ${run}`, organization_number: "5560000000" }).eq("user_id", company.id), "company org number");

  const adminSession = await signIn(admin);
  const companySession = await signIn(company);
  const youthSession = await signIn(youth);
  must(await adminSession.client.rpc("review_company_verification", { p_company_user_id: company.id, p_decision: "verified" }), "verify company");

  const job = must(await service.from("jobs").insert({ company_user_id: company.id, company_name: `Raderingstest ${run}`, title: `Raderingstest ${run}` }).select("id").single(), "create job");
  must(await service.storage.from("job-images").upload(`${company.id}/deletion-test.png`, PNG_BYTES, { contentType: "image/png" }), "upload job image");
  must(await service.storage.from("youth-documents").upload(`${youth.id}/deletion-test.txt`, Buffer.from("CV"), { contentType: "text/plain" }), "upload youth document");

  must(await service.from("swipe_actions").insert([
    { youth_user_id: youth.id, job_id: job.id, decision: "interested" },
    { youth_user_id: bystander.id, job_id: job.id, decision: "interested" },
  ]), "create swipes");
  must(await service.from("youth_saved_jobs").insert({ youth_user_id: bystander.id, job_id: job.id }), "save job");
  must(await service.from("youth_application_drafts").insert({ youth_user_id: bystander.id, job_id: job.id }), "create draft");

  const matchRows = must(await companySession.client.rpc("review_candidate_and_match", { p_job_id: job.id, p_youth_user_id: youth.id, p_decision: "interested" }), "create match");
  const { match_id: matchId, conversation_id: conversationId } = matchRows[0];
  const message = must(await service.from("messages").insert({ conversation_id: conversationId, sender_user_id: company.id, message_text: `Testmeddelande ${run}` }).select("id").single(), "create message");
  must(await companySession.client.rpc("mark_match_hired", { p_match_id: matchId }), "mark hired");

  const reportId = must(await youthSession.client.rpc("submit_moderation_report", { p_target_type: "message", p_target_id: message.id, p_reason: "harassment", p_details: "Raderingstest" }), "submit report");
  cleanup.reportIds.push(reportId);
  must(await adminSession.client.rpc("review_moderation_report", { p_report_id: reportId, p_status: "reviewing" }), "admin reviews report");

  const premiumRows = must(await service.rpc("activate_premium", {
    p_company_user_id: company.id, p_product_code: "job_boost_7d", p_job_id: job.id,
    p_starts_at: new Date().toISOString(), p_source: "manual",
    p_source_reference: `deletion-test-${run}`, p_idempotency_key: randomUUID(),
  }), "activate premium");
  const { order_id: orderId, entitlement_id: entitlementId } = premiumRows[0];
  cleanup.orderIds.push(orderId);

  // 1. Admins cannot self-delete; after offboarding the reviewer reference is cleared.
  check("Admin self-deletion is refused", await deleteViaApi(admin) === 409);
  check("Refused admin account still exists", await authUserExists(admin.id));
  must(await service.from("admin_users").delete().eq("user_id", admin.id), "offboard admin");
  check("Offboarded admin can delete account", await deleteViaApi(admin) === 204);
  check("Admin auth user is gone", !(await authUserExists(admin.id)));
  const verifiedCompany = must(await service.from("company_profiles").select("verification_status, verified_by_user_id").eq("user_id", company.id).single(), "read company");
  check("Company stays verified after reviewer deletion", verifiedCompany.verification_status === "verified");
  check("verified_by_user_id is cleared, not dangling", verifiedCompany.verified_by_user_id === null, String(verifiedCompany.verified_by_user_id));
  const reviewedReport = must(await service.from("moderation_reports").select("reviewed_by_user_id").eq("id", reportId).single(), "read report");
  check("Report reviewer is anonymised", reviewedReport.reviewed_by_user_id === null);

  // 2. Youth deletion removes their data and the shared match, but keeps the report evidence.
  check("Youth can delete account", await deleteViaApi(youth) === 204);
  check("Youth auth user is gone", !(await authUserExists(youth.id)));
  check("Youth profile is gone", await count("profiles", "id", youth.id) === 0 && await count("youth_profiles", "user_id", youth.id) === 0);
  check("Youth swipes are gone", await count("swipe_actions", "youth_user_id", youth.id) === 0);
  check("Hired match is gone", await count("matches", "id", matchId) === 0);
  check("Conversation and messages are gone", await count("conversations", "id", conversationId) === 0 && await count("messages", "id", message.id) === 0);
  check("Youth documents are gone", await storageCount("youth-documents", youth.id) === 0);
  const keptReport = must(await service.from("moderation_reports").select("reporter_user_id, target_snapshot").eq("id", reportId).single(), "read kept report");
  check("Report is kept with anonymised reporter", keptReport.reporter_user_id === null);
  check("Report keeps the message snapshot", keptReport.target_snapshot?.message_text === `Testmeddelande ${run}`);
  const companyNotices = must(await service.from("notifications").select("id").eq("user_id", company.id).eq("type", "account_deleted"), "read notices");
  check("Company is told the chat closed", companyNotices.length === 1);
  check("Company and job are untouched", await count("company_profiles", "user_id", company.id) === 1 && await count("jobs", "id", job.id) === 1);

  // 3. Company deletion removes its jobs and everything attached to them; premium history is anonymised.
  check("Company can delete account", await deleteViaApi(company) === 204);
  check("Company auth user is gone", !(await authUserExists(company.id)));
  check("Company jobs are gone", await count("jobs", "company_user_id", company.id) === 0);
  check("Job images are gone", await storageCount("job-images", company.id) === 0);
  check("Bystander swipe, saved job and draft are gone",
    await count("swipe_actions", "youth_user_id", bystander.id) === 0
    && await count("youth_saved_jobs", "youth_user_id", bystander.id) === 0
    && await count("youth_application_drafts", "youth_user_id", bystander.id) === 0);
  const order = must(await service.from("premium_orders").select("company_user_id, job_id, status").eq("id", orderId).single(), "read order");
  check("Premium order is cancelled and anonymised", order.status === "cancelled" && order.company_user_id === null && order.job_id === null);
  const keptEntitlement = must(await service.from("premium_entitlements").select("company_user_id, job_id, state").eq("id", entitlementId).single(), "read entitlement");
  check("Premium entitlement is cancelled and anonymised", keptEntitlement.state === "cancelled" && keptEntitlement.company_user_id === null && keptEntitlement.job_id === null);

  // 4. Cross-account: an unrelated youth keeps their account.
  const bystanderSession = await signIn(bystander);
  const ownProfile = await bystanderSession.client.from("youth_profiles").select("user_id").eq("user_id", bystander.id).maybeSingle();
  check("Bystander youth keeps account and profile", !ownProfile.error && ownProfile.data?.user_id === bystander.id);
} finally {
  for (const reportId of cleanup.reportIds) await service.from("moderation_reports").delete().eq("id", reportId);
  for (const orderId of cleanup.orderIds) {
    await service.from("premium_activation_events").delete().eq("order_id", orderId);
    await service.from("premium_entitlements").delete().eq("order_id", orderId);
    await service.from("premium_orders").delete().eq("id", orderId);
  }
  for (const userId of createdUserIds) {
    await service.storage.from("youth-documents").remove([`${userId}/deletion-test.txt`]);
    await service.storage.from("job-images").remove([`${userId}/deletion-test.png`]);
    await service.from("admin_users").delete().eq("user_id", userId);
    if (await authUserExists(userId)) await service.auth.admin.deleteUser(userId);
  }
}

if (failures) {
  console.error(`${failures} account deletion check(s) failed.`);
  process.exit(1);
}
console.log("All account deletion checks passed.");
