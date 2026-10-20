"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { EMPTY_JOB_FORM, hasJobDraftContent, type JobBuilderDraft } from "@/lib/job-copy";
import { jobDraftSnapshot, jobDraftStore, readLegacyJobDraft, type JobDraftStep } from "@/lib/job-drafts";

export function useJobDraft(ownerId: string | undefined) {
  const [form, setForm] = useState<JobBuilderDraft>(EMPTY_JOB_FORM);
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [step, setStep] = useState<JobDraftStep>(1);
  const [hydratedOwner, setHydratedOwner] = useState<string>();
  const [sessionOwner, setSessionOwner] = useState(ownerId);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [savedInputs, setSavedInputs] = useState<{ form: JobBuilderDraft; files: File[]; step: JobDraftStep }>();
  const [error, setError] = useState("");
  const [readBlocked, setReadBlocked] = useState(false);
  const currentOwner = useRef(ownerId);
  const revision = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const storageKey = ownerId ? `employo-job-draft:${ownerId}` : "";
  // A returning account must reload too; an old hydrated owner is not a lease.
  if (sessionOwner !== ownerId) { setSessionOwner(ownerId); setHydratedOwner(undefined); }

  useEffect(() => {
    currentOwner.current = ownerId;
    const currentRevision = revision;
    const request = ++currentRevision.current;
    let active = true;
    if (!ownerId) return;
    void (async () => {
      let snapshot;
      let problem = "";
      try { snapshot = await jobDraftStore.load(ownerId); }
      catch { problem = "Det sparade bildutkastet kunde inte öppnas. Försök ladda om innan du ersätter det."; }
      if (!snapshot) {
        try { snapshot = readLegacyJobDraft(ownerId, window.localStorage.getItem(storageKey)); }
        catch { problem = "Det tidigare utkastet kunde inte läsas. Det har inte tagits bort."; }
      }
      if (!active || request !== revision.current) return;
      const loadedForm = snapshot?.form ?? EMPTY_JOB_FORM;
      const loadedStep = snapshot?.builderStep ?? 1;
      const loadedFiles = snapshot?.images.map(image => new File([image.blob], image.name, { type: image.blob.type, lastModified: image.lastModified })) ?? [];
      setForm(loadedForm); setStep(loadedStep); setSavedAt(snapshot?.savedAt ?? null); setFiles(loadedFiles);
      setSaveStatus(problem ? "error" : snapshot?.savedAt ? "saved" : "idle");
      setSavedInputs(snapshot?.savedAt ? { form: loadedForm, files: loadedFiles, step: loadedStep } : undefined);
      setReadBlocked(Boolean(problem));
      setError(problem);
      setHydratedOwner(ownerId);
    })();
    return () => {
      active = false; currentRevision.current++; clearTimeout(timer.current);
      if (currentOwner.current === ownerId) currentOwner.current = undefined;
    };
  }, [ownerId, storageKey]);

  useEffect(() => {
    const urls = files.map(file => URL.createObjectURL(file));
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Synchronize browser object URLs and release exactly these resources on cleanup.
    setPreviews(urls);
    return () => urls.forEach(url => URL.revokeObjectURL(url));
  }, [files]);

  const persist = useCallback(async (nextForm: JobBuilderDraft, nextFiles: File[], nextStep: JobDraftStep) => {
    if (!ownerId || currentOwner.current !== ownerId) throw new Error("Kontot har ändrats. Öppna utkastet igen.");
    const request = ++revision.current;
    setSaveStatus("saving"); setError("");
    try {
      const snapshot = jobDraftSnapshot(ownerId, nextForm, nextFiles, nextStep);
      await jobDraftStore.save(snapshot);
      // Remove the old text-only copy only after the complete atomic write.
      try { window.localStorage.removeItem(storageKey); } catch { /* IndexedDB contains the complete draft. */ }
      if (request === revision.current && currentOwner.current === ownerId) {
        setSavedAt(snapshot.savedAt); setSavedInputs({ form: nextForm, files: nextFiles, step: nextStep }); setReadBlocked(false); setSaveStatus("saved");
      }
    } catch (reason) {
      if (request === revision.current && currentOwner.current === ownerId) {
        setSaveStatus("error");
        setError(reason instanceof Error ? reason.message : "Utkastet kunde inte sparas. Behåll sidan öppen och försök igen.");
      }
      throw reason;
    }
  }, [ownerId, storageKey]);

  const hydrated = Boolean(ownerId) && sessionOwner === ownerId && hydratedOwner === ownerId;
  useEffect(() => {
    // An unreadable existing draft may only be replaced by an explicit save.
    if (!hydrated || readBlocked) return;
    if (savedInputs?.form === form && savedInputs.files === files && savedInputs.step === step) return;
    if (!hasJobDraftContent(form)) {
      if (!savedAt || !ownerId) return;
      const request = ++revision.current;
      timer.current = setTimeout(() => {
        void jobDraftStore.remove(ownerId).then(() => {
          if (request === revision.current && currentOwner.current === ownerId) {
            setSavedAt(null); setSavedInputs(undefined); setSaveStatus("idle");
          }
        }).catch(() => {
          if (request === revision.current && currentOwner.current === ownerId) {
            setSaveStatus("error"); setError("Det tomma utkastet kunde inte tas bort. Försök igen innan du stänger sidan.");
          }
        });
      }, 400);
      return () => clearTimeout(timer.current);
    }
    timer.current = setTimeout(() => { void persist(form, files, step).catch(() => {}); }, 400);
    return () => { clearTimeout(timer.current); };
  }, [hydrated, form, files, step, persist, savedAt, ownerId, savedInputs, readBlocked]);

  const saveNow = async () => {
    if (!hydrated) throw new Error("Vänta tills utkastet har öppnats.");
    clearTimeout(timer.current);
    await persist(form, files, step);
  };
  const replace = async (nextForm: JobBuilderDraft) => {
    if (!hydrated) throw new Error("Vänta tills utkastet har öppnats.");
    clearTimeout(timer.current);
    const expectedOwner = ownerId;
    await persist(nextForm, [], 1);
    if (currentOwner.current !== expectedOwner) throw new Error("Kontot har ändrats. Öppna annonsen igen.");
    setForm(nextForm); setFiles([]); setStep(1);
  };
  const clear = async () => {
    if (!ownerId || currentOwner.current !== ownerId) return;
    clearTimeout(timer.current); revision.current++;
    // Clear the visible form even if cleanup fails after successful publication.
    setForm(EMPTY_JOB_FORM); setFiles([]); setStep(1); setSavedAt(null); setSavedInputs(undefined); setSaveStatus("idle"); setError("");
    await jobDraftStore.remove(ownerId);
    window.localStorage.removeItem(storageKey);
  };
  const changed = (hasJobDraftContent(form) || Boolean(savedInputs)) && (savedInputs?.form !== form || savedInputs?.files !== files || savedInputs?.step !== step);
  const visibleStatus = changed && saveStatus !== "error" ? "saving" : saveStatus;
  return { form, setForm, files, setFiles, previews, step, setStep, hydrated, savedAt, saveStatus: visibleStatus, error, saveNow, replace, clear };
}
