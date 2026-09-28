"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { getSupabaseClient } from "@/lib/supabase";
import { updatePassword } from "@/lib/auth";

export default function ResetPasswordPage() {
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const supabase = getSupabaseClient();
    void supabase.auth.getSession().then(({ data }) => setReady(Boolean(data.session)));
    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" || session) setReady(true);
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
      setMessage("Lösenordet är uppdaterat. Du kan nu logga in med ditt nya lösenord.");
      setPassword(""); setConfirmPassword("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Kunde inte uppdatera lösenordet.");
    } finally { setLoading(false); }
  };

  return <main className="auth-page"><section className="auth-layout auth-layout-form-only auth-layout-login"><div className="auth-form-stack">
    <Link href="/login" className="auth-back auth-back-above"><span aria-hidden="true">←</span><span>Till inloggning</span></Link>
    <form className="auth-card auth-card-login" onSubmit={submit}>
      <div className="auth-card-heading"><h2>Välj nytt lösenord</h2><p>{ready ? "Ange ett nytt lösenord för ditt konto." : "Öppna sidan via länken i återställningsmejlet."}</p></div>
      {ready && <div className="auth-fields">
        <label>Nytt lösenord<input className="auth-input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" required minLength={8} /></label>
        <label>Bekräfta lösenord<input className="auth-input" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} autoComplete="new-password" required minLength={8} /></label>
      </div>}
      {error && <p className="auth-message auth-error">{error}</p>}
      {message && <p className="auth-message auth-success">{message}</p>}
      {ready && !message && <button type="submit" className="auth-submit" disabled={loading}>{loading ? "Sparar..." : "Spara nytt lösenord"}<span aria-hidden="true">↗</span></button>}
    </form>
  </div></section></main>;
}
