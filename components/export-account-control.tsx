"use client";
import { useEffect, useId, useRef, useState } from "react";
import { AccountExportError, requestAccountExport, recoverAccountExport } from "@/lib/account-export";
import { ModalDialog } from "./modal-dialog";
import styles from "./delete-account-control.module.css";
import { getSupabaseClient } from "@/lib/supabase";

function Control({ userId }: { userId: string }) {
  const pending = useRef<AbortController | null>(null);
  const link = useRef<string | null>(null), timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [open, setOpen] = useState(false), [busy, setBusy] = useState(false), [password, setPassword] = useState(""), [totpCode, setTotpCode] = useState(""), [message, setMessage] = useState("");
  const title = useId(), mounted = useRef(true);
  const close = () => { pending.current?.abort(); setPassword(""); setTotpCode(""); setOpen(false); };
  const release = () => { if (link.current) URL.revokeObjectURL(link.current); link.current = null; if (timer.current) clearTimeout(timer.current); timer.current = null; };
  useEffect(() => {
    mounted.current = true;
    const { data } = getSupabaseClient().auth.onAuthStateChange((_event, session) => { if (mounted.current && session?.user.id !== userId) { release(); pending.current?.abort(); setOpen(false); setPassword(""); setTotpCode(""); } });
    return () => { mounted.current = false; pending.current?.abort(); data.subscription.unsubscribe(); release(); };
  }, [userId]);
  return <><button type="button" className="secondary-btn" onClick={() => { setMessage(""); setOpen(true); }}>Hämta exportprov</button>
    {open && <ModalDialog labelledBy={title} onClose={close} className={styles.dialog}>
      <form onSubmit={async event => {
        event.preventDefault(); if (!mounted.current || pending.current) return;
        const controller = new AbortController(); pending.current = controller; setBusy(true); setMessage("");
        const values = new FormData(event.currentTarget), entered = String(values.get("password") ?? ""), enteredCode = String(values.get("totpCode") ?? "").trim(); setPassword(""); setTotpCode("");
        const deadline = setTimeout(() => controller.abort(new DOMException("Export timed out", "TimeoutError")), 125000);
        try {
          const recovering = (event.nativeEvent as SubmitEvent | undefined)?.submitter?.getAttribute("value") === "recover";
          const file = await (recovering ? recoverAccountExport : requestAccountExport)(userId, entered, controller.signal, enteredCode || undefined);
          controller.signal.throwIfAborted();
          if ("status" in file) {
            const messages = { none: "Inget sparat exportpaket hittades. Du kan skapa ett nytt prov.", expired: "Exportpaketet har gått ut och kan inte hämtas. Du kan skapa ett nytt prov.", failed: "Det tidigare exportpaketet kunde inte färdigställas. Du kan skapa ett nytt prov.", building: "Paketet skapas fortfarande. Kontrollera igen senare; ingen ny beställning har skickats." };
            setMessage(messages[file.status] + (file.status === "building" ? ` Giltigt till ${new Date(file.expiresAt).toLocaleString("sv-SE")}.` : ""));
            return;
          }
          controller.signal.throwIfAborted(); release();
          link.current = URL.createObjectURL(file.blob);
          const anchor = document.createElement("a"); anchor.href = link.current; anchor.download = file.filename; document.body.append(anchor);
          try { anchor.click(); } finally { anchor.remove(); }
          timer.current = setTimeout(release, 30000);
          setMessage(`Nedladdningen har startats. Paketet är klart men ofullständigt. Giltigt till ${new Date(file.expiresAt).toLocaleString("sv-SE")}.`);
        } catch (error) {
          release();
          if (mounted.current && controller.signal.reason?.name === "TimeoutError") setMessage("Tidsgränsen nåddes. Paketet kan ha skapats, men nedladdningen kunde inte bekräftas. Ingen ny beställning skickas automatiskt.");
          else if (mounted.current && !controller.signal.aborted) setMessage(error instanceof AccountExportError ? error.message : "Exportprovet kunde inte hämtas. Försök igen senare.");
        }
        finally { clearTimeout(deadline); if (pending.current === controller) { pending.current = null; if (mounted.current) setBusy(false); } }
      }}>
        <h2 id={title}>Hämta ett ofullständigt exportprov</h2>
        <p>Detta dev-prov innehåller bara utvalda strukturerade uppgifter. Det är inte ett fullständigt registerutdrag.</p>
        <fieldset className={styles.fields} disabled={busy}><label>Lösenord<input type="password" name="password" value={password} onChange={event => setPassword(event.target.value)} autoComplete="current-password" required maxLength={1024} disabled={busy}/></label><label>Tvåfaktorskod, om du har autentiseringsapp<input name="totpCode" value={totpCode} onChange={event => setTotpCode(event.target.value)} inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6}/></label></fieldset>
        <p role="status" aria-live="polite">{busy ? "Kontrollerar paketet…" : message}</p>
        <div className={styles.actions}><button className="cta-btn" disabled={busy} type="submit">{busy ? "Arbetar…" : "Skapa och hämta"}</button>
        <button className="secondary-btn" type="submit" value="recover" disabled={busy}>Hämta befintligt paket</button>
        <button className="secondary-btn" type="button" onClick={close}>Stäng</button></div>
      </form>
    </ModalDialog>}</>;
}

export function ExportAccountControl({ userId }: { userId: string }) {
  if (process.env.NEXT_PUBLIC_EXPORT_PREVIEW_UI !== "true" || process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "") !== "https://vwcfjvwfeatvuisojwrh.supabase.co") return null;
  return <Control key={userId} userId={userId}/>;
}
