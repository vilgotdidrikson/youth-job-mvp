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
};

export function invoiceAmount(amountOre: number) {
  return new Intl.NumberFormat("sv-SE", { style: "currency", currency: "SEK", maximumFractionDigits: 2 }).format(amountOre / 100);
}

export async function getHireTestOffer(): Promise<typeof HIRE_TEST_TERMS | null> {
  const { data, error } = await getSupabaseClient().rpc("hire_invoice_test_offer");
  if (error || (data !== null && data !== HIRE_TEST_TERMS)) throw new Error("Pris och villkor kunde inte hämtas.");
  return data;
}

export async function listHireTestInvoices(admin: boolean, signal: AbortSignal): Promise<HireTestInvoice[]> {
  const { data, error } = await getSupabaseClient().rpc("list_hire_test_invoices", { p_admin: admin }).abortSignal(signal);
  if (error || !Array.isArray(data)) throw new Error("Testfakturorna kunde inte hämtas.");
  return data;
}

export async function recordHireTestPayment(id: string, amountOre: number, reference: string) {
  const { error } = await getSupabaseClient().rpc("record_hire_test_payment", {
    p_invoice: id,
    p_amount_ore: amountOre,
    p_reference: reference,
  });
  if (error) throw new Error(getSupabaseErrorMessage(error, "Testbetalningen kunde inte bekräftas."));
}
