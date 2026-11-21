import "server-only";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";
import { isUuid } from "../privacy-cases";
import { stripeCheckoutUrl, stripeTestCheckoutVisible } from "../stripe-test-checkout";
import { COMPANY_ROUTES } from "../company-navigation";

type Action = "reserve" | "attach" | "expire" | "settle";
type CheckoutState = { paid: true } | { attempt: string; reservedAt: string; session: string | null; amount: number };
const headers = { "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer" };
const invoiceUrl = new URL(COMPANY_ROUTES.invoices, "https://youth-job-mvp-dev.vercel.app");
const fail = (status: number, message: string) => Response.json({ error: message }, { status, headers });

function checkoutServices() {
  const secret = process.env.STRIPE_TEST_SECRET_KEY;
  const webhookSecret = process.env.STRIPE_TEST_WEBHOOK_SECRET;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!stripeTestCheckoutVisible() || !secret?.startsWith("sk_test_") || !webhookSecret?.startsWith("whsec_") || !url || !key || !serviceRole) return null;
  const auth = { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false };
  return {
    stripe: new Stripe(secret, { timeout: 8000, maxNetworkRetries: 1 }),
    webhookSecret,
    user: createClient(url, key, { auth }),
    db: createClient(url, serviceRole, { auth }),
  };
}
type Services = NonNullable<ReturnType<typeof checkoutServices>>;

async function change(services: Services, action: Action, invoice: string, params: { company?: string; attempt?: string; session?: string; amount?: number }) {
  const { data, error } = await services.db.rpc("hire_test_stripe_checkout", {
    p_action: action, p_invoice: invoice, p_company: params.company ?? null, p_attempt: params.attempt ?? null,
    p_session: params.session ?? null, p_amount: params.amount ?? null,
  }).abortSignal(AbortSignal.timeout(8000));
  if (error) throw new Error("Database checkout operation failed");
  return data;
}

function paymentBinding(session: Stripe.Checkout.Session) {
  const invoice = session.client_reference_id;
  const attempt = session.metadata?.attempt;
  const amount = session.amount_total;
  if (session.livemode || session.mode !== "payment" || session.currency !== "sek" ||
    !session.id.startsWith("cs_test_") || !invoice || !isUuid(invoice) || !attempt || !isUuid(attempt) ||
    typeof amount !== "number" || !Number.isSafeInteger(amount) || amount <= 0) return null;
  return { invoice, attempt, amount, session: session.id };
}

async function reserve(services: Services, invoice: string, company: string): Promise<CheckoutState | null> {
  const data = await change(services, "reserve", invoice, { company });
  if (!data || data.paid === true) return data;
  if (!isUuid(data.attempt) || !Number.isFinite(Date.parse(data.reservedAt)) || !Number.isSafeInteger(data.amount) ||
    data.amount <= 0 || (data.session !== null && !/^cs_test_[A-Za-z0-9]+$/.test(data.session))) throw new Error("Invalid invoice reservation");
  return data;
}

