"use client";

import { useEffect, useRef, useState } from "react";
import { getSupabaseClient } from "@/lib/supabase";
import { getJobWorkplaces, validateJobWorkplaces, workplaceLabel, type JobWorkplace } from "@/lib/job-workplaces";
import { createLatestRead } from "@/lib/latest-read";
import type { JobPost } from "@/lib/types";
import styles from "./workplace-preference.module.css";

type Props = { job: JobPost; youthId: string; readOnly?: boolean };
export function WorkplacePreference(props: Props) {
  // A caller's job-only key must not carry one youth's preference into another account.
  return <ScopedWorkplacePreference key={`${props.job.id}:${props.youthId}:${props.readOnly === true}`} {...props} />;
}

function ScopedWorkplacePreference({ job, youthId, readOnly = false }: Props) {
  const [saved, setSaved] = useState<JobWorkplace | null>(null);
  const [selected, setSelected] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [error, setError] = useState("");
  const [note, setNote] = useState("");
  const [revision, setRevision] = useState(0);
  const active = useRef(false);
  const writeLock = useRef(false);
  const places = getJobWorkplaces(job);

  useEffect(() => {
    active.current = true;
    return () => { active.current = false; };
  }, []);
  useEffect(() => {
    const reader = createLatestRead<JobWorkplace | null>({
      read: async (_, signal) => {
        const { data, error } = await getSupabaseClient().from("application_workplace_preferences")
          .select("workplace_snapshot").eq("job_id", job.id).eq("youth_user_id", youthId).abortSignal(signal).maybeSingle();
        if (error) throw error;
        return data?.workplace_snapshot ? validateJobWorkplaces([data.workplace_snapshot])[0] : null;
      },
      update: state => {
        setLoading(state.status === "loading");
        if (state.status === "ready") {
          setSaved(state.value); setSelected(state.value?.id ?? ""); setLoadError(false); setError("");
        } else if (state.status === "error") { setLoadError(true); setError(state.message); }
      },
      errorMessage: "Kunde inte läsa arbetsplatsvalet. Försök igen.",
    });
    void reader.load();
    return () => reader.stop();
  }, [job.id, youthId, revision]);

  if (places.length <= 1 && !saved && !loading && !error) return null;

  const save = async () => {
    if (!active.current || readOnly || writeLock.current || loading || loadError) return;
    writeLock.current = true;
    setBusy(true); setError(""); setNote("");
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15_000);
    try {
      const db = getSupabaseClient();
      if (!selected) {
        const { error } = await db.from("application_workplace_preferences").delete().eq("job_id", job.id).eq("youth_user_id", youthId).abortSignal(controller.signal);
        if (error) throw error;
        if (!active.current) return;
        setSaved(null);
      } else {
        const { data, error } = await db.from("application_workplace_preferences")
          .upsert({ job_id: job.id, youth_user_id: youthId, workplace_id: selected }, { onConflict: "job_id,youth_user_id" })
          .select("workplace_snapshot").abortSignal(controller.signal).single();
        if (error) throw error;
        if (!active.current) return;
        setSaved(validateJobWorkplaces([data.workplace_snapshot])[0]);
      }
      setNote("Arbetsplatsvalet är sparat.");
    } catch { if (active.current) setError("Sparandet kunde inte bekräftas. Öppna sidan igen och kontrollera ditt arbetsplatsval innan du försöker på nytt."); }
    finally { clearTimeout(timeout); writeLock.current = false; if (active.current) setBusy(false); }
  };

  return <section className={`card ${styles.panel}`}>
    <h3>{readOnly ? "Önskad arbetsplats" : "Vilken arbetsplats passar dig?"}</h3>
    {loading ? <p role="status">Hämtar arbetsplatsval…</p> : !loadError && <>
      {saved && <p>{workplaceLabel(saved)}{!places.some(place => place.id === saved.id && workplaceLabel(place) === workplaceLabel(saved)) && " (adressen vid valet; arbetsplatsen har ändrats)"}</p>}
      {!readOnly && <>
        <p>Frivilligt. Din ansökan gäller den gemensamma annonsen.</p>
        <label>Önskad arbetsplats<select className="input-field" value={selected} disabled={busy} onChange={event => { setSelected(event.target.value); setNote(""); }}>
          <option value="">Alla arbetsplatser / inget önskemål</option>
          {saved && !places.some(place => place.id === saved.id) && <option value={saved.id} disabled>Tidigare val (arbetsplats borttagen)</option>}
          {places.map(place => <option key={place.id} value={place.id}>{workplaceLabel(place)}</option>)}
        </select></label>
        <button className={`secondary-btn ${styles.action}`} type="button" disabled={busy || Boolean(selected && !places.some(place => place.id === selected))} onClick={() => void save()}>{busy ? "Sparar…" : "Spara arbetsplatsval"}</button>
      </>}
      {readOnly && !saved && <p>Inget särskilt önskemål.</p>}
    </>}
    {error && <p role="alert">{error}</p>}
    {loadError && <button type="button" className={`secondary-btn ${styles.action}`} disabled={loading} onClick={() => { setLoading(true); setRevision(current => current + 1); }}>Försök igen</button>}
    {note && <p role="status">{note}</p>}
  </section>;
}
