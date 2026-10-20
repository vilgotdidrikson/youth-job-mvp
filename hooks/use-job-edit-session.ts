"use client";
import { useCallback, useEffect, useState, type SetStateAction } from "react";
import { EMPTY_JOB_FORM, type JobBuilderDraft } from "@/lib/job-copy";
import { loadOwnJobForEdit } from "@/lib/job-edit-client";
import type { JobMatchProfile } from "@/lib/match-profiles";
import type { JobPost } from "@/lib/types";
import type { JobDraftStep } from "@/lib/job-drafts";

interface Session { key: string; job: JobPost; criteria: JobMatchProfile | null; baseline: JobBuilderDraft; form: JobBuilderDraft }

/**
 * In-memory editing of a saved listing. Kept apart from the local create
 * draft so editing never overwrites an unpublished draft on this device.
 */
export function useJobEditSession(ownerId: string | undefined, jobId: string | null) {
  const key = ownerId && jobId ? `${ownerId}:${jobId}` : "";
  const [session, setSession] = useState<Session | null>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [step, setStep] = useState<JobDraftStep>(1);
  const [error, setError] = useState("");
  const [reload, setReload] = useState(0);
  // Leaving the edit view drops the session, so reopening always starts from the saved listing.
  const [trackedKey, setTrackedKey] = useState(key);
  if (trackedKey !== key) { setTrackedKey(key); setSession(null); setError(""); }
  const current = session?.key === key ? session : null;

  useEffect(() => {
    if (!key || !jobId) return;
    let active = true;
    void loadOwnJobForEdit(jobId).then(
      (source) => { if (active) { setSession({ key, job: source.job, criteria: source.criteria, baseline: source.form, form: source.form }); setFiles([]); setStep(1); setError(""); } },
      (reason) => { if (active) setError(reason instanceof Error ? reason.message : "Annonsen kunde inte öppnas för redigering."); },
    );
    return () => { active = false; };
  }, [key, jobId, reload]);

  useEffect(() => {
    const urls = files.map(file => URL.createObjectURL(file));
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Synchronize browser object URLs and release exactly these resources on cleanup.
    setPreviews(urls);
    return () => urls.forEach(url => URL.revokeObjectURL(url));
  }, [files]);

  const dirty = Boolean(current && (files.length > 0 || JSON.stringify(current.form) !== JSON.stringify(current.baseline)));
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const setForm = useCallback((next: SetStateAction<JobBuilderDraft>) => {
    setSession(existing => existing && existing.key === key
      ? { ...existing, form: typeof next === "function" ? next(existing.form) : next }
      : existing);
  }, [key]);

  /** Record a partial save so a retry only sends what is still unsaved. */
  const rebase = useCallback((job: JobPost, baseline: JobBuilderDraft) => {
    setSession(existing => existing && existing.key === key ? { ...existing, job, baseline, form: { ...existing.form, imageUrls: baseline.imageUrls, imagePending: false } } : existing);
    setFiles([]);
  }, [key]);

  return {
    job: current?.job ?? null,
    criteria: current?.criteria ?? null,
    baseline: current?.baseline ?? EMPTY_JOB_FORM,
    form: current?.form ?? EMPTY_JOB_FORM,
    setForm, files, setFiles, previews, step, setStep,
    hydrated: Boolean(current),
    error: key ? error : "",
    dirty, rebase,
    retry: () => { setError(""); setReload(value => value + 1); },
  };
}
