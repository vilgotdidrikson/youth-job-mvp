import { HIRE_TEST_TERMS } from "@/lib/current-offer";
import { getSupabaseClient } from "@/lib/supabase";
import { getSupabaseErrorMessage } from "@/lib/supabase-errors";

export type HireTestInvoice = {
  id: string;
  amount_ore: number;
  buyer_name: string;
  address_line1: string;
  address_line2: string | null;
  postal_code: string;
  city: string;
  issued_on: string;
  due_on: string;
  held_at: string | null;
  paid_at: string | null;
  invoice_email?: string | null;
  mail_state?: "pending" | "sending" | "sent" | "review" | "cancelled" | "not_queued" | "test_recipient_mismatch";
};

export type HireBankInvoice = HireTestInvoice & {
  invoice_number: string;
  buyer_org: string;
  seller: { name: string; address: string; reference: string; bankgiro: string };
  mail_state: "pending" | "sending" | "sent" | "review";
};

export type HireBankInvoiceOffer = { version: string; acceptance: string; terms: string; seller: string };

export async function getHireBankInvoiceOffer(signal?: AbortSignal): Promise<HireBankInvoiceOffer | null> {
  const request = getSupabaseClient().rpc("get_hire_bank_invoice_offer");
  const { data, error } = await (signal ? request.abortSignal(signal) : request);
  if (error || (data !== null && (typeof data?.version !== "string" || typeof data.acceptance !== "string" || typeof data.terms !== "string" || typeof data.seller !== "string"))) {
    throw new Error("Pris och betalningsvillkor kunde inte hämtas.");
  }
  return data;
}

export function invoiceAmount(amountOre: number) {
  return new Intl.NumberFormat("sv-SE", { style: "currency", currency: "SEK", maximumFractionDigits: 2 }).format(amountOre / 100);
}

export async function getHireTestOffer(signal?: AbortSignal): Promise<typeof HIRE_TEST_TERMS | null> {
  const request = getSupabaseClient().rpc("hire_invoice_test_offer");
  const { data, error } = await (signal ? request.abortSignal(signal) : request);
  if (error || (data !== null && data !== HIRE_TEST_TERMS)) throw new Error("Pris och villkor kunde inte hämtas.");
  return data;
}

export type RecruitmentInvoiceStatus = "none" | "pending" | "issued" | "held";

export async function getRecruitmentInvoiceStatus(matchId: string, signal: AbortSignal): Promise<RecruitmentInvoiceStatus> {
  const { data, error } = await getSupabaseClient().rpc("get_recruitment_invoice_status", { p_match_id: matchId }).abortSignal(signal);
  if (error || (data !== "none" && data !== "pending" && data !== "issued" && data !== "held")) {
    throw new Error("Fakturastatusen kunde inte hämtas.");
  }
  return data;
}

export async function listHireInvoices(admin: boolean, signal: AbortSignal, live: boolean): Promise<(HireTestInvoice | HireBankInvoice)[]> {
  const { data, error } = await getSupabaseClient().rpc(live ? "list_hire_bank_invoices" : "list_hire_test_invoices", { p_admin: admin }).abortSignal(signal);
  if (error || !Array.isArray(data)) throw new Error("Fakturorna kunde inte hämtas.");
  return data;
}

export async function recordHireInvoicePayment(id: string, amountOre: number, reference: string, live: boolean) {
  const { error } = await getSupabaseClient().rpc(live ? "record_hire_bank_payment" : "record_hire_test_payment", {
    p_invoice: id,
    p_amount_ore: amountOre,
    p_reference: reference,
  });
  if (error) throw new Error(getSupabaseErrorMessage(error, "Betalningen kunde inte stämmas av."));
}
