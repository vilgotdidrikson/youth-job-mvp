"use client";

import { AccountSettingsError, openVerifiedAccount } from "./account-settings";
import { getSupabaseClient } from "@/lib/supabase";

export interface TotpInstallation { factorId: string; qrCode: string; secret: string }
/** Only describes THIS account's factors; no local JWT decoding is an authorization grant. */
export async function readAccountTotp(userId: string, signal: AbortSignal): Promise<boolean> {
  signal.throwIfAborted(); const { data, error } = await getSupabaseClient().auth.getUser(); signal.throwIfAborted();
  if (error || data.user?.id !== userId) throw new Error("Kontots tvåfaktorstatus kunde inte verifieras.");
  return !!data.user.factors?.some(factor => factor.factor_type === "totp" && factor.status === "verified");
}

export function createTotpInstallation(userId: string) {
  let verification: Awaited<ReturnType<typeof openVerifiedAccount>> | null = null;
  let pendingId: string | null = null, stopped = false, busy = false, mayRemovePending = true;
  let controller: AbortController | null = null;
  let cleaning: Promise<boolean> | null = null;
  const doCleanup = async () => {
    if (!verification) return true;
    const session = verification;
    // Cancelling an own unfinished enrollment never removes an existing verified factor.
    if (pendingId && mayRemovePending) {
      session.setSignal(AbortSignal.timeout(10_000));
      try {
        const own = await session.client.auth.getUser();
        if (own.error || own.data.user?.id !== userId) return false;
        const factor = own.data.user.factors?.find(item => item.id === pendingId);
        if (factor?.status === "unverified") {
          const result = await session.client.auth.mfa.unenroll({ factorId: pendingId }); if (result.error) return false;
        }
        pendingId = null;
      } catch { return false; }
    }
    // A lost verification reply can follow successful enrollment. Never remove
    // that factor through the pending-installation cleanup path.
    if (!mayRemovePending) pendingId = null;
    if (!await session.close()) return false;
    if (verification === session) verification = null;
    return true;
  };
  const cleanup = () => {
    if (!cleaning) cleaning = doCleanup().finally(() => { cleaning = null; });
    return cleaning;
  };
  const signal = () => { const next = new AbortController(); controller = next; return AbortSignal.any([next.signal, AbortSignal.timeout(30_000)]); };
  return {
    async begin(password: string, totpCode?: string): Promise<TotpInstallation> {
      if (stopped || busy || verification) throw new Error("Avsluta den pågående installationen först.");
      busy = true; mayRemovePending = true; const active = signal();
      try {
        verification = await openVerifiedAccount(password, { expectedUserId: userId, signal: active, totpCode });
        if (stopped || active.aborted) throw new Error("Installationen avbröts.");
        await verification.assertCurrent(active);
        const { data, error } = await verification.client.auth.mfa.enroll({ factorType: "totp", friendlyName: `MatchnWork ${crypto.randomUUID().slice(0,8)}`, issuer: "MatchnWork" });
        if (data?.id) pendingId = data.id;
        if (stopped || active.aborted || error || data?.type !== "totp" || !data.totp.secret || !data.totp.qr_code.startsWith("data:image/svg+xml;utf-8,")) throw new Error("Installationen kunde inte förberedas.");
        return { factorId: data.id, qrCode: data.totp.qr_code, secret: data.totp.secret };
      } catch (error) {
        if (!await cleanup()) { const failure = new AccountSettingsError("Installationen kunde inte avslutas. Försök avsluta den innan du börjar om."); failure.cleanup = cleanup; throw failure; }
        throw error instanceof AccountSettingsError ? error : new Error("Installationen kunde inte förberedas. Försök igen.");
      } finally { busy = false; controller = null; }
    },
    async confirm(code: string, expectedFactorId?: string): Promise<{ cleanup: (() => Promise<boolean>) | null; serverVerified: boolean }> {
      if (stopped || busy || !verification || !pendingId || (expectedFactorId && expectedFactorId !== pendingId) || !/^\d{6}$/.test(code)) throw new Error("Ange den sexsiffriga koden från autentiseringsappen.");
      busy = true; const active = signal(), session = verification, factorId = pendingId;
      session.setSignal(active);
      try {
        await session.assertCurrent(active);
        mayRemovePending = false;
        const result = await session.client.auth.mfa.challengeAndVerify({ factorId, code });
        active.throwIfAborted();
        if (stopped || result.error || result.data?.user?.id !== userId) throw new Error("Koden kunde inte verifieras. Försök med en aktuell kod.");
        const { data, error } = await session.client.auth.getUser();
        active.throwIfAborted();
        if (error || data.user?.id !== userId || !data.user.factors?.some(f => f.id === factorId && f.factor_type === "totp" && f.status === "verified")) throw new Error("Installationen kunde inte bekräftas. Kontrollera status innan du börjar om.");
        // Verified factors are never treated as an abandoned enrollment.
        pendingId = null;
        let serverVerified = false;
        try {
          const snapshot = await session.client.auth.getSession();
          const token = snapshot.data.session?.access_token;
          if (token) {
            const response = await fetch("/api/account/mfa-session", { headers: { Authorization: `Bearer ${token}`, "X-Account-Id": userId }, cache: "no-store", signal: active });
            serverVerified = response.ok && (await response.json()).verified === true;
          }
        } catch { /* Factor is already verified; do not undo it if the separate session check failed. */ }
        return { cleanup: await cleanup() ? null : cleanup, serverVerified };
      } finally { busy = false; controller = null; if (stopped) await cleanup(); }
    },
    async cancel() { if (busy) return false; return cleanup(); },
    stop() { stopped = true; controller?.abort(); if (!busy) void cleanup(); },
  };
}
