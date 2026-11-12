"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { AccountTotpSettings } from "./account-totp-settings";
import { IndicatorPreferencesSettings } from "./indicator-preferences-settings";
import { PasswordInput } from "./password-input";
import { AccountSettingsError, changeAccountPassword, readAccountEmail, requestAccountEmailChange, validAccountEmail, type AccountSessionCleanup } from "@/lib/account-settings";
import { createLatestRead, type ReadState } from "@/lib/latest-read";
import styles from "./account-security-settings.module.css";

export function AccountSecuritySettings(props: { userId: string; email?: string; pendingEmail?: string }) {
  return <AccountSecurityWorkspace key={props.userId} {...props}/>;
}
function clearPasswords(form: HTMLFormElement | null) {
  for (const name of ["currentPassword", "newPassword", "confirmPassword", "totpCode"]) {
    const input = form?.elements.namedItem(name); if (input && "value" in input) input.value = "";
  }
}
function AccountSecurityWorkspace({ userId, email, pendingEmail }: { userId: string; email?: string; pendingEmail?: string }) {
  const [emailState, setEmailState] = useState({ email: email ?? "", pendingEmail: pendingEmail ?? "" });
  const [newEmail, setNewEmail] = useState("");
  const [busy, setBusy] = useState<"email" | "password" | "cleanup" | null>(null);
  const [error, setError] = useState(""), [message, setMessage] = useState("");
  const [cooldown, setCooldown] = useState(false), [needsCleanup, setNeedsCleanup] = useState(false);
  const [readState, setReadState] = useState<ReadState<{ email: string; pendingEmail: string }> | null>(null);
  const active = useRef(false), lock = useRef(false), reading = useRef(false), controller = useRef<AbortController | null>(null);
  const cleanup = useRef<AccountSessionCleanup | null>(null);
  const reader = useRef<ReturnType<typeof createLatestRead<{ email: string; pendingEmail: string }>> | null>(null);
  const emailForm = useRef<HTMLFormElement>(null), passwordForm = useRef<HTMLFormElement>(null);
  useEffect(() => {
    active.current = true;
    const emailFields = emailForm.current, passwordFields = passwordForm.current;
    const current = createLatestRead<{ email: string; pendingEmail: string }>({
      read: (_, signal) => readAccountEmail(userId, signal), errorMessage: "Kunde inte läsa e-poststatus. Försök igen.",
      update: state => { reading.current = state.status === "loading"; setReadState(state); if (state.status === "ready") setEmailState(state.value); },
    });
    reader.current = current;
    return () => {
      active.current = false; controller.current?.abort(); current.stop(); reader.current = null;
      clearPasswords(emailFields); clearPasswords(passwordFields);
      void cleanup.current?.(); cleanup.current = null;
    };
  }, [userId]);
  useEffect(() => {
    if (!cooldown) return;
    const timer = setTimeout(() => setCooldown(false), 60_000); return () => clearTimeout(timer);
  }, [cooldown]);
  const submit = async (event: FormEvent<HTMLFormElement>, kind: "email" | "password") => {
    event.preventDefault();
    if (!active.current || lock.current || reading.current || cleanup.current || (kind === "email" && cooldown)) return;
    const form = event.currentTarget, data = new FormData(form);
    const currentPassword = String(data.get("currentPassword") ?? "");
    const next = kind === "email" ? String(data.get("newEmail") ?? "").trim().toLowerCase() : String(data.get("newPassword") ?? "");
    setError(""); setMessage("");
    if (!currentPassword) { setError("Ange ditt nuvarande lösenord."); return; }
    if (kind === "email" && (!validAccountEmail(next) || next === emailState.email.toLowerCase())) { setError("Ange en giltig ny e-postadress."); return; }
    if (kind === "password" && (next.length < 8 || next.length > 1024)) { setError("Det nya lösenordet måste innehålla mellan 8 och 1024 tecken."); return; }
    if (kind === "password" && next !== String(data.get("confirmPassword") ?? "")) { setError("De nya lösenorden matchar inte."); return; }
    lock.current = true; setBusy(kind); clearPasswords(form);
    const task = new AbortController(); controller.current = task;
    let onAbort: () => void = () => {};
    const cancelled = new Promise<never>((_, reject) => {
      onAbort = () => reject(new Error("Ändringen kunde inte bekräftas. Kontrollera kontots status innan du försöker igen."));
      task.signal.addEventListener("abort", onAbort, { once: true });
    });
    // An expired UI aborts the operation; its isolated cleanup can still finish.
    const timer = setTimeout(() => task.abort(), 30_000);
    try {
      const action = kind === "email" ? requestAccountEmailChange : changeAccountPassword;
      const operation = action(currentPassword, next, { expectedUserId: userId, signal: task.signal, totpCode: String(data.get("totpCode") ?? "").trim() });
      // Keep cleanup for the isolated session even when the view has already left.
      void operation.then(result => { if (!active.current || task.signal.aborted) void result.cleanup?.(); }, reason => { if ((!active.current || task.signal.aborted) && reason instanceof AccountSettingsError) void reason.cleanup?.(); });
      const result = await Promise.race([operation, cancelled]);
      if (!active.current || task.signal.aborted) return;
      cleanup.current = result.cleanup; setNeedsCleanup(!!result.cleanup);
      if (kind === "email") {
        setCooldown(true); setEmailState(current => ({ ...current, pendingEmail: next }));
        setMessage("Byte av e-postadress är begärt. Följ bekräftelselänkarna i mejlen och kontrollera båda inkorgarna. Kontrollera sedan e-poststatus här.");
      } else setMessage("Lösenordet har ändrats.");
    } catch (reason) {
      if (!active.current) return;
      if (reason instanceof AccountSettingsError) { cleanup.current = reason.cleanup; setNeedsCleanup(!!reason.cleanup); }
      if (kind === "email" && (!(reason instanceof AccountSettingsError) || reason.unconfirmed)) setCooldown(true);
      setError(reason instanceof AccountSettingsError || task.signal.aborted ? (reason as Error).message : "Ändringen kunde inte bekräftas. Kontrollera kontots status innan du försöker igen.");
    } finally {
      clearTimeout(timer); task.signal.removeEventListener("abort", onAbort);
      if (controller.current === task) controller.current = null;
      lock.current = false; if (active.current) setBusy(null);
    }
  };
  const retryCleanup = async () => {
    if (!active.current || lock.current || !cleanup.current) return;
    lock.current = true; setBusy("cleanup");
    try { if (await cleanup.current()) { cleanup.current = null; if (active.current) setNeedsCleanup(false); } }
    finally { lock.current = false; if (active.current) setBusy(null); }
  };
  const disabled = !!busy || needsCleanup || readState?.status === "loading";
  return <><section className={`card ${styles.section}`} aria-label="E-post och lösenord">
    <h2>E-post och lösenord</h2>
    <p>Kontot använder: <strong>{emailState.email}</strong></p>
    {emailState.pendingEmail && <p>Begärt byte till: {emailState.pendingEmail}. Den adressen räknas inte som aktiv här förrän kontots status har lästs på nytt.</p>}
    <button type="button" className="secondary-btn" disabled={!!busy || readState?.status === "loading"} onClick={() => { if (active.current && !lock.current) void reader.current?.load(); }}>Kontrollera e-poststatus</button>
    {readState?.status === "loading" && <p role="status">Kontrollerar e-poststatus…</p>}
    {readState?.status === "error" && <p role="alert">{readState.message}</p>}
    {readState?.status === "ready" && <p role="status">E-poststatus är hämtad från kontot.</p>}
    <form ref={emailForm} onSubmit={event => void submit(event, "email")} className={styles.form}>
      <h3>Byt e-postadress</h3>
      <label>Ny e-postadress<input name="newEmail" type="email" maxLength={254} autoComplete="email" required value={newEmail} onChange={event => setNewEmail(event.target.value)} disabled={disabled || cooldown}/></label>
      <label>Nuvarande lösenord<PasswordInput name="currentPassword" autoComplete="current-password" maxLength={1024} required disabled={disabled || cooldown}/></label>
      <label>Tvåfaktorskod, om du har autentiseringsapp<input name="totpCode" inputMode="numeric" autoComplete="one-time-code" maxLength={6} pattern="[0-9]{6}" disabled={disabled || cooldown}/></label>
      <button className="secondary-btn" type="submit" disabled={disabled || cooldown}>{busy === "email" ? "Begär ändring…" : cooldown ? "Vänta en minut före nästa mejlförsök" : "Begär byte av e-post"}</button>
    </form>
    <form ref={passwordForm} onSubmit={event => void submit(event, "password")} className={styles.form}>
      <h3>Byt lösenord</h3>
      <label>Nuvarande lösenord<PasswordInput name="currentPassword" autoComplete="current-password" maxLength={1024} required disabled={disabled}/></label>
      <label>Nytt lösenord<PasswordInput name="newPassword" autoComplete="new-password" minLength={8} maxLength={1024} required disabled={disabled}/></label>
      <label>Bekräfta nytt lösenord<PasswordInput name="confirmPassword" autoComplete="new-password" minLength={8} maxLength={1024} required disabled={disabled}/></label>
      <label>Tvåfaktorskod, om du har autentiseringsapp<input name="totpCode" inputMode="numeric" autoComplete="one-time-code" maxLength={6} pattern="[0-9]{6}" disabled={disabled}/></label>
      <button className="secondary-btn" type="submit" disabled={disabled}>{busy === "password" ? "Ändrar lösenord…" : "Ändra lösenord"}</button>
    </form>
    <AccountTotpSettings userId={userId}/>
    {message && <p role="status">{message}</p>}{error && <p role="alert">{error}</p>}
    {needsCleanup && <div><p role="alert">Den tillfälliga verifieringssessionens utloggning kunde inte bekräftas. Ett nytt ändringsförsök är spärrat tills den är avslutad.</p><button type="button" className="secondary-btn" disabled={!!busy} onClick={() => void retryCleanup()}>Försök avsluta verifieringssessionen</button></div>}
  </section><IndicatorPreferencesSettings userId={userId}/></>;
}
