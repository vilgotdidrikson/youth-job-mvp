"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { requestPasswordReset } from "@/lib/auth";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true); setError(""); setMessage("");
    try {
      await requestPasswordReset(email);
      setMessage("Om ett konto finns för e-postadressen har vi skickat en länk för att återställa lösenordet.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Kunde inte skicka återställningslänken.");
    } finally { setLoading(false); }
  };

  return <main className="auth-page"><section className="auth-layout auth-layout-form-only auth-layout-login"><div className="auth-form-stack">
    <Link href="/login" className="auth-back auth-back-above"><span aria-hidden="true">←</span><span>Till inloggning</span></Link>
    <form className="auth-card auth-card-login" onSubmit={submit}>
      <div className="auth-card-heading"><h1>Återställ lösenord</h1><p>Ange e-postadressen till ditt konto så skickar vi en återställningslänk.</p></div>
      <div className="auth-fields"><label>E-postadress<input className="auth-input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required /></label></div>
      {error && <p role="alert" className="auth-message auth-error">{error}</p>}
      {message && <p role="status" className="auth-message auth-success">{message}</p>}
      <button type="submit" className="auth-submit" disabled={loading}>{loading ? "Skickar..." : "Skicka återställningslänk"}<span aria-hidden="true">↗</span></button>
    </form>
  </div></section></main>;
}
