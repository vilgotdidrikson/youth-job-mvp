"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { getSupabaseClient } from "@/lib/supabase";
import styles from "./company-agreement.module.css";

type Terms = { version: string; terms: string; acceptedAt: string | null };

export function YouthTerms() {
  const [terms, setTerms] = useState<Terms | null>(null);
  const [approved, setApproved] = useState(false);
  const [retry, setRetry] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const busy = useRef(false);

  useEffect(() => {
    const request = new AbortController();
    getSupabaseClient().rpc("get_my_youth_terms").abortSignal(request.signal).then(({ data, error }) => {
      if (request.signal.aborted || error?.code === "PGRST202") return;
      if (error) setError("Villkoren kunde inte hämtas. Försök igen.");
      else setTerms(data as Terms | null);
    }, () => {
      if (!request.signal.aborted) setError("Villkoren kunde inte hämtas. Försök igen.");
    });
    return () => request.abort();
  }, [retry]);

  function reload() {
    setTerms(null);
    setApproved(false);
    setError("");
    setRetry(count => count + 1);
  }

  async function accept(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy.current || !terms || !approved) return;
    busy.current = true;
    setSaving(true);
    setError("");
    try {
      const { data, error } = await getSupabaseClient().rpc("accept_my_youth_terms", {
        p_version: terms.version, p_accepted: approved,
      });
      if (error?.code === "40001") {
        reload();
        setError("Nya villkor gäller. Läs dem innan du godkänner.");
        return;
      }
      if (error || !data?.acceptedAt || data.version !== terms.version) throw new Error();
      setTerms({ ...terms, acceptedAt: data.acceptedAt });
    } catch {
      setError("Godkännandet kunde inte bekräftas. Försök igen.");
    } finally {
      busy.current = false;
      setSaving(false);
    }
  }

  if ((!terms || terms.acceptedAt) && !error) return null;
  return <section className={`card ${styles.panel} ${styles.youthNotice}`} aria-label="Ungdomsvillkor">
    <h2>Villkor för ungdomskonton</h2>
    {error && <p role="alert">{error} <button type="button" className="secondary-btn" onClick={reload}>Läs om villkoren</button></p>}
    {terms && !terms.acceptedAt && <>
      <p>Godkänn villkoren för att kunna skicka ansökningar. <Link href="/privacy">Så används dina uppgifter</Link>.</p>
      <details>
        <summary>Läs villkoren · {terms.version}</summary>
        <div className={styles.text}>{terms.terms}</div>
      </details>
      <form className={styles.form} onSubmit={accept}>
        <label><input type="checkbox" checked={approved} disabled={saving} onChange={event => setApproved(event.target.checked)} /> Jag godkänner ungdomsvillkoren.</label>
        <button className="cta-btn" disabled={!approved || saving}>{saving ? "Sparar…" : "Godkänn villkoren"}</button>
      </form>
    </>}
  </section>;
}
