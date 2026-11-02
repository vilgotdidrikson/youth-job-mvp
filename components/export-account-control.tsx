"use client";
import { useEffect, useId, useRef, useState } from "react";
import { AccountExportError, requestAccountExport } from "@/lib/account-export";
import { ModalDialog } from "./modal-dialog";
import styles from "./delete-account-control.module.css";
import { getSupabaseClient } from "@/lib/supabase";

function Control({ userId }: { userId: string }) {
  const pending = useRef<AbortController | null>(null);
  const link = useRef<string | null>(null), timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [open, setOpen] = useState(false), [busy, setBusy] = useState(false), [password, setPassword] = useState(""), [message, setMessage] = useState("");
  const title = useId(), mounted = useRef(true);
  const close = () => { pending.current?.abort(); setPassword(""); setOpen(false); };
  const release = () => { if (link.current) URL.revokeObjectURL(link.current); link.current = null; if (timer.current) clearTimeout(timer.current); timer.current = null; };
  useEffect(() => {
    mounted.current = true;
    const { data } = getSupabaseClient().auth.onAuthStateChange((_event, session) => { if (mounted.current && session?.user.id !== userId) { release(); pending.current?.abort(); setOpen(false); setPassword(""); } });
    return () => { mounted.current = false; pending.current?.abort(); data.subscription.unsubscribe(); release(); };
  }, [userId]);
  return <><button type="button" className="secondary-btn" onClick={() => { setMessage(""); setOpen(true); }}>Hämta exportprov</button>
    {open && <ModalDialog labelledBy={title} onClose={close} className={styles.dialog}>
      <form onSubmit={async event => {
        event.preventDefault(); if (pending.current) return;
        const controller = new AbortController(); pending.current = controller; setBusy(true); setMessage("");
        const entered = password; setPassword("");
        const deadline = setTimeout(() => controller.abort(), 125000);
        try {
          const file = await requestAccountExport(userId, entered, controller.signal);
          controller.signal.throwIfAborted(); release();
          link.current = URL.createObjectURL(file.blob);
          const anchor = document.createElement("a"); anchor.href = link.current; anchor.download = file.filename; document.body.append(anchor); anchor.click(); anchor.remove();
          timer.current = setTimeout(release, 30000);
          setMessage("Nedladdningen har startats. Paketet är ofullständigt.");
        } catch (error) { if (!controller.signal.aborted) setMessage(error instanceof AccountExportError ? error.message : "Exportprovet kunde inte hämtas. Försök igen senare."); }
        finally { clearTimeout(deadline); if (pending.current === controller) { pending.current = null; if (mounted.current) setBusy(false); } }
      }}>
        <h2 id={title}>Hämta ett ofullständigt exportprov</h2>
        <p>Detta dev-prov innehåller bara utvalda strukturerade uppgifter. Det är inte ett fullständigt registerutdrag.</p>
        <fieldset className={styles.fields} disabled={busy}><label>Lösenord<input type="password" value={password} onChange={event => setPassword(event.target.value)} autoComplete="current-password" required maxLength={1024} disabled={busy}/></label></fieldset>
        <p role="status" aria-live="polite">{busy ? "Skapar och kontrollerar paketet…" : message}</p>
        <div className={styles.actions}><button className="cta-btn" disabled={busy} type="submit">{busy ? "Arbetar…" : "Skapa och hämta"}</button>
        <button className="secondary-btn" type="button" onClick={close}>Stäng</button></div>
      </form>
    </ModalDialog>}</>;
}

export function ExportAccountControl({ userId }: { userId: string }) {
  if (process.env.NEXT_PUBLIC_EXPORT_PREVIEW_UI !== "true" || process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "") !== "https://vwcfjvwfeatvuisojwrh.supabase.co") return null;
  return <Control key={userId} userId={userId}/>;
}