export async function startStripeTestCheckout(request: Request) {
  const services = checkoutServices();
  if (!services) return fail(404, "Stripe-testet är inte aktiverat.");
  if (request.headers.get("sec-fetch-site") === "cross-site") return fail(403, "Begäran kunde inte godkännas.");
  const token = /^Bearer ([^\s]{1,16384})$/i.exec(request.headers.get("authorization") ?? "")?.[1];
  if (!token) return fail(401, "Logga in igen för att fortsätta.");
  const invoice = new URL(request.url).searchParams.get("invoice");
  if (!invoice || !isUuid(invoice)) return fail(400, "Fakturan kunde inte identifieras.");

  try {
    const { data, error } = await services.user.auth.getUser(token);
    if (error || !data.user) return fail(401, "Logga in igen för att fortsätta.");
    const company = data.user.id;
    for (let round = 0; round < 2; round++) {
      const state = await reserve(services, invoice, company);
      if (!state) return fail(404, "Den här testfakturan är inte tillgänglig för betalning.");
      if ("paid" in state) return Response.json({ paid: true }, { headers });
      if (!state.session && Date.now() - Date.parse(state.reservedAt) >= 23 * 3600 * 1000) {
        return fail(409, "Det tidigare försöket behöver kontrolleras av MatchnWork.");
      }
      const session = state.session ? await services.stripe.checkout.sessions.retrieve(state.session) :
        await services.stripe.checkout.sessions.create({
          mode: "payment", allowed_payment_method_types: ["card"], client_reference_id: invoice,
          metadata: { attempt: state.attempt },
          line_items: [{ quantity: 1, price_data: { currency: "sek", unit_amount: state.amount, product_data: { name: "MatchnWork testfaktura" } } }],
          success_url: invoiceUrl.href, cancel_url: invoiceUrl.href,
        }, { idempotencyKey: state.attempt });
      const binding = paymentBinding(session);
      if (!binding || binding.invoice !== invoice || binding.attempt !== state.attempt || binding.amount !== state.amount) throw new Error("Checkout binding mismatch");
      if (session.status === "expired") {
        await change(services, "expire", invoice, binding);
        continue;
      }
      if (session.status === "complete" && session.payment_status === "paid") {
        if (!await change(services, "settle", invoice, binding)) throw new Error("Settlement not confirmed");
        return Response.json({ paid: true }, { headers });
      }
      const url = stripeCheckoutUrl(session.url);
      if (session.status !== "open" || !url) return fail(409, "Stripe behandlar den befintliga testbetalningen. Försök igen senare.");
      const attached = await change(services, "attach", invoice, binding);
      if (attached?.paid) return Response.json({ paid: true }, { headers });
      if (attached?.ok) return Response.json({ url }, { headers });
      return fail(409, "Testfakturan kunde inte öppnas för betalning.");
    }
    return fail(409, "Testbetalningen behöver hämtas på nytt. Försök igen.");
  } catch {
    return fail(503, "Stripe kunde inte bekräfta betalningssidan. Försök igen för att kontrollera samma betalning.");
  }
}

async function webhookPayload(request: Request): Promise<Buffer> {
  if (!request.body) throw new Error("Missing Stripe body");
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const result = await reader.read();
      if (result.done) return Buffer.concat(chunks, size);
      size += result.value.length;
      if (size > 128 * 1024) throw new Error("Oversized Stripe body");
      chunks.push(result.value);
    }
  } finally {
    void reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}

export async function handleStripeTestWebhook(request: Request) {
  const services = checkoutServices();
  if (!services) return fail(404, "Stripe-testet är inte aktiverat.");
  const signature = request.headers.get("stripe-signature");
  if (!signature || signature.length > 4096) return fail(400, "Ogiltig Stripe-signatur.");
  let event: Stripe.Event;
  try {
    event = services.stripe.webhooks.constructEvent(await webhookPayload(request), signature, services.webhookSecret);
  } catch {
    return fail(400, "Ogiltig Stripe-signatur.");
  }
  if (event.livemode || !["checkout.session.completed", "checkout.session.expired"].includes(event.type)) return new Response(null, { status: 204, headers });
  const object = event.data.object;
  if (object.object !== "checkout.session" || !object.id.startsWith("cs_test_")) return new Response(null, { status: 204, headers });
  try {
    const session = await services.stripe.checkout.sessions.retrieve(object.id);
    const binding = paymentBinding(session);
    if (binding && session.status === "complete" && session.payment_status === "paid") {
      await change(services, "settle", binding.invoice, binding);
    } else if (binding && session.status === "expired") {
      await change(services, "expire", binding.invoice, binding);
    }
    return new Response(null, { status: 204, headers });
  } catch {
    return fail(503, "Avstämningen kunde inte slutföras ännu.");
  }
}
