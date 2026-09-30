/*
 * Direct staging RLS checks. This never uses the service-role key and never
 * targets production. It expects four pre-created staging accounts and the
 * fixture IDs listed in scripts/rls-staging.env.example.
 *
 * Run: node --env-file=.env.rls scripts/test-staging-rls.mjs
 */
import { randomUUID } from "node:crypto";

const required = [
  "RLS_TEST_APP_URL", "RLS_TEST_SUPABASE_URL", "RLS_TEST_ANON_KEY",
  "RLS_TEST_YOUTH_A_ID", "RLS_TEST_YOUTH_B_ID",
  "RLS_TEST_COMPANY_A_ID", "RLS_TEST_COMPANY_B_ID",
  "RLS_TEST_COMPANY_A_JOB_ID", "RLS_TEST_ACTIVE_JOB_ID", "RLS_TEST_PAUSED_JOB_ID", "RLS_TEST_CLOSED_JOB_ID",
  "RLS_TEST_COMPANY_A_CONVERSATION_ID", "RLS_TEST_HIRE_MATCH_ID", "RLS_TEST_HIRE_CONVERSATION_ID", "RLS_TEST_HIRE_MULTI_POSITION_JOB_ID",
  "RLS_TEST_YOUTH_A_AI_SESSION_ID", "RLS_TEST_YOUTH_A_DOCUMENT_PATH",
  "RLS_TEST_ALLOW_WRITES",
];
const missing = required.filter((name) => !process.env[name]);
if (missing.length) throw new Error(`Missing RLS test environment variables: ${missing.join(", ")}`);

const authActors = {
  youthA: ["RLS_TEST_YOUTH_A_TOKEN", "RLS_TEST_YOUTH_A_EMAIL", "RLS_TEST_YOUTH_A_PASSWORD"],
  youthB: ["RLS_TEST_YOUTH_B_TOKEN", "RLS_TEST_YOUTH_B_EMAIL", "RLS_TEST_YOUTH_B_PASSWORD"],
  companyA: ["RLS_TEST_COMPANY_A_TOKEN", "RLS_TEST_COMPANY_A_EMAIL", "RLS_TEST_COMPANY_A_PASSWORD"],
  companyB: ["RLS_TEST_COMPANY_B_TOKEN", "RLS_TEST_COMPANY_B_EMAIL", "RLS_TEST_COMPANY_B_PASSWORD"],
};
const missingAuth = Object.entries(authActors).flatMap(([actor, [tokenName, emailName, passwordName]]) => {
  if (process.env[tokenName] || (process.env[emailName] && process.env[passwordName])) return [];
  return [`${actor}: ${tokenName} or ${emailName} + ${passwordName}`];
});
if (missingAuth.length) throw new Error(`Missing RLS test authentication: ${missingAuth.join("; ")}`);

const url = process.env.RLS_TEST_SUPABASE_URL.replace(/\/$/, "");
const appUrl = process.env.RLS_TEST_APP_URL.replace(/\/$/, "");
if (new URL(url).hostname !== "vwcfjvwfeatvuisojwrh.supabase.co") {
  throw new Error("Refusing to run: RLS_TEST_SUPABASE_URL is not MatchnWork DevStaging.");
}
if (new URL(appUrl).hostname !== "youth-job-mvp-dev.vercel.app") {
  throw new Error("Refusing to run: RLS_TEST_APP_URL is not the Employo dev deployment.");
}
if (process.env.RLS_TEST_ALLOW_WRITES !== "true") {
  throw new Error("Set RLS_TEST_ALLOW_WRITES=true only for disposable staging test data.");
}

