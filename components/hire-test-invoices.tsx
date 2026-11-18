"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { getHireTestOffer, invoiceAmount, listHireTestInvoices, recordHireTestPayment, type HireTestInvoice } from "@/lib/hire-test-invoices";
import styles from "./company-billing-settings.module.css";

async function download(invoice: HireTestInvoice) {
  const [{ pdf }, { HireTestInvoicePdf }, { downloadPdfFile }] = await Promise.all([
    import("@react-pdf/renderer"), import("@/lib/hire-test-invoice-pdf"), import("@/lib/cv-pdf"),
  ]);
  const blob = await pdf(<HireTestInvoicePdf invoice={invoice} amount={invoiceAmount(invoice.amount_ore)} />).toBlob();
  downloadPdfFile(new File([blob], `TEST-${invoice.id}.pdf`, { type: "application/pdf" }));
}

function InvoiceRow({ invoice, admin, onPaid }: { invoice: HireTestInvoice; admin: boolean; onPaid: () => void }) {
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
  const settle = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const fields = new FormData(event.currentTarget);
    const amountOre = Number(fields.get("amount")) * 100;
    const reference = String(fields.get("reference")).trim().toUpperCase();
    void run(async () => {
      await recordHireTestPayment(invoice.id, amountOre, reference);
      onPaid();
    });
  };
  return <li>
    <h3>{invoice.buyer_name} · {invoiceAmount(invoice.amount_ore)}</h3>
    <p>TEST-{invoice.id}</p>
    <p>{invoice.issued_on} · {invoice.held_at ? "Pausad för rättelse" : invoice.paid_at ? "Testbetalning avstämd" : "Inväntar testavstämning"}</p>
    <button className="secondary-btn" type="button" disabled={busy} onClick={() => void run(() => download(invoice))}>Ladda ner testfaktura (PDF)</button>
    {admin && !invoice.held_at && !invoice.paid_at && <form onSubmit={settle}>
      <div className={styles.fields}>
        <label className={styles.field}>Simulerat belopp (kr)<input name="amount" type="number" min="1" max="1000" step="1" required disabled={busy}/></label>
        <label className={styles.field}>Fiktiv referens<input name="reference" placeholder="TEST-001" maxLength={40} required disabled={busy}/></label>
      </div>
      <button className="secondary-btn" type="submit" disabled={busy}>Stäm av testbetalning</button>
    </form>}
    {error && <p role="alert" className={styles.error}>{error}</p>}
  </li>;
}

export function HireTestInvoices({ admin = false }: { admin?: boolean }) {
  const [invoices, setInvoices] = useState<HireTestInvoice[]>([]);
  const [available, setAvailable] = useState(admin);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refresh, setRefresh] = useState(0);
  const reload = () => { setLoading(true); setRefresh(value => value + 1); };
  useEffect(() => {
    const controller = new AbortController();
    const load = async () => {
      try {
        const enabled = admin || Boolean(await getHireTestOffer());
        if (controller.signal.aborted) return;
        setAvailable(enabled);
        if (!enabled) return;
        const rows = await listHireTestInvoices(admin, controller.signal);
        if (!controller.signal.aborted) { setInvoices(rows); setError(""); }
      } catch {
        if (!controller.signal.aborted) setError("Testfakturorna kunde inte hämtas. För admin krävs tvåstegsverifiering.");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    };
    void load();
    return () => controller.abort();
  }, [admin, refresh]);
  if (!available) return null;
  return <section className={styles.card} aria-label="Testfakturor">
    <h2>Testfakturor</h2>
    <p className={styles.intro}>All betalning i det här flödet är simulerad. Testfakturorna ska inte betalas.</p>
    {loading ? <p role="status">Hämtar testfakturor…</p> : error ? <p className={styles.error} role="alert">{error}</p> : invoices.length ?
      <ul className={styles.invoiceList}>{invoices.map(invoice => <InvoiceRow key={invoice.id} invoice={invoice} admin={admin} onPaid={reload}/>)}</ul> : <p>Inga utfärdade testfakturor.</p>}
    <button className="secondary-btn" type="button" disabled={loading} onClick={reload}>Uppdatera testfakturor</button>
  </section>;
}
