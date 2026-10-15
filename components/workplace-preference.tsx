"use client";

import { useEffect, useState } from "react";
import { getSupabaseClient } from "@/lib/supabase";
import { getJobWorkplaces, workplaceLabel, type JobWorkplace } from "@/lib/job-workplaces";
import type { JobPost } from "@/lib/types";

export function WorkplacePreference({ job, youthId, readOnly = false }: { job: JobPost; youthId: string; readOnly?: boolean }) {
  const [saved, setSaved] = useState<JobWorkplace | null>(null);
  const [selected, setSelected] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [error, setError] = useState("");
  const [note, setNote] = useState("");
  const [revision, setRevision] = useState(0);
  const places = getJobWorkplaces(job);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const { data, error } = await getSupabaseClient().from("application_workplace_preferences")
          .select("workplace_snapshot").eq("job_id", job.id).eq("youth_user_id", youthId).maybeSingle();
        if (error) throw error;
        if (!active) return;
        const value = data?.workplace_snapshot as JobWorkplace | undefined;
        setSaved(value ?? null);
        setSelected(value?.id ?? "");
        setLoadError(false);
        setError("");
      } catch {
        if (active) { setLoadError(true); setError("Kunde inte läsa arbetsplatsvalet."); }
      } finally { if (active) setLoading(false); }
    })();
    return () => { active = false; };
  }, [job.id, youthId, revision]);

  if (places.length <= 1 && !saved && !loading && !error) return null;

  const save = async () => {
    if (busy || loading || loadError) return;
    setBusy(true); setError(""); setNote("");
    try {
      const db = getSupabaseClient();
      if (!selected) {
        const { error } = await db.from("application_workplace_preferences").delete().eq("job_id", job.id).eq("youth_user_id", youthId);
        if (error) throw error;
        setSaved(null);
      } else {
        const { data, error } = await db.from("application_workplace_preferences")
          .upsert({ job_id: job.id, youth_user_id: youthId, workplace_id: selected }, { onConflict: "job_id,youth_user_id" })
          .select("workplace_snapshot").single();
        if (error) throw error;
        setSaved(data.workplace_snapshot as JobWorkplace);
      }
      setNote("Arbetsplatsvalet är sparat.");
    } catch { setError("Kunde inte spara arbetsplatsvalet. Försök igen."); }
    finally { setBusy(false); }
  };

  return <section className="card" style={{ padding: "1rem", marginBlock: "1rem" }}>
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
        <button className="secondary-btn" style={{ padding: ".65rem 1rem", marginTop: ".7rem" }} type="button" disabled={busy || Boolean(selected && !places.some(place => place.id === selected))} onClick={() => void save()}>{busy ? "Sparar…" : "Spara arbetsplatsval"}</button>
      </>}
      {readOnly && !saved && <p>Inget särskilt önskemål.</p>}
    </>}
    {error && <p role="alert">{error}</p>}
    {loadError && <button type="button" className="secondary-btn" style={{ padding: ".65rem 1rem" }} disabled={loading} onClick={() => { setLoading(true); setRevision(current => current + 1); }}>Försök igen</button>}
    {note && <p role="status">{note}</p>}
  </section>;
}