const anonKey = process.env.RLS_TEST_ANON_KEY;
const ids = {
  youthA: process.env.RLS_TEST_YOUTH_A_ID,
  youthB: process.env.RLS_TEST_YOUTH_B_ID,
  companyA: process.env.RLS_TEST_COMPANY_A_ID,
  companyB: process.env.RLS_TEST_COMPANY_B_ID,
  companyAJob: process.env.RLS_TEST_COMPANY_A_JOB_ID,
  activeJob: process.env.RLS_TEST_ACTIVE_JOB_ID,
  pausedJob: process.env.RLS_TEST_PAUSED_JOB_ID,
  closedJob: process.env.RLS_TEST_CLOSED_JOB_ID,
  conversation: process.env.RLS_TEST_COMPANY_A_CONVERSATION_ID,
  hireMatch: process.env.RLS_TEST_HIRE_MATCH_ID,
  hireConversation: process.env.RLS_TEST_HIRE_CONVERSATION_ID,
  hireMultiPositionJob: process.env.RLS_TEST_HIRE_MULTI_POSITION_JOB_ID,
  aiSession: process.env.RLS_TEST_YOUTH_A_AI_SESSION_ID,
  youthADocument: process.env.RLS_TEST_YOUTH_A_DOCUMENT_PATH,
};
async function resolveToken(tokenName, emailName, passwordName) {
  if (process.env[tokenName]) return process.env[tokenName];
  const response = await fetch(`${url}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: anonKey, "Content-Type": "application/json" },
    body: JSON.stringify({ email: process.env[emailName], password: process.env[passwordName] }),
  });
  const body = await response.json().catch(() => null);
  if (!response.ok || !body?.access_token) {
    throw new Error(`Could not sign in ${emailName} for the staging RLS suite (HTTP ${response.status}).`);
  }
  return body.access_token;
}

const tokens = { anonymous: null };
for (const [actor, names] of Object.entries(authActors)) {
  tokens[actor] = await resolveToken(...names);
}
let failed = 0;

async function rest(actor, path, options = {}) {
  const headers = new Headers({ apikey: anonKey, ...options.headers });
  if (tokens[actor]) headers.set("Authorization", `Bearer ${tokens[actor]}`);
  if (options.body) headers.set("Content-Type", "application/json");
  const response = await fetch(`${url}/rest/v1/${path}`, { ...options, headers });
  const text = await response.text();
  let body = text;
  try { body = text ? JSON.parse(text) : null; } catch { /* keep text */ }
  return { status: response.status, body };
}

async function storage(actor, path, options = {}) {
  const headers = new Headers({ apikey: anonKey, ...options.headers });
  if (tokens[actor]) headers.set("Authorization", `Bearer ${tokens[actor]}`);
  const response = await fetch(`${url}/storage/v1/object/${path}`, { ...options, headers });
  return { status: response.status, body: await response.text() };
}

async function app(actor, path, body) {
  const headers = new Headers({ "Content-Type": "application/json" });
  if (tokens[actor]) headers.set("Authorization", `Bearer ${tokens[actor]}`);
  const response = await fetch(`${appUrl}${path}`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  const text = await response.text();
  let parsed = text;
  try { parsed = text ? JSON.parse(text) : null; } catch { /* keep text */ }
  return { status: response.status, body: parsed };
}

function check(name, passed, actual) {
  console.log(`${passed ? "PASS" : "FAIL"}: ${name} (${actual})`);
  if (!passed) failed += 1;
}

function denied(response) {
  return response.status === 401 || response.status === 403 || (response.status === 200 && Array.isArray(response.body) && response.body.length === 0);
}

async function readIsDenied(name, actor, table, filter) {
  const response = await rest(actor, `${table}?select=*&${filter}`);
  check(name, denied(response), `HTTP ${response.status}`);
}

// Anonymous and cross-youth privacy boundaries.
await readIsDenied("Anonymous cannot read Youth A profile", "anonymous", "youth_profiles", `user_id=eq.${ids.youthA}`);
await readIsDenied("Youth B cannot read Youth A profile", "youthB", "youth_profiles", `user_id=eq.${ids.youthA}`);
await readIsDenied("Youth B cannot read Youth A applications", "youthB", "swipe_actions", `youth_user_id=eq.${ids.youthA}`);
await readIsDenied("Youth B cannot read Youth A matches", "youthB", "matches", `youth_user_id=eq.${ids.youthA}`);
await readIsDenied("Youth B cannot read Company A conversation", "youthB", "conversations", `id=eq.${ids.conversation}`);
await readIsDenied("Youth B cannot read Company A messages", "youthB", "messages", `conversation_id=eq.${ids.conversation}`);

// These fixture jobs must be reserved for this suite. Youth A needs a completed
// CV and the active job must have no existing swipe from Youth A.
async function createSwipe(actor, youthId, jobId) {
  return rest(actor, "swipe_actions", {
    method: "POST", headers: { Prefer: "return=representation" },
    body: JSON.stringify({ youth_user_id: youthId, job_id: jobId, decision: "interested" }),
  });
}
const activeSwipe = await createSwipe("youthA", ids.youthA, ids.activeJob);
check("Youth A can apply to active job", activeSwipe.status === 201, `HTTP ${activeSwipe.status}`);
const pausedSwipe = await createSwipe("youthA", ids.youthA, ids.pausedJob);
check("Youth A cannot apply to paused job", denied(pausedSwipe), `HTTP ${pausedSwipe.status}`);
const closedSwipe = await createSwipe("youthA", ids.youthA, ids.closedJob);
check("Youth A cannot apply to closed job", denied(closedSwipe), `HTTP ${closedSwipe.status}`);
const spoofedSwipe = await createSwipe("youthB", ids.youthA, ids.activeJob);
check("Youth B cannot apply as Youth A", denied(spoofedSwipe), `HTTP ${spoofedSwipe.status}`);

const ownCandidates = await rest("companyA", "rpc/get_company_candidates", {
  method: "POST",
  body: JSON.stringify({ p_job_id: ids.activeJob }),
});
check(
  "Company A can list interested candidates for its own job",
  ownCandidates.status === 200 && Array.isArray(ownCandidates.body) && ownCandidates.body.some((candidate) => candidate.user_id === ids.youthA),
  `HTTP ${ownCandidates.status}`,
);
const foreignCandidates = await rest("companyB", "rpc/get_company_candidates", {
  method: "POST",
  body: JSON.stringify({ p_job_id: ids.activeJob }),
});
check("Company B cannot list Company A candidates", denied(foreignCandidates), `HTTP ${foreignCandidates.status}`);
const youthCandidates = await rest("youthA", "rpc/get_company_candidates", {
  method: "POST",
  body: JSON.stringify({ p_job_id: ids.activeJob }),
});
check("Youth cannot use the company candidate RPC", denied(youthCandidates), `HTTP ${youthCandidates.status}`);
const anonymousCandidates = await rest("anonymous", "rpc/get_company_candidates", {
  method: "POST",
  body: JSON.stringify({ p_job_id: ids.activeJob }),
});
check("Anonymous visitor cannot use the company candidate RPC", denied(anonymousCandidates), `HTTP ${anonymousCandidates.status}`);

// The Next.js CV proxy uses the service role only after authenticating the
// caller and checking company verification, listing ownership and an explicit
// interested swipe. A signed URL must never cross those boundaries.
const ownCandidateCv = await app("companyA", "/api/company/candidate-cv", {
  jobId: ids.activeJob,
  youthUserId: ids.youthA,
});
check(
  "Company A can open an interested candidate CV for its own job",
  ownCandidateCv.status === 200 && typeof ownCandidateCv.body?.url === "string" && typeof ownCandidateCv.body?.expiresAt === "string",
  `HTTP ${ownCandidateCv.status}`,
);
const foreignCandidateCv = await app("companyB", "/api/company/candidate-cv", {
  jobId: ids.activeJob,
  youthUserId: ids.youthA,
});
check("Company B cannot open Company A candidate CV", foreignCandidateCv.status === 403, `HTTP ${foreignCandidateCv.status}`);
const youthCandidateCv = await app("youthA", "/api/company/candidate-cv", {
  jobId: ids.activeJob,
  youthUserId: ids.youthA,
});
check("Youth cannot use the company CV proxy", youthCandidateCv.status === 403, `HTTP ${youthCandidateCv.status}`);
const anonymousCandidateCv = await app("anonymous", "/api/company/candidate-cv", {
  jobId: ids.activeJob,
  youthUserId: ids.youthA,
});
check("Anonymous visitor cannot use the company CV proxy", anonymousCandidateCv.status === 401, `HTTP ${anonymousCandidateCv.status}`);
const noInterestCandidateCv = await app("companyA", "/api/company/candidate-cv", {
  jobId: ids.activeJob,
  youthUserId: ids.youthB,
});
check("Company A cannot open a CV without candidate interest", noInterestCandidateCv.status === 403, `HTTP ${noInterestCandidateCv.status}`);

// Company review is allowed only for the company-owned job where that youth
// actually has an interested swipe. The active fixture above provides that.
const ownInterest = await rest("companyA", "company_interest_actions", {
  method: "POST", headers: { Prefer: "return=representation" },
  body: JSON.stringify({ company_user_id: ids.companyA, youth_user_id: ids.youthA, job_id: ids.activeJob, decision: "skip" }),
});
check("Company A can review an interested candidate for its own job", ownInterest.status === 201, `HTTP ${ownInterest.status}`);
const foreignInterest = await rest("companyB", "company_interest_actions", {
  method: "POST", body: JSON.stringify({ company_user_id: ids.companyB, youth_user_id: ids.youthA, job_id: ids.activeJob, decision: "skip" }),
});
check("Company B cannot review Company A job", denied(foreignInterest), `HTTP ${foreignInterest.status}`);
const noInterest = await rest("companyA", "company_interest_actions", {
  method: "POST", body: JSON.stringify({ company_user_id: ids.companyA, youth_user_id: ids.youthB, job_id: ids.activeJob, decision: "skip" }),
});
check("Company A cannot review a youth without interest", denied(noInterest), `HTTP ${noInterest.status}`);
const youthCreatesMatch = await rest("youthA", "matches", {
  method: "POST", body: JSON.stringify({ youth_user_id: ids.youthA, company_user_id: ids.companyA, job_id: ids.activeJob }),
});
check("Youth cannot create a match directly", denied(youthCreatesMatch), `HTTP ${youthCreatesMatch.status}`);
const companyBCreatesMatch = await rest("companyB", "matches", {
  method: "POST", body: JSON.stringify({ youth_user_id: ids.youthA, company_user_id: ids.companyB, job_id: ids.activeJob }),
});
check("Company B cannot create match for Company A job", denied(companyBCreatesMatch), `HTTP ${companyBCreatesMatch.status}`);
if (activeSwipe.status === 201) {
  const cleanupInterest = await rest("companyA", `company_interest_actions?company_user_id=eq.${ids.companyA}&youth_user_id=eq.${ids.youthA}&job_id=eq.${ids.activeJob}`, { method: "DELETE" });
  check("Cleanup company-interest fixture", cleanupInterest.status >= 200 && cleanupInterest.status < 300, `HTTP ${cleanupInterest.status}`);
  const cleanupSwipe = await rest("youthA", `swipe_actions?youth_user_id=eq.${ids.youthA}&job_id=eq.${ids.activeJob}`, { method: "DELETE" });
  check("Cleanup youth application fixture", cleanupSwipe.status >= 200 && cleanupSwipe.status < 300, `HTTP ${cleanupSwipe.status}`);
}

// Company B must not gain control of Company A's listing, candidate data or chat.
const foreignJobUpdate = await rest("companyB", `jobs?id=eq.${ids.companyAJob}`, {
  method: "PATCH", headers: { Prefer: "return=representation" }, body: JSON.stringify({ title: "RLS ATTACK" }),
});
check("Company B cannot update Company A job", denied(foreignJobUpdate), `HTTP ${foreignJobUpdate.status}`);
await readIsDenied("Company B cannot read Company A conversation", "companyB", "conversations", `id=eq.${ids.conversation}`);
await readIsDenied("Company B cannot read Company A messages", "companyB", "messages", `conversation_id=eq.${ids.conversation}`);
const spoofedMessage = await rest("companyB", "messages", {
  method: "POST", body: JSON.stringify({ conversation_id: ids.conversation, sender_user_id: ids.companyA, message_text: "RLS ATTACK" }),
});
check("Company B cannot spoof a sender or message in Company A conversation", denied(spoofedMessage), `HTTP ${spoofedMessage.status}`);

// Hiring must use the server-side RPC: only the actual listing owner can
// complete a legitimate match, and it must not remove chat history or close a
// multi-position job. These fixtures are intentionally disposable because the
// successful event is persistent.
const hireMessagesBefore = await rest("companyA", `messages?select=id&conversation_id=eq.${ids.hireConversation}`);
const foreignHire = await rest("companyB", "rpc/mark_match_hired", {
  method: "POST", body: JSON.stringify({ p_match_id: ids.hireMatch }),
});
check("Company B cannot mark Company A match as hired", denied(foreignHire), `HTTP ${foreignHire.status}`);
const youthHire = await rest("youthA", "rpc/mark_match_hired", {
  method: "POST", body: JSON.stringify({ p_match_id: ids.hireMatch }),
});
check("Youth cannot mark themselves as hired", denied(youthHire), `HTTP ${youthHire.status}`);
const completedHire = await rest("companyA", "rpc/mark_match_hired", {
  method: "POST", body: JSON.stringify({ p_match_id: ids.hireMatch }),
});
const hiredMatch = Array.isArray(completedHire.body) ? completedHire.body[0] : null;
check("Company A can mark its legitimate match as hired", completedHire.status === 200 && hiredMatch?.status === "hired" && hiredMatch?.hire_completed_at, `HTTP ${completedHire.status}`);
const hireMessagesAfter = await rest("companyA", `messages?select=id&conversation_id=eq.${ids.hireConversation}`);
check("Hire keeps conversation messages", hireMessagesBefore.status === 200 && hireMessagesAfter.status === 200 && Array.isArray(hireMessagesBefore.body) && Array.isArray(hireMessagesAfter.body) && hireMessagesBefore.body.length === hireMessagesAfter.body.length, `HTTP ${hireMessagesAfter.status}`);
const multiPositionJob = await rest("companyA", `jobs?select=status,open_positions&id=eq.${ids.hireMultiPositionJob}`);
const multiPositionRow = Array.isArray(multiPositionJob.body) ? multiPositionJob.body[0] : null;
check("One hire does not auto-close a multi-position job", multiPositionJob.status === 200 && multiPositionRow?.open_positions > 1 && multiPositionRow?.status !== "closed", `HTTP ${multiPositionJob.status}`);

// AI onboarding is youth-private raw data.
const ownAi = await rest("youthA", `ai_onboarding_sessions?select=id&id=eq.${ids.aiSession}`);
check("Youth A can read own AI-onboarding session", ownAi.status === 200 && Array.isArray(ownAi.body) && ownAi.body.length === 1, `HTTP ${ownAi.status}`);
await readIsDenied("Youth B cannot read Youth A AI-onboarding", "youthB", "ai_onboarding_sessions", `id=eq.${ids.aiSession}`);
await readIsDenied("Company cannot read Youth A AI-onboarding", "companyA", "ai_onboarding_sessions", `id=eq.${ids.aiSession}`);
await readIsDenied("Anonymous cannot read Youth A AI-onboarding", "anonymous", "ai_onboarding_sessions", `id=eq.${ids.aiSession}`);

// Premium fixtures are optional while the backend is being introduced. When
// supplied, they prove that only the owning company can see its fulfilment
// records; youth accounts and other companies never receive order data.
const premiumOrderId = process.env.RLS_TEST_PREMIUM_ORDER_ID;
if (premiumOrderId) {
  const ownPremium = await rest("companyA", `premium_orders?select=id&id=eq.${premiumOrderId}`);
  check("Company A can read its own premium order", ownPremium.status === 200 && Array.isArray(ownPremium.body) && ownPremium.body.length === 1, `HTTP ${ownPremium.status}`);
  await readIsDenied("Company B cannot read Company A premium order", "companyB", "premium_orders", `id=eq.${premiumOrderId}`);
  await readIsDenied("Youth cannot read Company A premium order", "youthA", "premium_orders", `id=eq.${premiumOrderId}`);
  await readIsDenied("Anonymous cannot read Company A premium order", "anonymous", "premium_orders", `id=eq.${premiumOrderId}`);
} else {
  console.log("SKIP: premium RLS fixture (set RLS_TEST_PREMIUM_ORDER_ID to enable)");
}

// Storage: public reads remain possible, but writes are company-owned.
const objectName = `${ids.companyA}/${randomUUID()}.png`;
const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScL5mwAAAABJRU5ErkJggg==", "base64");
const uploadA = await storage("companyA", `job-images/${objectName}`, {
  method: "POST", headers: { "Content-Type": "image/png", "x-upsert": "false" }, body: png,
});
check("Company A can upload to its own job-images path", uploadA.status >= 200 && uploadA.status < 300, `HTTP ${uploadA.status}`);
const publicRead = await storage("anonymous", `job-images/${objectName}`, { method: "GET" });
check("Public can read a legitimate job image", publicRead.status >= 200 && publicRead.status < 300, `HTTP ${publicRead.status}`);
const foreignPathUpload = await storage("companyB", `job-images/${ids.companyA}/${randomUUID()}.png`, {
  method: "POST", headers: { "Content-Type": "image/png", "x-upsert": "false" }, body: png,
});
check("Company B cannot upload to Company A path", denied(foreignPathUpload), `HTTP ${foreignPathUpload.status}`);
const youthUpload = await storage("youthA", `job-images/${ids.youthA}/${randomUUID()}.png`, {
  method: "POST", headers: { "Content-Type": "image/png", "x-upsert": "false" }, body: png,
});
check("Youth cannot upload job image", denied(youthUpload), `HTTP ${youthUpload.status}`);
const anonymousUpload = await storage("anonymous", `job-images/${ids.companyA}/${randomUUID()}.png`, {
  method: "POST", headers: { "Content-Type": "image/png", "x-upsert": "false" }, body: png,
});
check("Anonymous cannot upload job image", denied(anonymousUpload), `HTTP ${anonymousUpload.status}`);
const foreignDelete = await storage("companyB", `job-images/${objectName}`, { method: "DELETE" });
check("Company B cannot delete Company A image", denied(foreignDelete), `HTTP ${foreignDelete.status}`);
const ownDelete = await storage("companyA", `job-images/${objectName}`, { method: "DELETE" });
check("Company A can delete its own image", ownDelete.status >= 200 && ownDelete.status < 300, `HTTP ${ownDelete.status}`);
const youthDocument = await storage("youthB", `youth-documents/${ids.youthADocument}`, { method: "GET" });
check("Youth B cannot download Youth A document", denied(youthDocument), `HTTP ${youthDocument.status}`);
const ownYouthDocument = await storage("youthA", `youth-documents/${ids.youthADocument}`, { method: "GET" });
check("Youth A can download own document", ownYouthDocument.status >= 200 && ownYouthDocument.status < 300, `HTTP ${ownYouthDocument.status}`);

if (failed) process.exitCode = 1;
