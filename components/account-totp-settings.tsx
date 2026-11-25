"use client";

import Image from "next/image";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { PasswordInput } from "./password-input";
import { AccountSettingsError, type AccountSessionCleanup } from "@/lib/account-settings";
import { createTotpInstallation, readAccountTotp, type TotpInstallation } from "@/lib/account-mfa";
import { createLatestRead, type ReadState } from "@/lib/latest-read";
import styles from "./account-security-settings.module.css";

export function AccountTotpSettings({ userId }: { userId: string }) { return <TotpWorkspace key={userId} userId={userId}/>; }
function TotpWorkspace({ userId }: { userId: string }) {
  const [status, setStatus] = useState<ReadState<boolean>>({ status: "loading" });
  const [installation, setInstallation] = useState<TotpInstallation | null>(null);
  const [busy, setBusy] = useState(false), [error, setError] = useState(""), [note, setNote] = useState("");
  const [needsCleanup, setNeedsCleanup] = useState(false);
  const active = useRef(false), lock = useRef(false), generation = useRef(0);
  const control = useRef<ReturnType<typeof createTotpInstallation> | null>(null);
  const cleanup = useRef<AccountSessionCleanup | null>(null);
  const reader = useRef<ReturnType<typeof createLatestRead<boolean>> | null>(null);
  useEffect(() => {
    active.current = true; control.current = createTotpInstallation(userId);
    const current = createLatestRead<boolean>({ read: (_, signal) => readAccountTotp(userId, signal), update: setStatus, errorMessage: "Kunde inte läsa tvåfaktorstatus. Försök igen." });
    reader.current = current; void current.load();
    return () => { active.current = false; current.stop(); reader.current = null; control.current?.stop(); control.current = null; void cleanup.current?.(); };
  }, [userId]);
  const run = async (operation: (current: NonNullable<typeof control.current>, isCurrent: () => boolean) => Promise<void>) => {
    if (!active.current || lock.current || !control.current) return;
    lock.current = true; setBusy(true); setError(""); setNote("");
    const current = control.current, revision = ++generation.current;
    let timer: ReturnType<typeof setTimeout> | undefined, timedOut = false;
    const isCurrent = () => active.current && control.current === current && generation.current === revision && !timedOut;
    try {
      await Promise.race([operation(current, isCurrent), new Promise<never>((_, reject) => {
        timer = setTimeout(() => { timedOut = true; current.stop(); if (active.current) { setInstallation(null); cleanup.current = () => current.cancel(); setNeedsCleanup(true); } reject(new Error("Försöket kunde inte bekräftas. Kontrollera tvåfaktorstatus innan du börjar om.")); }, 35_000);
      })]);
    } catch (reason) {
      if (active.current && control.current === current && generation.current === revision) {
        if (reason instanceof AccountSettingsError && reason.cleanup) { cleanup.current = reason.cleanup; setNeedsCleanup(true); }
        setError(reason instanceof Error ? reason.message : "Tvåfaktorförsöket kunde inte bekräftas.");
      }
    } finally {
      clearTimeout(timer); lock.current = false;
      if (active.current && generation.current === revision) setBusy(false);
    }
  };
  const begin = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); if (!active.current || lock.current || cleanup.current || status.status !== "ready") return;
    const form = event.currentTarget, values = new FormData(form);
    const password = String(values.get("currentPassword") ?? ""), code = String(values.get("totpCode") ?? "").trim();
    form.reset();
    void run(async (current, isCurrent) => {
      const value = await current.begin(password, code);
      if (isCurrent()) setInstallation(value);
    });
  };
  const confirm = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); if (!active.current || lock.current || cleanup.current || !installation) return;
    const form = event.currentTarget, code = String(new FormData(form).get("code") ?? "").trim(); form.reset();
    void run(async (current, isCurrent) => {
      const result = await current.confirm(code, installation.factorId);
      if (!isCurrent()) { void result.cleanup?.(); return; }
      setInstallation(null); cleanup.current = result.cleanup; setNeedsCleanup(!!result.cleanup);
      setNote(result.serverVerified ? "Autentiseringsappen är verifierad." : "Autentiseringsappen är verifierad. Säkerhetskontrollen kunde inte bekräftas. Kontrollera tvåfaktorstatus innan du fortsätter.");
      void reader.current?.load();
    });
  };
  const cancel = () => void run(async (current, isCurrent) => {
    const closed = cleanup.current ? await cleanup.current() : await current.cancel();
    if (!closed) throw new Error("Installationen eller verifieringssessionen kunde inte avslutas. Försök igen.");
    if (!isCurrent()) return;
    setInstallation(null); cleanup.current = null; setNeedsCleanup(false);
    current.stop(); control.current = createTotpInstallation(userId);
    setNote("Installationen är stängd. Kontrollera status om ett tidigare kodförsök hade okänt resultat.");
    void reader.current?.load();
  });
  useEffect(() => {
    if (!installation) return;
    const timer = setTimeout(() => {
      const current = control.current; if (!active.current || !current) return;
      setInstallation(null); current.stop(); cleanup.current = () => current.cancel(); setNeedsCleanup(true);
      setError("Installationen har stängts. Kontrollera status och avsluta verifieringssessionen innan du börjar om.");
    }, 10 * 60_000);
    return () => clearTimeout(timer);
  }, [installation]);
  return <section className={styles.form} aria-label="Autentiseringsapp">
    <h3>Autentiseringsapp</h3>
    {status.status === "loading" ? <p role="status">Kontrollerar tvåfaktorstatus…</p> : status.status === "error" ? <p role="alert">{status.message}</p> : <p>{status.value ? "Kontot har en verifierad autentiseringsapp." : "Kontot har ingen verifierad autentiseringsapp."}</p>}
    <button type="button" className="secondary-btn" disabled={busy || status.status === "loading"} onClick={() => void reader.current?.load()}>Kontrollera tvåfaktorstatus</button>
    {!installation && !needsCleanup && <form className={styles.form} onSubmit={begin}>
      <label>Nuvarande lösenord<PasswordInput name="currentPassword" autoComplete="current-password" maxLength={1024} required disabled={busy || status.status !== "ready"}/></label>
      {status.status === "ready" && status.value && <label>Kod från befintlig autentiseringsapp<input name="totpCode" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} required disabled={busy}/></label>}
      <button type="submit" className="secondary-btn" disabled={busy || status.status !== "ready"}>{busy ? "Förbereder…" : "Lägg till autentiseringsapp"}</button>
    </form>}
    {installation && <div>
      <p>Skanna koden i din autentiseringsapp. Bekräfta sedan med appens sexsiffriga kod.</p>
      <Image src={installation.qrCode} width={220} height={220} unoptimized alt="Personlig QR-kod för installation av autentiseringsapp"/>
      <details><summary>Visa manuell installationsnyckel</summary><code className={styles.secret}>{installation.secret}</code></details>
      <form className={styles.form} onSubmit={confirm}><label>Sexsiffrig kod<input name="code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" minLength={6} maxLength={6} required disabled={busy}/></label><button type="submit" className="secondary-btn" disabled={busy}>Bekräfta autentiseringsapp</button></form>
    </div>}
    {(installation || needsCleanup) && <button type="button" className="secondary-btn" disabled={busy} onClick={cancel}>{needsCleanup ? "Försök avsluta verifieringssessionen" : "Avsluta installationen"}</button>}
    {error && <p role="alert">{error}</p>}{note && <p role="status">{note}</p>}
  </section>;
}
