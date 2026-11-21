import { isInvoicePilotDev } from "./invoice-pilot";

export function stripeTestCheckoutVisible() {
  return isInvoicePilotDev() && process.env.NEXT_PUBLIC_STRIPE_TEST_CHECKOUT === "true";
}

export function stripeCheckoutUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;
  try {
    const url = new URL(value);
    return url.origin === "https://checkout.stripe.com" && !url.username && !url.password
      && url.pathname.startsWith("/c/pay/cs_test_") ? url.href : null;
  } catch {
    return null;
  }
}
