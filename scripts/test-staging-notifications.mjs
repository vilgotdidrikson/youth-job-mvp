/*
 * Disposable-staging end-to-end test for F14 notifications. Creates throwaway
 * fictional company, youth and admin accounts with the staging service-role
 * key, runs the real triggers and RLS, executes lib/notifications.ts with each
 * user's own session and always deletes the accounts again. DevStaging only.
 *
 * Run: node --env-file=.env.deletion scripts/test-staging-notifications.mjs
 */
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { createRequire, Module } from "node:module";
import ts from "typescript";
import { createClient } from "@supabase/supabase-js";

const required = ["DELETION_TEST_SUPABASE_URL", "DELETION_TEST_ANON_KEY", "DELETION_TEST_SERVICE_ROLE_KEY", "DELETION_TEST_ALLOW_WRITES"];
const missing = required.filter((name) => !process.env[name]);
if (missing.length) throw new Error(`Missing staging test environment variables: ${missing.join(", ")}`);
const url = process.env.DELETION_TEST_SUPABASE_URL.replace(/\/$/, "");
if (new URL(url).hostname !== "vwcfjvwfeatvuisojwrh.supabase.co") throw new Error("Refusing to run: not MatchnWork DevStaging.");
if (process.env.DELETION_TEST_ALLOW_WRITES !== "true") throw new Error("Set DELETION_TEST_ALLOW_WRITES=true only for disposable staging test data.");

const anonKey = process.env.DELETION_TEST_ANON_KEY;
const emailDomain = process.env.DELETION_TEST_EMAIL_DOMAIN ?? "example.com";
const clientOptions = { auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false } };
const service = createClient(url, process.env.DELETION_TEST_SERVICE_ROLE_KEY, clientOptions);
const run = randomUUID().slice(0, 8);
const password = `Notis-${randomUUID()}`;
const createdUserIds = [];
const jobIds = [];
let failures = 0;
const check = (name, condition, detail = "") => {
  if (condition) console.log(`ok   ${name}`);
  else { failures += 1; console.error(`FAIL ${name}${detail ? ` (${detail})` : ""}`); }
};
const must = (result, step) => { if (result.error) throw new Error(`${step}: ${result.error.message}`); return result.data; };

async function createAccount(label, role) {
  const email = `f14-test+${label}-${run}@${emailDomain}`;
  const data = must(await service.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { role } }), `create ${label}`);
  createdUserIds.push(data.user.id);
  return { id: data.user.id, email };
}
async function signIn(account) {
  const client = createClient(url, anonKey, clientOptions);
  must(await client.auth.signInWithPassword({ email: account.email, password }), `sign in ${account.email}`);
  return client;
}

