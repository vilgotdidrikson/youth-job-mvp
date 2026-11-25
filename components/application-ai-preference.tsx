"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getSupabaseClient } from "@/lib/supabase";
import styles from "./application-ai-preference.module.css";

export function ApplicationAiPreference({ checked, onChange, disabled }: { checked: boolean; onChange: (value: boolean) => void; disabled?: boolean }) {
  return <div className={styles.preference}>
    <label className={styles.choice}>
      <input type="checkbox" checked={checked} disabled={disabled} onChange={event => onChange(event.target.checked)} />
      <span>Jag godkänner att AI analyserar det CV, de profiluppgifter och de svar jag delar i den här ansökan.</span>
    </label>
    <p>Du kan söka även om rutan är tom. Arbetsgivaren granskar alltid ansökan själv. <Link href="/privacy#followups">Så används uppgifterna</Link>.</p>
  </div>;
}

export function ApplicationAiWithdrawal({ jobId }: { jobId: string }) {
  const [enabled, setEnabled] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    void (async () => {
      try {
        const { data, error } = await getSupabaseClient().rpc("my_application_ai_status", { p_job_id: jobId }).abortSignal(controller.signal);
        if (controller.signal.aborted) return;
        if (error || typeof data !== "boolean") throw new Error();
        setEnabled(data);
      } catch {
        if (!controller.signal.aborted) setMessage("AI-valet kunde inte läsas. Ladda om för att försöka igen.");
      }
    })();
    return () => controller.abort();
  }, [jobId]);

  async function withdraw() {
    setBusy(true);
    setMessage("");
    try {
      const { data, error } = await getSupabaseClient().rpc("withdraw_my_application_ai", { p_job_id: jobId });
      if (error || data !== false) throw new Error();
      setEnabled(false);
      setMessage("AI-valet är återkallat. Din ansökan finns kvar.");
    } catch {
      setMessage("Ändringen kunde inte bekräftas. Försök igen.");
    } finally {
      setBusy(false);
    }
  }

  return <>{enabled && <button type="button" className="secondary-btn" disabled={busy} onClick={() => void withdraw()}>Återkalla AI-valet</button>}{message && <p role="status">{message}</p>}</>;
}
