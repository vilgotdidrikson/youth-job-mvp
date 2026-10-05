"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { getSupabaseClient } from "@/lib/supabase";
import { updatePassword } from "@/lib/auth";

export default function ResetPasswordPage() {
  const [checkingLink, setCheckingLink] = useState(true);
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const supabase = getSupabaseClient();
    const url = new URL(window.location.href);
    const hash = new URLSearchParams(url.hash.replace(/^#/, ""));
    const recoveryLink = url.searchParams.has("code") || url.searchParams.get("type") === "recovery" || hash.get("type") === "recovery";
    const linkError = url.searchParams.get("error_description") || hash.get("error_description");

    if (linkError) {
      setError("Återställningslänken är ogiltig eller har gått ut. Begär en ny länk.");
      setCheckingLink(false);
    } else {
      void supabase.auth.getSession().then(({ data, error: sessionError }) => {
        if (sessionError) setError("Kunde inte verifiera återställningslänken. Begär en ny länk.");
        setReady(recoveryLink && Boolean(data.session));
        setCheckingLink(false);
      });
    }

    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" && session) {
        setReady(true);
        setCheckingLink(false);
        setError("");
      }
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setError(""); setMessage("");
    if (password.length < 8) { setError("Lösenordet måste innehålla minst 8 tecken."); return; }
    if (password !== confirmPassword) { setError("Lösenorden matchar inte."); return; }
    setLoading(true);
    try {
      await updatePassword(password);
      await getSupabaseClient().auth.signOut();
      setMessage("Lösenordet är uppdaterat. Du kan nu logga in med ditt nya lösenord.");
      setReady(false);
      setPassword(""); setConfirmPassword("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Kunde inte uppdatera lösenordet.");
    } finally { setLoading(false); }
  };

  return <main className="auth-page"><section className="auth-layout auth-layout-form-only auth-layout-login"><div className="auth-form-stack">
    <Link href="/login" className="auth-back auth-back-above"><span aria-hidden="true">←</span><span>Till inloggning</span></Link>
    <form className="auth-card auth-card-login" onSubmit={submit}>
      <div className="auth-card-heading"><h1>Välj nytt lösenord</h1><p>{checkingLink ? "Verifierar återställningslänken..." : ready ? "Ange ett nytt lösenord för ditt konto." : message ? "Ditt lösenord har uppdaterats." : "Öppna sidan via länken i återställningsmejlet."}</p></div>
      {ready && <div className="auth-fields">
        <label>Nytt lösenord<input className="auth-input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" required minLength={8} /></label>
        <label>Bekräfta lösenord<input className="auth-input" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} autoComplete="new-password" required minLength={8} /></label>
      </div>}
      {error && <p role="alert" className="auth-message auth-error">{error}</p>}
      {message && <p role="status" className="auth-message auth-success">{message}</p>}
      {ready && !message && <button type="submit" className="auth-submit" disabled={loading}>{loading ? "Sparar..." : "Spara nytt lösenord"}<span aria-hidden="true">↗</span></button>}
      {!checkingLink && !ready && !message && <Link href="/forgot-password" className="auth-submit" style={{ textDecoration: "none", textAlign: "center" }}>Begär en ny länk<span aria-hidden="true">↗</span></Link>}
      {message && <Link href="/login" className="auth-submit" style={{ textDecoration: "none", textAlign: "center" }}>Logga in<span aria-hidden="true">↗</span></Link>}
    </form>
  </div></section></main>;
}
