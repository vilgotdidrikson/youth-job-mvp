"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { readReviewedCaseDelivery } from "@/lib/privacy-case-client";
import styles from "@/app/account/privacy-requests/page.module.css";

export function PrivacyCaseDelivery({ owner, id }: { owner: string; id: string }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const request = useRef<AbortController | null>(null);
  useEffect(() => () => request.current?.abort(), []);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (request.current) return;
    const form = event.currentTarget, data = new FormData(form);
    form.reset();
    const controller = new AbortController();
    request.current = controller;
    setBusy(true);
    setMessage("");
    try {
      const content = await readReviewedCaseDelivery(owner, id, String(data.get("password")), String(data.get("totpCode")), controller.signal);
      if (controller.signal.aborted) return;
      const bytes = Uint8Array.from(atob(content), character => character.charCodeAt(0));
      const url = URL.createObjectURL(new Blob([bytes], { type: "application/octet-stream" }));
      const link = document.createElement("a");
      link.href = url;
      link.download = "matchnwork-granskat-underlag.pdf";
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setMessage("Nedladdningen har startat.");
    } catch (error) {
      if (!controller.signal.aborted) setMessage(error instanceof Error ? error.message : "Inget underlag kunde hämtas.");
    } finally {
      if (request.current === controller && !controller.signal.aborted) {
        request.current = null;
        setBusy(false);
      }
    }
  }
  return <details>
    <summary>Hämta granskat underlag</summary>
    <form className={styles.form} onSubmit={submit}>
      <p>När handläggaren har meddelat att en PDF är klar kan du hämta den här i en timme.</p>
      <label>Lösenord<input type="password" name="password" autoComplete="current-password" maxLength={1024} disabled={busy} required/></label>
      <label>Tvåfaktorskod om du har aktiverat den<input name="totpCode" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} disabled={busy}/></label>
      <button className="secondary-btn" disabled={busy}>Verifiera och hämta PDF</button>
      <p role="status">{busy ? "Kontrollerar behörighet…" : message}</p>
    </form>
  </details>;
}
