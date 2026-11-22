"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getSupabaseClient } from "@/lib/supabase";
import styles from "./application-ai-preference.module.css";

export function ApplicationAiPreference({ compact = false }: { compact?: boolean }) {
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      try {
        const { data, error } = await getSupabaseClient().rpc("my_application_ai_preference").abortSignal(controller.signal);
        if (error || typeof data !== "boolean") throw new Error();
        if (!controller.signal.aborted) setEnabled(data);
      } catch {
        if (!controller.signal.aborted) setMessage("AI-inställningen kunde inte hämtas. Du kan fortfarande söka jobb.");
      }
    }
    void load();
    return () => controller.abort();
  }, []);

  async function save(next: boolean) {
    setSaving(true);
    setMessage("");
    try {
      const { data, error } = await getSupabaseClient().rpc("my_application_ai_preference", { p_enabled: next });
      if (error || data !== next) throw new Error();
      setEnabled(data);
    } catch {
      setMessage("Ändringen kunde inte bekräftas. Försök igen.");
    } finally {
      setSaving(false);
    }
  }

  return <div className={styles.preference}>
    {enabled !== null && <label className={styles.choice}>
      <input type="checkbox" checked={enabled} disabled={saving} onChange={event => void save(event.target.checked)} />
      <span>Jag vill att AI analyserar mina kommande ansökningar, med uppgifter från mitt CV och min jobbprofil, och ger arbetsgivaren ett bedömningsunderlag.</span>
    </label>}
    <p>Du kan söka även om rutan är tom. {compact && <>Du kan ändra valet i <Link href="/profile?tab=settings">Inställningar</Link>. </>} <Link href="/privacy#followups">Så används uppgifterna</Link>.</p>
    {saving && compact && <p role="status">Sparar AI-valet. Det gäller när det har sparats.</p>}
    {saving && !compact && <p role="status">Sparar AI-valet.</p>}
    {message && <p role="status">{message}</p>}
  </div>;
}
