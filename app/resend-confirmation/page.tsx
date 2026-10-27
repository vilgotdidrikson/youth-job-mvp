"use client";

import { BrandLogo } from "@/components/brand-logo";

import Link from "next/link";
import { UiIcon } from "@/components/ui-icon";
import { FormEvent, useEffect, useRef, useState } from "react";
import { resendSignupConfirmation } from "@/lib/auth";

export default function ResendConfirmationPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const busy = useRef(false);
  const active = useRef(true);
  const nextAttempt = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [cooldown, setCooldown] = useState(false);
  useEffect(() => { active.current = true; return () => { active.current = false; if (timer.current) clearTimeout(timer.current); }; }, []);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (busy.current || !active.current || Date.now() < nextAttempt.current) return;
    const submittedEmail = String(new FormData(event.currentTarget).get("email") ?? "");
    busy.current = true;
    nextAttempt.current = Date.now() + 60000;
    setCooldown(true);
    timer.current = setTimeout(() => { if (active.current) setCooldown(false); }, 60000);
    setLoading(true); setError(""); setMessage("");
    try {
      await resendSignupConfirmation(submittedEmail);
      if (active.current) setMessage("Om adressen hör till ett konto som väntar på bekräftelse skickas en ny länk. Kontrollera även skräpposten.");
    } catch (err) {
      if (active.current) setError(err instanceof Error ? err.message : "Kunde inte begära en ny bekräftelselänk.");
    } finally { busy.current = false; if (active.current) setLoading(false); }
  };

  return <main className="auth-page"><Link href="/" className="auth-brand" aria-label="MatchnWork startsida"><BrandLogo/></Link><section className="auth-layout auth-layout-form-only auth-layout-login"><div className="auth-form-stack">
    <Link href="/login" className="auth-back auth-back-above"><span aria-hidden="true"><UiIcon name="chevron-left" width="18" height="18" /></span><span>Till inloggning</span></Link>
    <form className="auth-card auth-card-login" onSubmit={submit}>
      <div className="auth-card-heading"><h1>Bekräfta ditt konto</h1><p>Saknas bekräftelsemejlet, eller har länken gått ut? Ange din e-postadress för att begära en ny länk.</p></div>
      <div className="auth-fields"><label>E-postadress<input name="email" className="auth-input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required /></label></div>
      {error && <p role="alert" className="auth-message auth-error">{error}</p>}
      {message && <p role="status" className="auth-message auth-success">{message}</p>}
      <button type="submit" className="auth-submit" disabled={loading || cooldown}>{loading ? "Skickar..." : cooldown ? "Vänta en minut mellan försöken" : "Skicka bekräftelselänk"}<span aria-hidden="true"><UiIcon name="arrow" width="16" height="16" /></span></button>
    </form>
  </div></section></main>;
}
