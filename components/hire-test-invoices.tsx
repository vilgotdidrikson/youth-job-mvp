"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { getHireTestOffer, invoiceAmount, listHireInvoices, recordHireInvoicePayment, type HireBankInvoice, type HireTestInvoice } from "@/lib/hire-test-invoices";
import { isInvoicePilotDev } from "@/lib/invoice-pilot";
import styles from "./company-billing-settings.module.css";
import { stripeCheckoutUrl, stripeTestCheckoutVisible } from "@/lib/stripe-test-checkout";
import { getSupabaseClient } from "@/lib/supabase";

type Invoice = HireTestInvoice | HireBankInvoice;
const deliveryLabels: Record<NonNullable<HireTestInvoice["mail_state"]>, string> = {
  pending: "Väntar på utskick",
  sending: "Utskick pågår",
  sent: "Skickat",
  review: "Behöver följas upp",
  cancelled: "Stoppat för rättelse",
  not_queued: "Utskick saknas",
  test_recipient_mismatch: "Adressen matchar inte devs godkända testinkorg",
};

async function download(invoice: Invoice) {
  const [{ pdf }, { HireTestInvoicePdf }, { downloadPdfFile }] = await Promise.all([
    import("@react-pdf/renderer"), import("@/lib/hire-test-invoice-pdf"), import("@/lib/cv-pdf"),
  ]);
  const blob = await pdf(<HireTestInvoicePdf invoice={invoice} amount={invoiceAmount(invoice.amount_ore)} />).toBlob();
  const number = "invoice_number" in invoice ? invoice.invoice_number : `TEST-${invoice.id}`;
  downloadPdfFile(new File([blob], `${number}.pdf`, { type: "application/pdf" }));
}

