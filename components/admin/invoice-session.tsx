"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { getSupabaseClient } from "@/lib/supabase";
import { verifyCurrentAccountTotp } from "@/lib/account-settings";
import styles from "@/components/recruitment.module.css";

type Factor = { id: string; friendly_name?: string };
type SessionState = "loading" | "error" | "ready" | Factor[];

async function readSession(userId: string): Promise<SessionState> {
  const client = getSupabaseClient();
  const { data: session, error: sessionError } = await client.auth.getSession();
  if (sessionError || session.session?.user.id !== userId) return "error";
  const { data, error } = await client.auth.mfa.getAuthenticatorAssuranceLevel(session.session.access_token);
  if (error) return "error";
  if (data.currentLevel === "aal2") return "ready";
  const { data: identity, error: identityError } = await client.auth.getUser();
  if (identityError || identity.user?.id !== userId) return "error";
  return identity.user.factors?.filter(factor => factor.factor_type === "totp" && factor.status === "verified") ?? [];
}

export function InvoiceSession({ children, userId }: { children: ReactNode; userId: string }) {
  const [state, setState] = useState<SessionState>("loading");
  const [attempt, setAttempt] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const verifying = useRef<AbortController | null>(null);

  useEffect(() => {
    let current = true;
    let revision = 0;
    const load = async () => {
      const requested = ++revision;
      const next = await readSession(userId).catch(() => "error" as const);
      if (current && requested === revision) setState(next);
    };
    void load();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const { data: { subscription } } = getSupabaseClient().auth.onAuthStateChange(() => {
      clearTimeout(timer);
      timer = setTimeout(() => void load(), 0);
    });
    return () => {
      current = false;
      clearTimeout(timer);
      subscription.unsubscribe();
      verifying.current?.abort();
    };
  }, [userId, attempt]);

  async function verify(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (verifying.current || !Array.isArray(state) || !state.length) return;
    const form = event.currentTarget;
    const fields = new FormData(form);
    const factorId = String(fields.get("factor") ?? state[0].id);
    const code = String(fields.get("code") ?? "").trim();
    form.reset();
    if (!state.some(factor => factor.id === factorId)) return;
    const active = new AbortController();
    verifying.current = active;
    setBusy(true);
    setError("");
    try {
      await verifyCurrentAccountTotp(userId, factorId, code, active.signal);
      const next = await readSession(userId);
      if (!active.signal.aborted) setState(next);
    } catch (reason) {
      if (!active.signal.aborted) setError(reason instanceof Error ? reason.message : "Koden kunde inte verifieras.");
    } finally {
      if (verifying.current === active) verifying.current = null;
      if (!active.signal.aborted) setBusy(false);
    }
  }

  if (state === "ready") return children;
  return <section className={styles.adminCard} aria-labelledby="invoice-session-heading">
    <h2 id="invoice-session-heading">Fakturor och avstämning</h2>
    {state === "loading" && <p role="status">Kontrollerar tvåstegsverifiering…</p>}
    {state === "error" && <><p role="alert">Sessionen kunde inte kontrolleras.</p><button type="button" className="secondary-btn" onClick={() => { setState("loading"); setAttempt(value => value + 1); }}>Försök igen</button></>}
    {Array.isArray(state) && (state.length ? <>
      <p>Bekräfta den här inloggningen med en kod från din autentiseringsapp.</p>
      <form onSubmit={verify}>
        {state.length > 1 && <label>Autentiseringsapp<select name="factor" disabled={busy}>{state.map((factor, index) => <option key={factor.id} value={factor.id}>{factor.friendly_name || `App ${index + 1}`}</option>)}</select></label>}
        <label>Sexsiffrig kod<input name="code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} pattern="[0-9]{6}" required disabled={busy}/></label>
        <button type="submit" className="cta-btn" disabled={busy}>{busy ? "Verifierar…" : "Verifiera och öppna fakturor"}</button>
      </form>
    </> : <p>Lägg till en autentiseringsapp under <Link href="/admin/profile">Adminprofil</Link>.</p>)}
    {error && <p role="alert" className={styles.error}>{error}</p>}
  </section>;
}
