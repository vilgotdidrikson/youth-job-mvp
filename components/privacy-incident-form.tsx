"use client";

import { useRef, useState, type FormEvent, type ReactNode } from "react";
import { caseText, localCasePastTime, type CaseActionResult, type IncidentCaseInput } from "@/lib/privacy-cases";
import styles from "@/app/account/privacy-requests/page.module.css";

export function PrivacyIncidentForm({ disabled, credentials, send }: {
  disabled: boolean;
  credentials: ReactNode;
  send: (form: HTMLFormElement, input: IncidentCaseInput) => Promise<CaseActionResult>;
}) {
  const current = useRef<IncidentCaseInput | null>(null);
  const [receiptId, setReceiptId] = useState("");
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (disabled) return;
    const form = event.currentTarget;
    const values = new FormData(form);
    try {
      current.current ??= { action: "incident_create", id: crypto.randomUUID(),
        awareAt: localCasePastTime(String(values.get("awareAt") || "")),
        body: caseText(values.get("body")) };
      setError("");
      setReceiptId(current.current.id);
      const result = await send(form, current.current);
      if (result.ok || result.rejected) {
        current.current = null;
        setReceiptId("");
        if (result.ok) form.reset();
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Registreringen kunde inte bekräftas.");
    }
  }

  return <details>
    <summary>Registrera intern incident</summary>
    <form className={styles.form} onSubmit={submit}>
      <label>När fick ni kännedom? (lokal tid)<input name="awareAt" type="datetime-local" readOnly={!!receiptId} disabled={disabled} required/></label>
      <label>Händelse, berörda uppgifter, risk och vidtagna åtgärder
        <textarea name="body" maxLength={4000} readOnly={!!receiptId} disabled={disabled} required/>
      </label>
      <p>Samordna omgående med Vilgot och Max. Kontakt med berörda och eventuell anmälan görs separat.</p>
      {receiptId && <p>Registrerings-ID: {receiptId}. Använd samma ID vid ett nytt försök.</p>}
      {credentials}
      <button className="secondary-btn" disabled={disabled}>Verifiera och registrera incident</button>
      {error && <p role="alert">{error}</p>}
    </form>
  </details>;
}