function InvoiceRow({ invoice, admin, onPaid, stripeUser }: { invoice: Invoice; admin: boolean; onPaid: () => void; stripeUser?: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const lock = useRef(false);
  const run = async (action: () => Promise<void>) => {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    try { await action(); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Åtgärden kunde inte slutföras."); }
    finally { lock.current = false; setBusy(false); }
  };
  const bank = "invoice_number" in invoice ? invoice : null;
  const checkout = () => void run(async () => {
    const auth = getSupabaseClient().auth;
    const current = await auth.getSession();
    const session = current.data.session;
    if (!stripeUser || current.error || session?.user.id !== stripeUser) throw new Error("Logga in igen för att fortsätta.");
    const response = await fetch(`/api/company/stripe-test-checkout?invoice=${encodeURIComponent(invoice.id)}`, {
      method: "POST", cache: "no-store", credentials: "omit", redirect: "error",
      headers: { Authorization: `Bearer ${session.access_token}` }, signal: AbortSignal.timeout(25000),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(typeof result?.error === "string" ? result.error : "Stripe kunde inte öppnas.");
    const latest = await auth.getSession();
    if (latest.error || latest.data.session?.user.id !== stripeUser) throw new Error("Kontot har ändrats. Öppna fakturan igen.");
    if (result?.paid === true) { onPaid(); return; }
    const url = stripeCheckoutUrl(result?.url);
    if (!url) throw new Error("Stripe kunde inte öppnas.");
    window.location.assign(url);
  });
  const settle = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const fields = new FormData(event.currentTarget);
    const amountOre = Number(fields.get("amount")) * 100;
    const reference = String(fields.get("reference")).trim().toUpperCase();
    void run(async () => {
      await recordHireInvoicePayment(invoice.id, amountOre, reference, bank !== null);
      onPaid();
    });
  };
  return <li>
    <h3>{invoice.buyer_name} · {invoiceAmount(invoice.amount_ore)}</h3>
    <p>{bank?.invoice_number ?? `TEST-${invoice.id}`}</p>
    <p>Utfärdad {invoice.issued_on} · {invoice.held_at ? "Pausad för rättelse" : invoice.paid_at ? "Betalning avstämd" : "Inväntar avstämning"}</p>
    <p>{bank ? "Förfallodatum" : "Simulerat förfallodatum"} {invoice.due_on}</p>
    {invoice.invoice_email && <p>Fakturaadress för mejl <strong>{invoice.invoice_email}</strong></p>}
    {invoice.mail_state && <p>Mejlet · {deliveryLabels[invoice.mail_state]}</p>}
    <button className="secondary-btn" type="button" disabled={busy} onClick={() => void run(() => download(invoice))}>{bank ? "Ladda ner faktura (PDF)" : "Ladda ner testfaktura (PDF)"}</button>
    {stripeUser && !bank && !invoice.held_at && !invoice.paid_at && <button className="cta-btn" type="button" onClick={checkout} disabled={busy}>Testbetala med Stripe</button>}
    {admin && !invoice.held_at && !invoice.paid_at && <form onSubmit={settle}>
      <div className={styles.fields}>
        <label className={styles.field}>{bank ? "Inbetalt belopp (kr)" : "Simulerat belopp (kr)"}<input name="amount" type="number" min="1" max="1000" step="1" required disabled={busy}/></label>
        <label className={styles.field}>{bank ? "Bankens transaktionsreferens" : "Fiktiv referens"}<input name="reference" placeholder={bank ? undefined : "TEST-001"} maxLength={bank ? 60 : 40} required disabled={busy}/></label>
      </div>
      <button className="secondary-btn" type="submit" disabled={busy}>{bank ? "Stäm av bankbetalning" : "Stäm av testbetalning"}</button>
    </form>}
    {error && <p role="alert" className={styles.error}>{error}</p>}
  </li>;
}

function HireInvoices({ admin = false, live, showEmpty = false, stripeUser }: { admin?: boolean; live: boolean; showEmpty?: boolean; stripeUser?: string }) {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [available, setAvailable] = useState(showEmpty || admin);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refresh, setRefresh] = useState(0);
  const reload = () => { setLoading(true); setRefresh(value => value + 1); };
  useEffect(() => {
    const controller = new AbortController();
    const signal = AbortSignal.any([controller.signal, AbortSignal.timeout(12_000)]);
    const load = async () => {
      try {
        const enabled = live || showEmpty || admin || Boolean(await getHireTestOffer(signal));
        if (controller.signal.aborted) return;
        if (!live) setAvailable(enabled);
        if (!enabled) return;
        const rows = await listHireInvoices(admin, signal, live);
        if (!controller.signal.aborted) { setInvoices(rows); setError(""); if (live) setAvailable(admin || showEmpty || rows.length > 0); }
      } catch {
        if (!controller.signal.aborted) {
          setAvailable(true);
          setError("Fakturorna kunde inte hämtas. Försök igen.");
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    };
    void load();
    return () => controller.abort();
  }, [admin, live, refresh, showEmpty]);
  if (!available) return null;
  const title = live ? admin ? "Bankgirofakturor" : "Fakturor" : "Testfakturor";
  return <section className={styles.card} aria-label={title}>
    <h2>{title}</h2>
    {!live && <p className={styles.intro}>Använd bara testuppgifter här. Testbetalningar drar inga riktiga pengar.</p>}
    {loading ? <p role="status">Hämtar fakturor…</p> : error ? <p className={styles.error} role="alert">{error}</p> : invoices.length ?
      <ul className={styles.invoiceList}>{invoices.map(invoice => <InvoiceRow key={invoice.id} invoice={invoice} admin={admin} onPaid={reload} stripeUser={stripeUser}/>)}</ul> : <p>{live ? "Inga utfärdade fakturor ännu." : "En testfaktura visas här när kandidaten bekräftar en anställning som registrerats med testvillkoren."}</p>}
    <button className="secondary-btn" type="button" disabled={loading} onClick={reload}>Uppdatera fakturor</button>
  </section>;
}

export function HireTestInvoices({ admin, companyView = false, userId }: { admin?: boolean; companyView?: boolean; userId?: string }) {
  const dev = isInvoicePilotDev();
  const stripeUser = companyView && stripeTestCheckoutVisible() ? userId : undefined;
  return <><HireInvoices admin={admin} live={false} showEmpty={companyView && dev} stripeUser={stripeUser}/><HireInvoices admin={admin} live showEmpty={companyView && !dev}/></>;
}
