import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire, Module } from "node:module";
import Stripe from "stripe";
import ts from "typescript";

const require = createRequire(import.meta.url);
const originalLoad = Module._load;
const originalTs = Module._extensions[".ts"];
const invoice = "11111111-1111-4111-8111-111111111111";
const owner = "22222222-2222-4222-8222-222222222222";
const attempt = "33333333-3333-4333-8333-333333333333";
const sessionId = "cs_test_Example123";
const stripeUrl = "https://checkout.stripe.com/pay/" + sessionId + "#fake";
const state = { attempt, reservedAt: new Date().toISOString(), amount: 50000, session: null };
const sdk = new Stripe("sk_test_FAKE_ONLY");
const openSession = {
  id: sessionId, object: "checkout.session", client_reference_id: invoice, metadata: { attempt },
  amount_total: 50000, currency: "sek", livemode: false, mode: "payment",
  status: "open", payment_status: "unpaid", url: stripeUrl,
};
let saved, provider = openSession, writes = [], creates = [], reads = 0, failStore = false;

class MockStripe {
  webhooks = sdk.webhooks;
  checkout = { sessions: {
    create: async (body, options) => { creates.push({ body, options }); return provider; },
    retrieve: async id => { assert.equal(id, sessionId); reads++; return provider; },
  } };
}
function client(_url, key) {
  if (key === "qa-publishable") return { auth: { getUser: async token => token === "qa-owner" ?
    { data: { user: { id: owner } }, error: null } : { data: { user: null }, error: true } } };
  return { rpc(name, args) {
    assert.equal(name, "hire_test_stripe_checkout");
    writes.push(args);
    return { abortSignal: async () => {
      if (args.p_action === "reserve") {
        assert.equal(args.p_company, owner);
        return { data: args.p_invoice === invoice ? saved : null };
      }
      if (failStore) return { error: true };
      assert.equal(args.p_invoice, invoice);
      assert.equal(args.p_attempt, attempt);
      assert.equal(args.p_amount, 50000);
      assert.equal(args.p_session, sessionId);
      return { data: { ok: true } };
    } };
  } };
}

Module._extensions[".ts"] = (m, f) => m._compile(ts.transpileModule(readFileSync(f, "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
}).outputText, f);
Module._load = function(name, ...args) {
  if (name === "stripe") return MockStripe;
  if (name === "@supabase/supabase-js") return { createClient: client };
  if (name === "server-only") return {};
  return originalLoad.call(this, name, ...args);
};
Object.assign(process.env, {
  NEXT_PUBLIC_SUPABASE_URL: "https://vwcfjvwfeatvuisojwrh.supabase.co",
  NEXT_PUBLIC_STRIPE_TEST_CHECKOUT: "true",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "qa-publishable",
  SUPABASE_SERVICE_ROLE_KEY: "qa-service",
  STRIPE_TEST_SECRET_KEY: "sk_test_FAKE_ONLY",
  STRIPE_TEST_WEBHOOK_SECRET: "whsec_FAKE_ONLY",
});

