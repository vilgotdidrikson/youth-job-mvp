"use client";

import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { adminCaseAttachment } from "@/lib/privacy-case-client";
import { MAX_CASE_PDF_BYTES, type CaseAttachment, type CaseAttachmentInput } from "@/lib/privacy-case-attachments";
import styles from "@/app/account/privacy-requests/page.module.css";

export function PrivacyCaseAttachments({ owner, id, revision, canUpload, canPublish, canRevoke, credentials }: {
  owner: string;
  id: string;
  revision: string;
  canUpload: boolean;
  canPublish: boolean;
  canRevoke: boolean;
  credentials: (disabled: boolean) => ReactNode;
}) {
  const [files, setFiles] = useState<CaseAttachment[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);
  const draft = useRef<{ file: File; id: string } | null>(null);
  const request = useRef<AbortController | null>(null);

  useEffect(() => () => { request.current?.abort(); }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (request.current) return;
    const form = event.currentTarget;
    const action = (event.nativeEvent as SubmitEvent).submitter?.getAttribute("value");
    const fields = new FormData(form);
    const password = String(fields.get("password") || "");
    const code = String(fields.get("totpCode") || "");
    form.querySelectorAll<HTMLInputElement>('[name="password"], [name="totpCode"]').forEach(input => { input.value = ""; });
    const controller = new AbortController();
    request.current = controller;
    setBusy(true);
    setMessage("");
    try {
      const scope = { id, revision };
      let input: CaseAttachmentInput;
      if (action === "upload") {
        const file = fileInput.current?.files?.[0];
        if (!canUpload || !file || file.size < 5 || file.size > MAX_CASE_PDF_BYTES || await file.slice(0, 5).text() !== "%PDF-") {
          setMessage("Välj en PDF på högst 1 MB.");
          return;
        }
        if (draft.current?.file !== file) draft.current = { file, id: crypto.randomUUID() };
        const bytes = new Uint8Array(await file.arrayBuffer());
        const chunks: string[] = [];
        for (let offset = 0; offset < bytes.length; offset += 8192) {
          chunks.push(String.fromCharCode(...bytes.subarray(offset, offset + 8192)));
        }
        input = { ...scope, action, attachmentId: draft.current.id, content: btoa(chunks.join("")) };
      } else if (action?.startsWith("publish:")) {
        if (!canPublish || fields.get("confirmed") !== "on") {
          setMessage("Bekräfta först att rätt mottagare och PDF har granskats.");
          return;
        }
        input = { ...scope, action: "publish", attachmentId: action.slice(8) };
      } else if (action?.startsWith("revoke:") && canRevoke) {
        input = { ...scope, action: "revoke", attachmentId: action.slice(7) };
      } else if (action?.startsWith("download:")) {
        input = { ...scope, action: "download", attachmentId: action.slice(9) };
      } else {
        input = { ...scope, action: "list" };
      }
      const response = await adminCaseAttachment(owner, input, password, code, controller.signal);
      if (controller.signal.aborted) return;
      if ("files" in response) {
        setFiles(response.files ?? []);
        setMessage(response.files?.length ? "Bilagor hämtade." : "Ärendet har inga bilagor.");
      } else if ("content" in response && response.content) {
        const bytes = Uint8Array.from(atob(response.content), char => char.charCodeAt(0));
        const url = URL.createObjectURL(new Blob([bytes], { type: "application/octet-stream" }));
        const link = document.createElement("a");
        link.href = url;
        link.download = "arendebilaga.pdf";
        link.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        setMessage("Bilagan laddas ned.");
      } else if ("uploaded" in response && input.action === "revoke") {
        setMessage("PDF-filen är inte längre tillgänglig för mottagaren.");
      } else if ("uploaded" in response && input.action === "publish") {
        const confirmation = form.querySelector<HTMLInputElement>('[name="confirmed"]');
        if (confirmation) confirmation.checked = false;
        setMessage("Den granskade PDF-filen är tillgänglig för kontot i upp till en timme. Meddela mottagaren via ärendet.");
      } else if ("uploaded" in response) {
        draft.current = null;
        if (fileInput.current) fileInput.current.value = "";
        setMessage("Bilagan finns i ärendet. Läs listan för att se den.");
      }
    } catch (error) {
      if (!controller.signal.aborted) {
        setFiles([]);
        setMessage(error instanceof Error ? error.message : "Bilagan kunde inte behandlas.");
      }
    } finally {
      if (!controller.signal.aborted) {
        request.current = null;
        setBusy(false);
      }
    }
  }

  return <details>
    <summary>Privata bilagor</summary>
    <form className={styles.form} onSubmit={submit}>
      <p>Spara endast underlag som behövs i ärendet. PDF, högst 1 MB per bilaga.</p>
      {credentials(busy)}
      <div className={styles.actions}><button type="submit" value="list" className="secondary-btn" disabled={busy}>Läs bilagelistan</button></div>
      {canPublish && files.length > 0 && <label>
        <input type="checkbox" name="confirmed" disabled={busy}/> Jag har granskat vald PDF och kontrollerat rätt mottagare. Filen är en separat exportkopia som gallras efter leveransen.
      </label>}
      {files.length > 0 && <ul>{files.map((file, index) => <li key={file.id}>
        <button type="submit" value={`download:${file.id}`} className="secondary-btn" disabled={busy}>Hämta PDF {index + 1} ({Math.ceil(file.size / 1024)} kB)</button>
        {canPublish && <button type="submit" value={`publish:${file.id}`} className="secondary-btn" disabled={busy}>Dela granskad PDF {index + 1}</button>}
        {canRevoke && <button type="submit" value={`revoke:${file.id}`} className="secondary-btn" disabled={busy}>Återkalla delning av PDF {index + 1}</button>}
      </li>)}</ul>}
      {canUpload && <><label>Välj PDF<input ref={fileInput} type="file" accept="application/pdf,.pdf" disabled={busy}/></label>
        <div className={styles.actions}><button type="submit" value="upload" className="secondary-btn" disabled={busy}>Spara privat bilaga</button></div></>}
      <p role="status">{busy ? "Kontrollerar behörighet…" : message}</p>
    </form>
  </details>;
}
