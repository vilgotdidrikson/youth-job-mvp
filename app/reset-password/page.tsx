"use client";

import { BrandLogo } from "@/components/brand-logo";

import { PasswordInput } from "@/components/password-input";

import Link from "next/link";
import { UiIcon } from "@/components/ui-icon";
import { FormEvent, useEffect, useRef, useState } from "react";
import { getSupabaseClient } from "@/lib/supabase";
import { updatePassword } from "@/lib/auth";
import { createLatestRead } from "@/lib/latest-read";

export default function ResetPasswordPage() {
  const [checkingLink, setCheckingLink] = useState(true);
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [needsLogout, setNeedsLogout] = useState(false);
  const active = useRef(true);
  const submitting = useRef(false);
  const recoveryAccount = useRef<string | null>(null);
  const accountEpoch = useRef(0);
  const passwordSaved = useRef(false);

  useEffect(() => {
    active.current = true;
    const supabase = getSupabaseClient();
    const url = new URL(window.location.href);
    const hash = new URLSearchParams(url.hash.replace(/^#/, ""));
    const recoveryLink = url.searchParams.has("code") || url.searchParams.get("type") === "recovery" || hash.get("type") === "recovery";
    const linkError = url.searchParams.get("error_description") || hash.get("error_description");

    const check = createLatestRead<string | null>({
      read: async () => {
        const { data, error: sessionError } = await supabase.auth.getSession();
        if (sessionError) throw sessionError;
        return recoveryLink ? data.session?.user.id ?? null : null;
      },
      update: state => {
        setCheckingLink(state.status === "loading");
        if (state.status === "ready") { recoveryAccount.current = state.value; setReady(Boolean(state.value)); }
        if (state.status === "error") setError(state.message);
      },
      errorMessage: "Kunde inte verifiera återställningslänken. Begär en ny länk.",
    });

    if (linkError) {
      setError("Återställningslänken är ogiltig eller har gått ut. Begär en ny länk.");
      setCheckingLink(false);
    } else void check.load();

    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (!linkError && event === "PASSWORD_RECOVERY" && session && active.current) {
        check.stop();
        accountEpoch.current += 1;
        if (recoveryAccount.current !== session.user.id) {
          setPassword(""); setConfirmPassword(""); setMessage(""); setNeedsLogout(false);
        }
        recoveryAccount.current = session.user.id;
        passwordSaved.current = false;
        setReady(true);
        setCheckingLink(false);
        setError("");
      } else if (active.current && ((event === "SIGNED_OUT" && !passwordSaved.current) ||
        (event === "SIGNED_IN" && session?.user.id !== recoveryAccount.current))) {
        check.stop(); accountEpoch.current += 1; recoveryAccount.current = null; passwordSaved.current = false;
        setReady(false); setCheckingLink(false); setNeedsLogout(false); setMessage("");
        setPassword(""); setConfirmPassword("");
        setError("Återställningssessionen är inte längre aktuell. Begär en ny länk.");
      }
    });
    return () => { active.current = false; check.stop(); listener.subscription.unsubscribe(); };
  }, []);

  const finishLogout = async (epoch = accountEpoch.current) => {
    const { error: logoutError } = await getSupabaseClient().auth.signOut();
    if (!active.current || epoch !== accountEpoch.current) return;
    setNeedsLogout(Boolean(logoutError));
    setError(logoutError ? "Lösenordet är ändrat, men utloggningen kunde inte bekräftas. Försök logga ut igen." : "");
  };

  const retryLogout = async () => {
    if (submitting.current || !active.current || !recoveryAccount.current || !passwordSaved.current) return;
    const epoch = accountEpoch.current;
    submitting.current = true; setLoading(true);
    try { await finishLogout(epoch); }
    catch { if (active.current && epoch === accountEpoch.current) setError("Utloggningen kunde inte bekräftas. Försök igen."); }
    finally { submitting.current = false; if (active.current) setLoading(false); }
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting.current || !active.current || !ready || !recoveryAccount.current) return;
    const epoch = accountEpoch.current;
    setError(""); setMessage("");
    if (password.length < 8) { setError("Lösenordet måste innehålla minst 8 tecken."); return; }
    if (password !== confirmPassword) { setError("Lösenorden matchar inte."); return; }
    submitting.current = true; setLoading(true);
    let saved = false;
    try {
      await updatePassword(password);
      saved = true;
      if (!active.current || epoch !== accountEpoch.current) return;
      passwordSaved.current = true;
      setMessage("Lösenordet är uppdaterat.");
      setReady(false);
      setPassword(""); setConfirmPassword("");
      setNeedsLogout(true);
      await finishLogout(epoch);
    } catch (err) {
      if (active.current && epoch === accountEpoch.current) setError(saved ? "Lösenordet är ändrat, men utloggningen kunde inte bekräftas. Försök logga ut igen." : err instanceof Error ? err.message : "Kunde inte uppdatera lösenordet.");
    } finally { submitting.current = false; if (active.current) setLoading(false); }
  };

  return <main className="auth-page"><Link href="/" className="auth-brand" aria-label="MatchnWork startsida"><BrandLogo/></Link><section className="auth-layout auth-layout-form-only auth-layout-login"><div className="auth-form-stack">
    <Link href="/login" className="auth-back auth-back-above"><span aria-hidden="true"><UiIcon name="chevron-left" width="18" height="18" /></span><span>Till inloggning</span></Link>
    <form className="auth-card auth-card-login" onSubmit={submit}>
      <div className="auth-card-heading"><h1>Välj nytt lösenord</h1><p>{checkingLink ? "Verifierar återställningslänken..." : ready ? "Ange ett nytt lösenord för ditt konto." : message ? "Ditt lösenord har uppdaterats." : "Öppna sidan via länken i återställningsmejlet."}</p></div>
      {ready && <div className="auth-fields">
        <label>Nytt lösenord<PasswordInput className="auth-input" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" required minLength={8} disabled={loading} /></label>
        <label>Bekräfta lösenord<PasswordInput className="auth-input" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} autoComplete="new-password" required minLength={8} disabled={loading} /></label>
      </div>}
      {error && <p role="alert" className="auth-message auth-error">{error}</p>}
      {message && <p role="status" className="auth-message auth-success">{message}</p>}
      {ready && !message && <button type="submit" className="auth-submit" disabled={loading}>{loading ? "Sparar..." : "Spara nytt lösenord"}<span aria-hidden="true"><UiIcon name="arrow" width="16" height="16" /></span></button>}
      {needsLogout && <button type="button" className="auth-submit" disabled={loading} onClick={() => void retryLogout()}>{loading ? "Loggar ut…" : "Försök logga ut"}</button>}
      {!checkingLink && !ready && !message && <Link href="/forgot-password" className="auth-submit" style={{ textDecoration: "none", textAlign: "center" }}>Begär en ny länk<span aria-hidden="true"><UiIcon name="arrow" width="16" height="16" /></span></Link>}
      {message && !needsLogout && <Link href="/login" className="auth-submit" style={{ textDecoration: "none", textAlign: "center" }}>Logga in<span aria-hidden="true"><UiIcon name="arrow" width="16" height="16" /></span></Link>}
    </form>
  </div></section></main>;
}
