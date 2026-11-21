import { isInvoicePilotDev } from "./invoice-pilot";

export function stripeTestCheckoutVisible() {
  return isInvoicePilotDev() && process.env.NEXT_PUBLIC_STRIPE_TEST_CHECKOUT === "true";
}

export function stripeCheckoutUrl(value: unknown, expectedSessionId?: string): string | null {
  if (typeof value !== "string") return null;
  try {
    const url = new URL(value);
    if (url.origin !== "https://checkout.stripe.com" || url.username || url.password) return null;
    const sessionId = /^\/(?:[a-z-]+\/)*(cs_test_[A-Za-z0-9]+)$/.exec(url.pathname)?.[1];
    return sessionId && (expectedSessionId === undefined || sessionId === expectedSessionId) ? url.href : null;
  } catch {
    return null;
  }
}
