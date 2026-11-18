const DEV_URL = "https://vwcfjvwfeatvuisojwrh.supabase.co";
export function isInvoicePilotDev() {
  return process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "") === DEV_URL;
}
