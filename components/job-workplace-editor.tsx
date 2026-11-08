"use client";
import { useEffect, useRef, useState } from "react";
import { ModalDialog } from "@/components/modal-dialog";
import { JobWorkplaceFields } from "@/components/job-workplace-fields";
import { getJobWorkplaces, validateJobWorkplaces } from "@/lib/job-workplaces";
import { updateJob } from "@/lib/jobs";
import type { JobPost } from "@/lib/types";
export function JobWorkplaceEditor({ job, onClose, onSaved }: { job: JobPost; onClose: () => void; onSaved: (job: JobPost) => void }) {
  const [places, setPlaces] = useState(() => getJobWorkplaces(job));
  const [busy, setBusy] = useState(false), [error, setError] = useState("");
  const lock = useRef(false);
  const active = useRef(false);
  useEffect(() => { active.current = true; return () => { active.current = false; }; }, []);
  const close = () => { if (active.current && !lock.current) onClose(); };
  const save = async () => {
    if (!active.current || lock.current) return;
    lock.current = true; setError(""); setBusy(true);
    try {
      validateJobWorkplaces(places);
      const saved = await updateJob(job.id, { workplaces: places }, { expectedWorkplaces: job.workplaces ?? [] });
      if (active.current) onSaved(saved);
    } catch (reason) {
      if (active.current) setError(reason instanceof Error ? reason.message : "Kunde inte spara arbetsplatserna.");
    } finally { lock.current = false; if (active.current) setBusy(false); }
  };
  return <ModalDialog label="Redigera arbetsplatser" onClose={close} busy={busy} className="workplace-editor">
    <form onSubmit={event => { event.preventDefault(); void save(); }}>
      <h2>Arbetsplatser för {job.title}</h2>
      <p>Ansökningar och chattar finns kvar. Tidigare val av arbetsplats behåller adressen som gällde vid valet.</p>
      <JobWorkplaceFields value={places} onChange={setPlaces} disabled={busy}/>
      {error && <p role="alert">{error}</p>}
      <div className="workplace-editor-actions"><button className="cta-btn" disabled={busy}>{busy ? "Sparar…" : "Spara arbetsplatser"}</button><button className="secondary-btn" type="button" disabled={busy} onClick={close}>Avbryt</button></div>
    </form>
  </ModalDialog>;
}
