"use client";
import { useRef, useState } from "react";
import { ModalDialog } from "@/components/modal-dialog";

export function JobDraftConflictNotice({ onReload }: { onReload: () => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const reload = async () => {
    if (lock.current) return;
    lock.current = true; setBusy(true);
    try { await onReload(); setOpen(false); }
    finally { lock.current = false; setBusy(false); }
  };
  return <>
    <div className="job-copy-image-actions"><button type="button" className="secondary-btn" onClick={() => setOpen(true)}>Öppna sparat utkast</button></div>
    {open && <ModalDialog label="Öppna sparat utkast" busy={busy} onClose={() => setOpen(false)} className="job-copy-dialog">
      <h2>Öppna sparat utkast?</h2>
      <p>Osparade ändringar i den här fliken ersätts med det senast sparade utkastet. Kopiera först text som du vill behålla.</p>
      <div><button type="button" className="cta-btn" disabled={busy} onClick={() => void reload()}>{busy ? "Öppnar…" : "Öppna sparat utkast"}</button><button type="button" className="secondary-btn" disabled={busy} onClick={() => setOpen(false)}>Avbryt</button></div>
    </ModalDialog>}
  </>;
}