try {
  const { startStripeTestCheckout, handleStripeTestWebhook } = require("../lib/server/stripe-test-checkout.ts");
  const { stripeCheckoutUrl } = require("../lib/stripe-test-checkout.ts");
  const request = (token, id = invoice) => new Request("https://example.invalid/api?invoice=" + id, {
    method: "POST", headers: token ? { Authorization: "Bearer " + token } : {},
  });
  const webhook = (eventType, secret = process.env.STRIPE_TEST_WEBHOOK_SECRET, live = false) => {
    const payload = JSON.stringify({ type: eventType, livemode: live, data: { object: { object: "checkout.session", id: sessionId } } });
    const signature = sdk.webhooks.generateTestHeaderString({ payload, secret });
    return new Request("https://example.invalid/webhook", { method: "POST", headers: { "Stripe-Signature": signature }, body: payload });
  };
  saved = state;
  assert.equal((await startStripeTestCheckout(request())).status, 401);
  assert.equal((await startStripeTestCheckout(request("wrong"))).status, 401);
  assert.equal((await startStripeTestCheckout(request("qa-owner", owner))).status, 404);
  assert.equal(creates.length, 0);
  for (const url of ["https://checkout.stripe.com.evil.invalid/pay/cs_test_ABC", "https://checkout.stripe.com/pay/cs_live_ABC", "http://checkout.stripe.com/pay/cs_test_ABC", "https://checkout.stripe.com/pay/cs_test_ABC/extra", "https://user@checkout.stripe.com/pay/cs_test_ABC"]) {
    assert.equal(stripeCheckoutUrl(url), null);
  }
  const legacyUrl = "https://checkout.stripe.com/c/pay/" + sessionId + "#fake";
  assert.equal(stripeCheckoutUrl(legacyUrl, sessionId), legacyUrl);
  assert.equal(stripeCheckoutUrl(stripeUrl), stripeUrl);
  const opened = await startStripeTestCheckout(request("qa-owner"));
  assert.deepEqual(await opened.json(), { url: stripeUrl });
  assert.equal(creates[0].options.idempotencyKey, attempt);
  assert.equal(creates[0].body.line_items[0].price_data.unit_amount, 50000);
  assert.deepEqual(Object.keys(creates[0].body.metadata), ["attempt"]);
  failStore = true;
  assert.equal((await startStripeTestCheckout(request("qa-owner"))).status, 503);
  assert.equal(creates.at(-1).options.idempotencyKey, attempt, "Unknown outcome retries the same Stripe session");
  failStore = false;
  saved = { ...state, reservedAt: new Date(Date.now() - 24 * 3600000).toISOString() };
  assert.equal((await startStripeTestCheckout(request("qa-owner"))).status, 409);
  assert.equal(creates.length, 2, "Expired idempotency window never creates a second session");
  const beforeMismatchedUrl = writes.length;
  saved = state;
  provider = { ...openSession, url: "https://checkout.stripe.com/pay/cs_test_Different" };
  assert.equal((await startStripeTestCheckout(request("qa-owner"))).status, 503);
  assert.deepEqual(writes.slice(beforeMismatchedUrl).map(write => write.p_action), ["reserve"]);
  saved = { ...state, session: sessionId };
  provider = { ...openSession, status: "complete", payment_status: "paid" };
  assert.deepEqual(await (await startStripeTestCheckout(request("qa-owner"))).json(), { paid: true });
  assert.equal(writes.at(-1).p_action, "settle");

  assert.equal((await handleStripeTestWebhook(webhook("checkout.session.completed", "whsec_WRONG"))).status, 400);
  assert.equal((await handleStripeTestWebhook(webhook("checkout.session.completed", undefined, true))).status, 204);
  assert.equal(reads, 1, "Rejected or live events never trigger provider lookup");
  assert.equal((await handleStripeTestWebhook(webhook("checkout.session.completed"))).status, 204);
  assert.equal(writes.at(-1).p_action, "settle");
  provider = { ...openSession, status: "expired" };
  assert.equal((await handleStripeTestWebhook(webhook("checkout.session.expired"))).status, 204);
  assert.equal(writes.at(-1).p_action, "expire");
  provider = { ...openSession, currency: "usd", status: "complete", payment_status: "paid" };
  const before = writes.length;
  assert.equal((await handleStripeTestWebhook(webhook("checkout.session.completed"))).status, 204);
  assert.equal(writes.length, before, "Currency mismatch cannot settle a test invoice");
  process.env.STRIPE_TEST_SECRET_KEY = "sk_live_FAKE_ONLY";
  assert.equal((await startStripeTestCheckout(request("qa-owner"))).status, 404);
  process.env.STRIPE_TEST_SECRET_KEY = "sk_test_FAKE_ONLY";
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://production.invalid";
  assert.equal((await startStripeTestCheckout(request("qa-owner"))).status, 404);
  console.log("PASS Stripe sandbox routes: Auth, owned invoice, server amount, retries, signature, provider re-read, paid/expired and production lock.");
} finally {
  Module._load = originalLoad;
  if (originalTs) Module._extensions[".ts"] = originalTs;
  else delete Module._extensions[".ts"];
}
