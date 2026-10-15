"use client";
import { useState } from "react";
import { ModalDialog } from "@/components/modal-dialog";
import { JobWorkplaceFields } from "@/components/job-workplace-fields";
import { getJobWorkplaces, validateJobWorkplaces } from "@/lib/job-workplaces";
import { updateJob } from "@/lib/jobs";
import type { JobPost } from "@/lib/types";
export function JobWorkplaceEditor({ job, onClose, onSaved }: { job: JobPost; onClose: () => void; onSaved: (job: JobPost) => void }) {
  const [places, setPlaces] = useState(() => getJobWorkplaces(job));
  const [busy, setBusy] = useState(false), [error, setError] = useState("");
  return <ModalDialog label="Redigera arbetsplatser" onClose={() => { if (!busy) onClose(); }} className="workplace-editor"><form onSubmit={event => { event.preventDefault(); if (busy) return; setError(""); setBusy(true); void (async () => { try { validateJobWorkplaces(places); onSaved(await updateJob(job.id, { workplaces: places })); } catch (reason) { setError(reason instanceof Error ? reason.message : "Kunde inte spara arbetsplatserna."); } finally { setBusy(false); } })(); }}><h2>Arbetsplatser för {job.title}</h2><p>Ansökningar och chattar finns kvar. Tidigare val av arbetsplats behåller adressen som gällde vid valet.</p><JobWorkplaceFields value={places} onChange={setPlaces} disabled={busy}/>{error && <p role="alert">{error}</p>}<div className="workplace-editor-actions"><button className="cta-btn" disabled={busy}>{busy ? "Sparar…" : "Spara arbetsplatser"}</button><button className="secondary-btn" type="button" disabled={busy} onClick={onClose}>Avbryt</button></div></form></ModalDialog>;
}
