"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { EMPTY_JOB_FORM, hasJobDraftContent, type JobBuilderDraft } from "@/lib/job-copy";
import { JobDraftConflictError, jobDraftSnapshot, jobDraftStore, readLegacyJobDraft, type JobDraftStep } from "@/lib/job-drafts";

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
  const [conflict, setConflict] = useState(false);
  const currentOwner = useRef(ownerId);
  const storageState = useRef<{ ownerId: string; revision: string | null } | null>(null);
  const writeQueue = useRef<Promise<unknown>>(Promise.resolve());
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
      let storedVersion: string | null = null;
      let problem = "";
      try { const stored = await jobDraftStore.read(ownerId); snapshot = stored.snapshot; storedVersion = stored.revision; }
      catch { problem = "Det sparade bildutkastet kunde inte öppnas. Försök ladda om innan du ersätter det."; }
      if (!snapshot && !storedVersion) {
        try { snapshot = readLegacyJobDraft(ownerId, window.localStorage.getItem(storageKey)); }
        catch { problem = "Det tidigare utkastet kunde inte läsas. Det har inte tagits bort."; }
      }
      if (!active || request !== revision.current) return;
      storageState.current = { ownerId, revision: storedVersion };
      const loadedForm = snapshot?.form ?? EMPTY_JOB_FORM;
      const loadedStep = snapshot?.builderStep ?? 1;
      const loadedFiles = snapshot?.images.map(image => new File([image.blob], image.name, { type: image.blob.type, lastModified: image.lastModified })) ?? [];
      setForm(loadedForm); setStep(loadedStep); setSavedAt(snapshot?.savedAt ?? null); setFiles(loadedFiles);
      setSaveStatus(problem ? "error" : snapshot?.savedAt ? "saved" : "idle");
      setSavedInputs(snapshot?.savedAt ? { form: loadedForm, files: loadedFiles, step: loadedStep } : undefined);
      setReadBlocked(Boolean(problem));
      setConflict(false);
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
    setPreviews(urls);
    return () => urls.forEach(url => URL.revokeObjectURL(url));
  }, [files]);

  const persist = useCallback(async (nextForm: JobBuilderDraft, nextFiles: File[], nextStep: JobDraftStep) => {
    const lease = storageState.current;
    if (!ownerId || currentOwner.current !== ownerId || lease?.ownerId !== ownerId) throw new Error("Kontot har ändrats. Öppna utkastet igen.");
    const request = ++revision.current;
    setSaveStatus("saving"); setError("");
    try {
      const snapshot = jobDraftSnapshot(ownerId, nextForm, nextFiles, nextStep);
      const operation = writeQueue.current.catch(() => {}).then(async () => {
        if (currentOwner.current !== ownerId || storageState.current !== lease) throw new Error("Kontot har ändrats. Öppna utkastet igen.");
        lease.revision = await jobDraftStore.save(snapshot, lease.revision);
        return lease.revision;
      });
      writeQueue.current = operation;
      await operation;
      // Remove the old text-only copy only after the complete atomic write.
      try { window.localStorage.removeItem(storageKey); } catch { /* IndexedDB contains the complete draft. */ }
      if (request === revision.current && currentOwner.current === ownerId) {
        setSavedAt(snapshot.savedAt); setSavedInputs({ form: nextForm, files: nextFiles, step: nextStep }); setReadBlocked(false); setConflict(false); setSaveStatus("saved");
      }
    } catch (reason) {
      if (request === revision.current && currentOwner.current === ownerId) {
        setSaveStatus("error");
        if (reason instanceof JobDraftConflictError) { setReadBlocked(true); setConflict(true); }
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
      const lease = storageState.current;
      timer.current = setTimeout(() => {
        const operation = writeQueue.current.catch(() => {}).then(async () => {
          if (!lease || currentOwner.current !== ownerId || storageState.current !== lease) return;
          lease.revision = await jobDraftStore.remove(ownerId, lease.revision);
        });
        writeQueue.current = operation;
        void operation.then(() => {
          if (request === revision.current && currentOwner.current === ownerId) {
            setSavedAt(null); setSavedInputs(undefined); setSaveStatus("idle");
          }
        }).catch(reason => {
          if (request === revision.current && currentOwner.current === ownerId) {
            setSaveStatus("error");
            if (reason instanceof JobDraftConflictError) { setReadBlocked(true); setConflict(true); setError(reason.message); }
            else setError("Det tomma utkastet kunde inte tas bort. Försök igen innan du stänger sidan.");
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
  const checkCurrent = async () => {
    const lease = storageState.current;
    if (!hydrated || !ownerId || currentOwner.current !== ownerId || lease?.ownerId !== ownerId) throw new Error("Öppna utkastet igen innan du publicerar.");
    clearTimeout(timer.current);
    await writeQueue.current.catch(() => {});
    if (currentOwner.current !== ownerId || storageState.current !== lease) throw new Error("Kontot har ändrats. Öppna utkastet igen.");
    const stored = await jobDraftStore.read(ownerId);
    if (currentOwner.current !== ownerId || storageState.current !== lease) throw new Error("Kontot har ändrats. Öppna utkastet igen.");
    if (stored.revision !== lease.revision) {
      const reason = new JobDraftConflictError();
      setReadBlocked(true); setConflict(true); setSaveStatus("error"); setError(reason.message);
      throw reason;
    }
    // Flush this tab's pending edits before remembering the publication revision.
    // Otherwise its own delayed autosave would look like a newer, unrelated draft at cleanup.
    if (savedInputs?.form !== form || savedInputs.files !== files || savedInputs.step !== step) await persist(form, files, step);
    return lease.revision;
  };
  const reload = async () => {
    if (!ownerId || !hydrated || currentOwner.current !== ownerId) return;
    clearTimeout(timer.current);
    const request = ++revision.current;
    setReadBlocked(true);
    try {
      await writeQueue.current.catch(() => {});
      const stored = await jobDraftStore.read(ownerId);
      if (request !== revision.current || currentOwner.current !== ownerId) return;
      const nextForm = stored.snapshot?.form ?? EMPTY_JOB_FORM;
      const nextStep = stored.snapshot?.builderStep ?? 1;
      const nextFiles = stored.snapshot?.images.map(image => new File([image.blob], image.name, { type: image.blob.type, lastModified: image.lastModified })) ?? [];
      storageState.current = { ownerId, revision: stored.revision };
      setForm(nextForm); setFiles(nextFiles); setStep(nextStep); setSavedAt(stored.snapshot?.savedAt ?? null);
      // An empty record is also acknowledged; do not schedule a redundant save after reload.
      setSavedInputs({ form: nextForm, files: nextFiles, step: nextStep });
      setError(""); setConflict(false); setReadBlocked(false); setSaveStatus(stored.snapshot ? "saved" : "idle");
    } catch {
      if (request === revision.current && currentOwner.current === ownerId) {
        setSaveStatus("error"); setError("Det sparade utkastet kunde inte öppnas. Dina ändringar finns kvar här. Försök igen.");
      }
    }
  };
  const replace = async (nextForm: JobBuilderDraft) => {
    if (!hydrated) throw new Error("Vänta tills utkastet har öppnats.");
    clearTimeout(timer.current);
    const expectedOwner = ownerId;
    await persist(nextForm, [], 1);
    if (currentOwner.current !== expectedOwner) throw new Error("Kontot har ändrats. Öppna annonsen igen.");
    setForm(nextForm); setFiles([]); setStep(1);
  };
  const clear = async (expectedRevision = storageState.current?.revision ?? null) => {
    const lease = storageState.current;
    if (!ownerId || currentOwner.current !== ownerId || lease?.ownerId !== ownerId) return;
    clearTimeout(timer.current); revision.current++;
    const operation = writeQueue.current.catch(() => {}).then(async () => {
      lease.revision = await jobDraftStore.remove(ownerId, expectedRevision);
    });
    writeQueue.current = operation;
    try { await operation; }
    catch (reason) {
      if (currentOwner.current === ownerId && storageState.current === lease) {
        setReadBlocked(true); setSaveStatus("error");
        if (reason instanceof JobDraftConflictError) { setConflict(true); setError(reason.message); }
        else setError("Annonsen är skapad, men det lokala utkastet kunde inte tas bort. Publicera det inte igen.");
      }
      throw reason;
    }
    if (currentOwner.current !== ownerId || storageState.current !== lease) return;
    setForm(EMPTY_JOB_FORM); setFiles([]); setStep(1); setSavedAt(null); setSavedInputs(undefined); setSaveStatus("idle"); setError(""); setConflict(false); setReadBlocked(false);
    window.localStorage.removeItem(storageKey);
  };
  const changed = (hasJobDraftContent(form) || Boolean(savedInputs)) && (savedInputs?.form !== form || savedInputs?.files !== files || savedInputs?.step !== step);
  const visibleStatus = changed && saveStatus !== "error" ? "saving" : saveStatus;
  return { form, setForm, files, setFiles, previews, step, setStep, hydrated, savedAt, saveStatus: visibleStatus, error, conflict, saveNow, replace, clear, reload, checkCurrent };
}