// Load the real lib/notifications.ts with a chosen session as its Supabase client.
const require = createRequire(import.meta.url);
Module._extensions[".ts"] = (module, file) => module._compile(ts.transpileModule(readFileSync(file, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, file);
let activeClient = null;
const load = Module._load;
Module._load = function (request, parent, ...rest) {
  if (request === "@/lib/supabase") return { getSupabaseClient: () => activeClient };
  return load.call(this, request, parent, ...rest);
};
const notifications = require("../lib/notifications.ts");
Module._load = load;
const as = (client, fn) => { activeClient = client; return fn(); };

const companyName = `QA Notistest AB ${run}`, youthName = `QA Testungdom ${run}`, jobTitle = `QA Kassabiträde ${run}`;
const notices = async (userId, type) => must(await service.from("notifications").select("*").eq("user_id", userId).eq("type", type).order("created_at"), `read ${type}`);

try {
  const admin = await createAccount("admin", "youth");
  const company = await createAccount("company", "company");
  const youth = await createAccount("youth", "youth");
  must(await service.from("admin_users").insert({ user_id: admin.id }), "grant admin");
  must(await service.from("company_profiles").update({ company_name: companyName, organization_number: "5560000000" }).eq("user_id", company.id), "company profile");
  must(await service.from("youth_profiles").update({ full_name: youthName }).eq("user_id", youth.id), "youth name");
  const adminClient = await signIn(admin), companyClient = await signIn(company), youthClient = await signIn(youth);
  must(await adminClient.rpc("review_company_verification", { p_company_user_id: company.id, p_decision: "verified" }), "verify company");
  const job = must(await service.from("jobs").insert({ company_user_id: company.id, company_name: companyName, title: jobTitle }).select("id").single(), "create job");
  jobIds.push(job.id);

  // Candidate interest names the job.
  must(await service.from("swipe_actions").insert({ youth_user_id: youth.id, job_id: job.id, decision: "interested" }), "swipe");
  const [interest] = await notices(company.id, "candidate_interest");
  check("Candidate interest names the job", interest?.body === `En ungdom har visat intresse för ${jobTitle}.`, interest?.body);

  // Match: named, exact link, match_id.
  const [{ match_id: matchId, conversation_id: conversationId }] = must(await companyClient.rpc("review_candidate_and_match", { p_job_id: job.id, p_youth_user_id: youth.id, p_decision: "interested" }), "create match");
  const [youthMatch] = await notices(youth.id, "match"), [companyMatch] = await notices(company.id, "match");
  check("Youth match notice names the company", youthMatch?.title === `Ny match med ${companyName}`, youthMatch?.title);
  check("Company match notice names the youth", companyMatch?.title === `Ny match med ${youthName}`, companyMatch?.title);
  check("Match notice names the job", youthMatch?.body === `Ni kan börja chatta om ${jobTitle}.`, youthMatch?.body);
  check("Match notice opens the exact match", youthMatch?.href === `/chats?match=${matchId}` && youthMatch?.match_id === matchId, youthMatch?.href);

  // Messages sent by the real company session; one unread notice per match.
  must(await companyClient.from("messages").insert({ conversation_id: conversationId, sender_user_id: company.id, message_text: `QA hej ${run}` }), "message 1");
  let youthMessages = await notices(youth.id, "message");
  check("First message notice names sender and job", youthMessages.length === 1 && youthMessages[0].title === `Nytt meddelande från ${companyName}` && youthMessages[0].body === `Gäller ${jobTitle}.`, JSON.stringify(youthMessages.map(item => item.title)));
  check("Message notice opens the exact conversation", youthMessages[0]?.href === `/chats?conversation=${conversationId}`, youthMessages[0]?.href);
  check("Sender gets no notice for own message", (await notices(company.id, "message")).length === 0);
  must(await companyClient.from("messages").insert({ conversation_id: conversationId, sender_user_id: company.id, message_text: `QA hej igen ${run}` }), "message 2");
  youthMessages = await notices(youth.id, "message");
  check("Second message reuses the unread notice", youthMessages.length === 1 && youthMessages[0].title === `Nya meddelanden från ${companyName}`, `${youthMessages.length} rows`);

  // The youth's own session sees its notices, and the chat's real read call clears them.
  const visible = must(await youthClient.from("notifications").select("type").eq("user_id", youth.id).is("read_at", null), "youth reads own notices");
  check("Youth sees own unread match and message notices via RLS", visible.filter(item => item.type === "match" || item.type === "message").length === 2, JSON.stringify(visible));
  const cleared = await as(youthClient, () => notifications.markMatchNotificationsRead(youth.id, matchId));
  check("Opening the chat marks the match's notices read", cleared === true);
  const left = must(await youthClient.from("notifications").select("id").eq("user_id", youth.id).eq("match_id", matchId).is("read_at", null), "unread after open");
  check("No unread notices left for the opened chat (badge clears)", left.length === 0, `${left.length} left`);
  check("Marking again reports no change (no needless badge refresh)", (await as(youthClient, () => notifications.markMatchNotificationsRead(youth.id, matchId))) === false);
  check("A user cannot mark another user's notices", (await as(youthClient, () => notifications.markMatchNotificationsRead(company.id, matchId))) === false);
  check("Company's unread match notice untouched", (await notices(company.id, "match"))[0]?.read_at === null);

  // After reading, the next message is a new unread notice; a reply notifies the company by name.
  must(await companyClient.from("messages").insert({ conversation_id: conversationId, sender_user_id: company.id, message_text: `QA ny fråga ${run}` }), "message 3");
  youthMessages = await notices(youth.id, "message");
  check("New message after reading gives a new unread notice", youthMessages.length === 2 && youthMessages.filter(item => !item.read_at).length === 1);
  must(await youthClient.from("messages").insert({ conversation_id: conversationId, sender_user_id: youth.id, message_text: `QA svar ${run}` }), "youth reply");
  check("Company message notice names the youth", (await notices(company.id, "message"))[0]?.title === `Nytt meddelande från ${youthName}`);

  // Status change names the company, the job and the status.
  must(await service.from("matches").update({ status: "interview" }).eq("id", matchId), "status interview");
  const [status] = await notices(youth.id, "recruitment_status");
  check("Status notice names company, job and status", status?.title === `Uppdaterad rekrytering hos ${companyName}` && status?.body === `Status för ${jobTitle}: intervju.`, `${status?.title} / ${status?.body}`);
  check("Status notice opens the exact match", status?.href === `/chats?match=${matchId}`);

  // Mark all as read with the real function.
  await as(youthClient, () => notifications.markAllNotificationsRead(youth.id));
  const unread = must(await youthClient.from("notifications").select("id").eq("user_id", youth.id).is("read_at", null), "unread after mark all");
  check("Markera alla som lästa clears every youth notice", unread.length === 0, `${unread.length} left`);
  check("Message contents never appear in notices", !JSON.stringify(await notices(youth.id, "message")).includes("QA hej"));
} catch (error) {
  failures += 1;
  console.error(`FAIL setup or step: ${error instanceof Error ? error.message : error}`);
} finally {
  for (const jobId of jobIds) await service.from("jobs").delete().eq("id", jobId);
  for (const userId of createdUserIds) {
    await service.from("admin_users").delete().eq("user_id", userId);
    const { error } = await service.auth.admin.deleteUser(userId);
    if (error) { failures += 1; console.error(`FAIL cleanup ${userId}: ${error.message}`); }
  }
  console.log(`cleanup: ${createdUserIds.length} throwaway accounts deleted`);
}
if (failures) { console.error(`${failures} check(s) failed`); process.exit(1); }
console.log("PASS F14 staging: named notices, exact links, single unread message notice, read on open, RLS isolation, status text, mark all.");
