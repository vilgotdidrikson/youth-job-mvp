"use client";

import { useEffect, useRef, useState } from "react";
import { submitApplicationAction } from "@/lib/application-completions";
import { withdrawalCopy, type WithdrawalResult } from "@/lib/application-withdrawal";

export function WithdrawApplicationButton({ jobId, title, submitted, disabled, onBusyChange, onWithdrawn }: {
  jobId: string; title: string; submitted: boolean; disabled?: boolean;
  onBusyChange?: (busy: boolean) => void;
  onWithdrawn: (result: WithdrawalResult) => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const lock = useRef(false);
  const [open, setOpen] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState("");
  const copy = withdrawalCopy(submitted);
  const close = () => { if (!lock.current) { setOpen(false); setError(""); } };
  useEffect(() => {
    if (open) { if (!dialog.current?.open) dialog.current?.showModal(); }
    else if (dialog.current?.open) { dialog.current.close(); trigger.current?.focus(); }
  }, [open]);
  const withdraw = async () => {
    if (lock.current) return;
    lock.current = true; setBusy(true); onBusyChange?.(true); setError("");
    try {
      const result = await submitApplicationAction("withdraw", { jobId, expectedSubmitted: submitted }) as WithdrawalResult;
      // The write is confirmed before any local card/counter is changed.
      setOpen(false);
      onWithdrawn(result);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Kunde inte återkalla. Försök igen."); }
    finally { lock.current = false; setBusy(false); onBusyChange?.(false); }
  };
  return <>
    <button ref={trigger} type="button" className="secondary-btn" disabled={disabled || busy} onClick={() => setOpen(true)}>{copy.action}</button>
    <dialog ref={dialog} className="application-withdraw-dialog" aria-labelledby={`withdraw-title-${jobId}`} onCancel={event => { event.preventDefault(); close(); }}>
      <h2 id={`withdraw-title-${jobId}`}>{copy.title}</h2><p><strong>{title}</strong></p><p>{copy.body}</p>
      {error && <p role="alert">{error}</p>}
      <div className="application-completion-actions"><button type="button" className="secondary-btn" autoFocus disabled={busy} onClick={close}>Behåll</button><button type="button" className="cta-btn" disabled={busy} onClick={() => void withdraw()}>{busy ? "Återkallar…" : copy.action}</button></div>
    </dialog>
  </>;
}
