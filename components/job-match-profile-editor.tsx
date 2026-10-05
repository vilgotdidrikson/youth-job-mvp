"use client";

import { ModalDialog } from "./modal-dialog";
import { useEffect, useState, type FormEvent } from "react";
import { getJobMatchProfile, saveJobMatchProfile, type JobMatchProfile } from "@/lib/match-profiles";
import { getSupabaseClient } from "@/lib/supabase";

const list = (text: string) => text.split("\n").map((item) => item.trim()).filter(Boolean);

export function JobMatchProfileEditor({ jobId, title, onClose, onSaved }: { jobId: string; title: string; onClose: () => void; onSaved: () => void }) {
  const [profile, setProfile] = useState<JobMatchProfile | null>(null);
  const [summary, setSummary] = useState(title);
  const [mustHaves, setMustHaves] = useState("");
  const [trainable, setTrainable] = useState("");
  const [traits, setTraits] = useState("");
  const [questions, setQuestions] = useState("");
  const [history, setHistory] = useState<{ profile_version: number; snapshot: JobMatchProfile; created_at: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    void Promise.all([getJobMatchProfile(jobId), getSupabaseClient().from("job_match_profile_versions").select("profile_version,snapshot,created_at").eq("job_id", jobId).order("profile_version", { ascending: false }).limit(20)])
      .then(([data, versions]) => {
        if (!active) return;
        if (versions.error) throw new Error("Kunde inte läsa versionshistoriken.");
        setProfile(data);
        if (data) { setSummary(data.role_summary); setMustHaves(data.must_haves.join("\n")); setTrainable(data.trainable_requirements.join("\n")); setTraits(data.top_traits.join("\n")); setQuestions(data.candidate_questions.map((item) => item.question).join("\n")); }
        setHistory(versions.data ?? []);
        setLoading(false);
      }).catch((reason) => { if (active) { setError(reason instanceof Error ? reason.message : "Kunde inte läsa matchprofilen."); } });
    return () => { active = false; };
  }, [jobId, onClose]);
  const save = async (event: FormEvent) => {
    event.preventDefault(); if (busy || loading) return;
    setBusy(true); setError("");
    try {
      await saveJobMatchProfile({ jobId, roleSummary: summary, mustHaves: list(mustHaves), trainableRequirements: list(trainable), topTraits: list(traits), candidateQuestions: list(questions) }, profile?.profile_version ?? null);
      onSaved();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Kunde inte spara matchprofilen."); }
    finally { setBusy(false); }
  };
  return <ModalDialog label={`Matchkriterier för ${title}`} onClose={onClose} busy={busy}>
    <form className="company-match-modal-content job-match-editor" onSubmit={(event) => void save(event)}>
      <button type="button" className="company-match-modal-close" aria-label="Stäng kriterier" disabled={busy} onClick={onClose}>×</button>
      <h2>Matchkriterier</h2><p>{title}{profile ? ` · Version ${profile.profile_version}` : ""}</p>
      <p>Nya kriterier används vid nästa bedömning. Befintliga ansökningsfrågor, svar och tidigare bedömningar behålls. Ändringar här uppdaterar matchningen; annonsens beskrivning ändras inte.</p>
      {error && <p role="alert">{error}</p>}
      {loading ? <p>Läser matchprofil…</p> : <>
        <label>Rollbeskrivning<textarea autoFocus className="input-field" required maxLength={2000} rows={3} value={summary} disabled={busy} onChange={(event) => setSummary(event.target.value)} /></label>
        <label>Grundkrav <small>En konkret uppgift per rad, högst 8. Exempel: B-körkort, kan arbeta helger.</small><textarea className="input-field" rows={4} value={mustHaves} disabled={busy} onChange={(event) => setMustHaves(event.target.value)} /></label>
        <label>Kan läras på plats <small>Högst 7. Påverkar inte matchgraden.</small><textarea className="input-field" rows={3} value={trainable} disabled={busy} onChange={(event) => setTrainable(event.target.value)} /></label>
        <label>Önskade egenskaper <small>Högst 5. Personlighet ska inte gissas från CV:t.</small><textarea className="input-field" rows={3} value={traits} disabled={busy} onChange={(event) => setTraits(event.target.value)} /></label>
        <label>Valfria ansökningsfrågor <small>Högst 3, en per rad. Gäller endast nya ansökningar.</small><textarea className="input-field" rows={3} value={questions} disabled={busy} onChange={(event) => setQuestions(event.target.value)} /></label>
        <button type="submit" className="cta-btn" disabled={busy}>{busy ? "Sparar…" : "Spara matchkriterier"}</button>
        <details><summary>Versionshistorik ({history.length})</summary>{history.map((version) => <details key={version.profile_version}><summary>Version {version.profile_version} · {new Date(version.created_at).toLocaleString("sv-SE")}</summary><p>{version.snapshot.role_summary}</p><p>Grundkrav: {version.snapshot.must_haves.join(" · ") || "Inga"}</p><p>Kan läras: {version.snapshot.trainable_requirements.join(" · ") || "Inga"}</p><p>Egenskaper: {version.snapshot.top_traits.join(" · ") || "Inga"}</p><p>Frågor: {version.snapshot.candidate_questions.map((item) => item.question).join(" · ") || "Inga"}</p></details>)}</details>
      </>}
    </form>
  </ModalDialog>;
}
