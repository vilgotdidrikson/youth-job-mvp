"use client";
import Link from "next/link";
import { useState } from "react";
import { ModalDialog } from "@/components/modal-dialog";
import { recruitmentAction } from "@/lib/recruitment";
import styles from "./recruitment.module.css";

export function CloseRecruitmentDialog({ jobId, title, onClose, onSaved }: { jobId: string; title: string; onClose: () => void; onSaved: () => Promise<void> }) {
  const [outcome, setOutcome] = useState(""), [busy, setBusy] = useState(false), [error, setError] = useState("");
  const save = async () => {
    if (!outcome || busy) return; setBusy(true); setError("");
    try { await recruitmentAction("close_job", null, { job_id: jobId, outcome }); await onSaved(); onClose(); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Kunde inte stänga annonsen."); }
    finally { setBusy(false); }
  };
  return <ModalDialog label="Avsluta rekrytering" onClose={onClose} busy={busy} className={styles.dialog}><h2>Stäng annonsen: {title}</h2><p>Hur gick rekryteringen? Annonsen slutar visas, men ansökningar och chattar finns kvar.</p><label>Rekryteringsresultat<select value={outcome} onChange={event => setOutcome(event.target.value)}><option value="">Välj ett alternativ</option><option value="hired">Anställd genom MatchnWork</option><option value="no_hire">Ingen anställd genom MatchnWork</option><option value="continuing">Rekryteringen fortsätter</option></select></label>{outcome === "hired" && <p>Registrera den anställda kandidaten i <Link href={`/chats?job=${jobId}`}>chatten</Link> innan du stänger annonsen.</p>}{outcome === "continuing" && <p>Annonsen stängs för nya ansökningar. Ni kan fortsätta med befintliga kandidater.</p>}{error && <p role="alert" className={styles.error}>{error}</p>}<div className={styles.actions}><button type="button" className="cta-btn" disabled={!outcome || busy} onClick={() => void save()}>{busy ? "Sparar…" : "Spara och stäng annons"}</button><button type="button" className="secondary-btn" disabled={busy} onClick={onClose}>Avbryt</button></div></ModalDialog>;
}
