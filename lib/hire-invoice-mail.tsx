import { renderToBuffer } from "@react-pdf/renderer";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { SendMailOptions } from "nodemailer";
import { CONTACT_EMAIL } from "@/lib/product-copy";
import { HireTestInvoicePdf } from "@/lib/hire-test-invoice-pdf";
import type { HireTestInvoice } from "@/lib/hire-test-invoices";

type MailJob = { invoice: HireTestInvoice; recipient: string; lease: string };
type Outcome = "sent" | "retry" | "review" | "cancelled";
type Deliver = (message: SendMailOptions) => Promise<{ accepted: unknown[] }>;

export async function buildHireInvoiceMail(job: MailJob): Promise<SendMailOptions> {
  const number = `TEST-${job.invoice.id}`;
  const amount = new Intl.NumberFormat("sv-SE", { style: "currency", currency: "SEK" })
    .format(job.invoice.amount_ore / 100);
  const pdf = await renderToBuffer(<HireTestInvoicePdf invoice={job.invoice} amount={amount}/>);
  return {
    from: { name: "MatchnWork", address: CONTACT_EMAIL },
    to: { name: "", address: job.recipient },
    envelope: { from: CONTACT_EMAIL, to: [job.recipient] },
    messageId: `<hire-invoice-${job.invoice.id}@matchnwork.se>`,
    subject: `Testfaktura ${number} från MatchnWork`,
    text: "Hej! En anställning har bekräftats i MatchnWorks testmiljö. Testfakturan finns som PDF i det här mejlet. Den ska inte betalas.\n\nMatchnWork",
    attachments: [{ filename: `${number}.pdf`, content: pdf, contentType: "application/pdf" }],
  };
}

export async function processHireInvoiceMail(client: SupabaseClient, recipient: string, deliver: Deliver) {
  const { data, error } = await client.rpc("claim_hire_test_invoice_mail", { p_recipient: recipient });
  if (error) throw new Error("Could not claim invoice email");
  if (!data) return "idle";
  const job: MailJob = data;
  const identity = { p_invoice: job.invoice.id, p_lease: job.lease };
  const finish = async (outcome: Outcome) => {
    const result = await client.rpc("finish_hire_test_invoice_mail", { ...identity, p_outcome: outcome });
    if (result.error || result.data !== true) throw new Error("Could not record invoice email outcome");
    return outcome;
  };

  if (job.recipient !== recipient) return finish("review");
  let message: SendMailOptions;
  try { message = await buildHireInvoiceMail(job); }
  catch { return finish("retry"); }

  const ready = await client.rpc("hire_test_invoice_mail_ready", identity);
  if (ready.error) throw new Error("Could not validate invoice email claim");
  if (ready.data !== true) return finish("cancelled");

  let delivery: Awaited<ReturnType<Deliver>>;
  try { delivery = await deliver(message); }
  catch (reason) {
    const code = (reason as { responseCode?: number } | null)?.responseCode;
    // A negative SMTP reply is explicit. A timeout or dropped connection may occur after acceptance.
    return finish(typeof code === "number" && code >= 400 && code < 500 ? "retry" : "review");
  }
  return finish(delivery.accepted.includes(recipient) ? "sent" : "review");
}
