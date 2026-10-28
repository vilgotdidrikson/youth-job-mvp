"use client";

import { authenticatedHeaders } from "@/lib/api-client";
import { CompanyJobCandidates } from "@/components/company-job-candidates";
import { BrandLogo } from "@/components/brand-logo";

import { JobWorkplaceFields } from "@/components/job-workplace-fields";
import { JobWorkplaceEditor } from "@/components/job-workplace-editor";
import { validateJobWorkplaces, jobCities, type JobWorkplace } from "@/lib/job-workplaces";

import { FormEvent, Suspense, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useJobDraft } from "@/hooks/use-job-draft";
import { useJobEditSession } from "@/hooks/use-job-edit-session";
import { JOB_EDIT_CONSEQUENCES, jobEditCriteria, jobEditCriteriaChanged, jobEditReceipt, jobEditUpdates, jobEditVisibility, textListItems, withSavedPublicFields } from "@/lib/job-edit";
import { useRequireAuth } from "@/hooks/use-require-auth";
import { AuthGateMessage } from "@/components/auth-gate-message";
import "./company-design.css";
import { draftJobCategories, categoryLabel, effectiveJobCategories } from "@/lib/job-categories";
import { JobCategoryField } from "@/components/job-category-field";
import { JobCategoryEditor } from "@/components/job-category-editor";
import { JobPublicationNotice } from "@/components/job-publication-notice";
import { CompanyVerificationStatus } from "@/components/company-verification-status";
import { jobPublicationAction, jobPublicationState, jobPublicationLabel } from "@/lib/job-publication";
import { JobPreviewDialog } from "@/components/job-preview-dialog";
import { ModalDialog } from "@/components/modal-dialog";
import { UiIcon } from "@/components/ui-icon";
import { TabList } from "@/components/tab-list";
import { tabPanelProps } from "@/lib/tab-keyboard";
import { CompanyMatchProfileForm } from "@/components/company-match-profile-form";
import { JobMatchProfileEditor } from "@/components/job-match-profile-editor";
import { ImageCropDialog } from "@/components/image-crop-dialog";
import { getSupabaseClient } from "@/lib/supabase";
import { getCompanyJobs as getFeedCompanyJobs } from "@/lib/feeds";
import { draftSalary, hasJobDraftContent, validateDraftPublication, type JobBuilderDraft as JobForm } from "@/lib/job-copy";
import { loadOwnJobCopy } from "@/lib/job-copy-client";
import { addMustHave, applyAiJobSuggestion, type AiJobReview, type AiJobSuggestion } from "@/lib/job-ai-review";
import { JobAiReviewPanel } from "@/components/job-ai-review-panel";
import { firstPracticalError, localIsoDate, practicalErrors, practicalPayload } from "@/lib/job-practical";
import { JobPracticalFields } from "@/components/job-practical-fields";
import { firstJobFieldError, jobFieldErrors, jobFieldStep, parseSalaryText, prefillCompanyCity, type JobFieldName } from "@/lib/job-fields";
import { COMPANY_ROUTES, companyView, createdCompanyJobHref, editCompanyJobHref, companyJobCandidatesHref } from "@/lib/company-navigation";
import { createJob, deleteJob, updateJob } from "@/lib/jobs";
import { CloseRecruitmentDialog } from "@/components/close-recruitment-dialog";
import { CompanyRecruitmentStatus } from "@/components/company-recruitment-status";
import { PageLoading } from "@/components/page-loading";
import { createInitialJobMatchProfile, saveJobMatchProfile } from "@/lib/match-profiles";
import { uploadJobImage } from "@/lib/storage";
import { ADDRESS_SUGGESTIONS, CITY_SUGGESTIONS, JOB_TITLE_SUGGESTIONS } from "@/lib/form-suggestions";
import type { CompanyProfile, JobPost } from "@/lib/types";

const EMPLOYMENT_TYPES = ["Deltid", "Heltid", "Sommarjobb", "Helgjobb", "Extra vid behov"];
const BENEFIT_TIPS = ["Flexibla tider", "Introduktion", "Personalrabatt", "Friskvårdsbidrag", "Måltid ingår"];
const REQUIREMENT_TIPS = ["Kan arbeta helger", "Tidigare erfarenhet", "B-körkort", "Svenska", "Kan börja omgående"];
const TRAIT_TIPS = ["Ansvarstagande", "Punktlig", "Social", "Noggrann", "Serviceinriktad", "Nyfiken", "Samarbetsvillig"];



function toggleTextList(value: string, item: string): string {
  const items = value.split(",").map((entry) => entry.trim()).filter(Boolean);
  return items.includes(item) ? items.filter((entry) => entry !== item).join(", ") : [...items, item].join(", ");
}

function formWorkplaces(form: JobForm): JobWorkplace[] {
  return Array.isArray(form.workplaces) && form.workplaces.length ? form.workplaces : [{ id: "00000000-0000-4000-8000-000000000001", name: "Huvudarbetsplats", address: form.address, postal_code: form.postalCode, city: form.city, longitude: null, latitude: null }];
}

function CompanyPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, profile, loading, status, error: sessionError } = useRequireAuth();
  const hasCompanyAccess = profile?.role === "company";
  const jobDraft = useJobDraft(hasCompanyAccess ? user?.id : undefined);

  const [jobs, setJobs] = useState<JobPost[]>([]);
  const [companyProfile, setCompanyProfile] = useState<CompanyProfile | null>(null);
  const tab = companyView(searchParams.get("view"), companyProfile?.verification_status === "verified");
  // Editing a saved listing reuses the builder with its own in-memory form, never the local create draft.
  const editing = tab === "redigera";
  const jobEdit = useJobEditSession(hasCompanyAccess ? user?.id : undefined, editing ? searchParams.get("edit") : null);
  const builder = editing ? jobEdit : jobDraft;
  const { form, setForm, files: jobImageFiles, setFiles: setJobImageFiles, previews: jobImagePreviews, step: builderStep, setStep: setBuilderStep, hydrated: builderHydrated } = builder;
  const draftHydrated = jobDraft.hydrated;
  const [editReceipt, setEditReceipt] = useState("");
  const [dataOwnerId, setDataOwnerId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [jobActionId, setJobActionId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [imageToCrop, setImageToCrop] = useState<File | null>(null);
  const [generatingAi, setGeneratingAi] = useState(false);
  const [aiMessage, setAiMessage] = useState("");
  const [aiReview, setAiReview] = useState<{ session: string; review: AiJobReview } | null>(null);
  const [showCustomBenefit, setShowCustomBenefit] = useState(false);
  const [showCustomRequirement, setShowCustomRequirement] = useState(false);
  const [customBenefit, setCustomBenefit] = useState("");
  const [customRequirement, setCustomRequirement] = useState("");
  const [previewOpen, setPreviewOpen] = useState(false);
  const [shownFields, setShownFields] = useState<Partial<Record<JobFieldName, boolean>>>({});
  const [practicalShowAll, setPracticalShowAll] = useState(false);
  const [cityPrefill, setCityPrefill] = useState("");
  const [showMatchProfileEditor, setShowMatchProfileEditor] = useState(false);
  const [editingCategory,setEditingCategory]=useState<JobPost|null>(null);
  const [editingWorkplaces, setEditingWorkplaces] = useState<JobPost | null>(null);
  const [editingCriteria, setEditingCriteria] = useState<JobPost | null>(null);
  const [copyingJob, setCopyingJob] = useState<JobPost | null>(null);
  const [copyError, setCopyError] = useState("");
  const [copyBusy, setCopyBusy] = useState(false);
  const copyLock = useRef(false);
  const [closingJob, setClosingJob] = useState<JobPost | null>(null);
  const closeCriteria = useCallback(() => setEditingCriteria(null), []);


  const dataRead = useRef(0);
  const loadData = async (userId: string) => {
    const revision = ++dataRead.current;
    try {
      setError("");
      const supabase = getSupabaseClient();
      const [jobsData, { data: cp, error: companyError }] = await Promise.all([
        getFeedCompanyJobs(),
        supabase.from("company_profiles").select("*").eq("user_id", userId).maybeSingle(),
      ]);
      if (revision !== dataRead.current) return;
      if (companyError) throw new Error("Kunde inte hämta företagets verifieringsstatus. Försök igen.");
      if (jobsData.some(job => job.company_user_id !== userId)) throw new Error("Annonslistan kunde inte verifieras.");
      setJobs(jobsData);
      setCompanyProfile(null);
      if (cp) {
        const nextCompanyProfile = cp as CompanyProfile;
        setCompanyProfile(nextCompanyProfile);

      }
      setDataOwnerId(userId);
    } catch (err) {
      if (revision !== dataRead.current) return;
      setError(err instanceof Error ? err.message : "Kunde inte ladda data.");
    }
  };

  useEffect(() => {
    if (!loading && user && profile?.role === "company") {
      void loadData(user.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- Invalidate the current read generation on account/effect cleanup.
    return () => { dataRead.current++; };
  }, [loading, user, profile?.role, router]);

  useEffect(() => {
    if (searchParams.get("view") === "swipe" && companyProfile) {
      window.history.replaceState(null, "", companyProfile.verification_status === "verified" ? COMPANY_ROUTES.candidates : COMPANY_ROUTES.create);
    }
  }, [companyProfile, searchParams]);

  const handleCopyJob = async () => {
    if (!copyingJob || copyLock.current || !user) return;
    copyLock.current = true; setCopyBusy(true); setCopyError("");
    try {
      const copied = await loadOwnJobCopy(copyingJob.id);
      // Persist before replacing the visible form. Storage failure keeps the old draft intact.
      await jobDraft.replace(copied);
      setAiMessage(""); setAiReview(null); setError(""); setPreviewOpen(false); setCopyingJob(null);
      window.history.replaceState(null, "", COMPANY_ROUTES.create);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (reason) { setCopyError(reason instanceof Error ? reason.message : "Kunde inte kopiera annonsen. Ditt befintliga utkast finns kvar."); }
    finally { copyLock.current = false; setCopyBusy(false); }
  };

  const fieldErrors = jobFieldErrors(form);
  const fieldError = (field: JobFieldName) => shownFields[field] ? fieldErrors[field] : undefined;
  const showField = (field: JobFieldName) => setShownFields(current => current[field] ? current : { ...current, [field]: true });
  const fieldProps = (field: JobFieldName) => ({ id: `job-field-${field}`, "aria-invalid": fieldError(field) ? true : undefined, "aria-describedby": fieldError(field) ? `job-field-${field}-error` : undefined, onBlur: () => showField(field) });
  /** Age and salary errors block preview, the next step and saving, and lead to the field. */
  const fieldsAreValid = (fields: JobFieldName[] = ["minAge", "maxAge", "salaryFrom", "salaryTo"]): boolean => {
    const first = firstJobFieldError(Object.fromEntries(fields.map(field => [field, fieldErrors[field]])));
    if (!first) return true;
    setShownFields(current => ({ ...current, ...Object.fromEntries(fields.map(field => [field, true])) }));
    setError(first.message);
    if (jobFieldStep(first.field) !== builderStep) setBuilderStep(jobFieldStep(first.field));
    window.setTimeout(() => document.getElementById(`job-field-${first.field}`)?.focus(), 0);
    return false;
  };
  const openPreview = () => { if (fieldsAreValid()) setPreviewOpen(true); };

  /** Shared by publishing a new listing and saving edits to an existing one. */
  const builderFormIsValid = (): boolean => {
    try { validateDraftPublication({ ...form, imagePending: form.imagePending && jobImageFiles.length === 0 }); } catch (reason) { setError(reason instanceof Error ? reason.message : "Granska annonsen."); return false; }
    if (!form.title.trim()) { setError("Fyll i en jobbtitel."); return false; }
    if (!form.employmentType) { setError("Välj en anställningsform."); return false; }
    if (!form.description.trim()) { setError("Skriv en beskrivning av jobbet."); return false; }
    if (!form.city.trim()) { setError("Fyll i vilken stad jobbet finns i."); return false; }
    if (!form.address.trim()) { setError("Fyll i arbetsplatsens gatuadress."); return false; }
    if (!form.postalCode.trim()) { setError("Fyll i arbetsplatsens postnummer."); return false; }
    try { validateJobWorkplaces(formWorkplaces(form)); } catch (reason) { setError(reason instanceof Error ? reason.message : "Kontrollera arbetsplatserna."); return false; }
    if (!fieldsAreValid()) return false;
    if (generatingAi) { setError("Vänta tills AI-förslaget är klart innan du sparar."); return false; }
    // A new last application day may not have passed; an edited listing keeps whatever it already had.
    const practical = firstPracticalError(practicalErrors(form.practical, editing ? undefined : localIsoDate()));
    if (practical) { setPracticalShowAll(true); setError(practical.message); if (builderStep !== 3) setBuilderStep(3); window.setTimeout(() => document.getElementById(`job-practical-${practical.field}`)?.focus(), 0); return false; }
    return true;
  };

  const handleSaveJobEdit = async (e: { preventDefault(): void }) => {
    e.preventDefault();
    const job = jobEdit.job;
    if (busy || !job || !user || !builderFormIsValid()) return;
    setBusy(true);
    setError("");
    let imageUrls = form.imageUrls;
    let listingChanged = false;
    try {
      imageUrls = jobImageFiles.length > 0 ? await Promise.all(jobImageFiles.map((file) => uploadJobImage(file))) : form.imageUrls;
      const updates = jobEditUpdates(jobEdit.baseline, form, imageUrls);
      listingChanged = Object.keys(updates).length > 0;
      const savedJob = listingChanged ? await updateJob(job.id, updates) : job;
      const criteriaChanged = jobEditCriteriaChanged(jobEdit.baseline, form);
      if (criteriaChanged) {
        try {
          // The version check rejects the save if the criteria changed elsewhere since the editor opened.
          await saveJobMatchProfile(jobEditCriteria(form, job.id), jobEdit.criteria?.profile_version ?? null);
        } catch (reason) {
          jobEdit.rebase(savedJob, withSavedPublicFields(jobEdit.baseline, form, imageUrls));
          await loadData(user.id);
          setError(`${listingChanged ? "Annonsen är sparad, men matchkriterierna" : "Matchkriterierna"} kunde inte sparas: ${reason instanceof Error ? reason.message : "försök igen."}`);
          return;
        }
      }
      await loadData(user.id);
      setEditReceipt(jobEditReceipt(listingChanged, criteriaChanged));
      window.history.pushState(null, "", COMPANY_ROUTES.listings);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Kunde inte spara ändringarna. Annonsen är oförändrad.");
    } finally {
      setBusy(false);
    }
  };

  const handleCreateJob = async (e: FormEvent) => {
    e.preventDefault();
    if (busy || copyingJob || !draftHydrated || !builderFormIsValid()) return;
    setBusy(true);
    setError("");
    try {
      const imageUrls = jobImageFiles.length > 0
        ? await Promise.all(jobImageFiles.map((file) => uploadJobImage(file)))
        : form.imageUrls;
      const job = await createJob({
        workplaces: formWorkplaces(form),
        title: form.title,
        city: form.city,
        address: form.address,
        postal_code: form.postalCode,
        category: form.category,
        job_category_ids: draftJobCategories(form),
        job_category_manual: form.categoryManual,
        employment_type: form.employmentType,
        description: form.description,
        salary_per_hour: draftSalary(form),
        requirements: form.listingRequirements ?? form.requirements,
        benefits: form.benefits,
        company_name: companyProfile?.company_name || user?.email || "Företag",
        image_url: imageUrls.join(","),
        min_age: form.minAge ? parseInt(form.minAge, 10) : null,
        max_age: form.maxAge ? parseInt(form.maxAge, 10) : null,
        practical_details: practicalPayload(form.practical),
      });
      let matchProfileWarning = "";
      try {
        await createInitialJobMatchProfile({
          jobId: job.id,
          roleSummary: form.matchRoleSummary.trim() || form.description,
          mustHaves: textListItems(form.requirements),
          trainableRequirements: textListItems(form.trainableRequirements),
          topTraits: textListItems(form.topTraits).slice(0, 5),
          candidateQuestions: form.candidateQuestions,
          aiGenerated: form.aiGenerated,
        });
      } catch {
        // The listing is already published at this point. Do not make a retry
        // create a duplicate listing; flag only the profile for later repair.
        matchProfileWarning = "Annonsen skapades, men matchprofilen behöver kompletteras senare.";
      }
      setAiReview(null);
      try { await jobDraft.clear(); }
      catch { matchProfileWarning = [matchProfileWarning, "Annonsen skapades, men det lokala utkastet kunde inte tas bort. Publicera inte samma utkast igen."].filter(Boolean).join(" "); }
      if (user) await loadData(user.id);
      window.history.replaceState(null, "", createdCompanyJobHref(job.id));
      if (matchProfileWarning) setError(matchProfileWarning);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Kunde inte skapa annonsen.");
    } finally {
      setBusy(false);
    }
  };

  const moveToBuilderStep = (nextStep: 1 | 2 | 3) => {
    if (nextStep > builderStep) {
      if (builderStep === 1) {
        if (!form.title.trim()) { setError("Fyll i en jobbtitel innan du går vidare."); return; }
        if (!form.description.trim()) { setError("Beskriv jobbet innan du går vidare."); return; }
        if (!form.employmentType) { setError("Välj en anställningsform innan du går vidare."); return; }
        if (!fieldsAreValid(["minAge", "maxAge"])) return;
      }
      if (builderStep === 2 && nextStep === 3 && textListItems(form.topTraits).length > 5) {
        setError("Välj högst fem viktiga egenskaper.");
        return;
      }
    }
    setError("");
    if (nextStep === 3) {
      const prefilled = prefillCompanyCity(form, companyProfile?.city, editing);
      if (prefilled !== form) { setForm(current => prefillCompanyCity(current, companyProfile?.city, editing)); setCityPrefill(prefilled.city); }
    }
    setBuilderStep(nextStep);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const toggleTrait = (trait: string) => {
    const selected = textListItems(form.topTraits);
    if (!selected.includes(trait) && selected.length >= 5) {
      setError("Välj högst fem viktiga egenskaper.");
      return;
    }
    setError("");
    setForm((current) => ({ ...current, topTraits: toggleTextList(current.topTraits, trait) }));
  };

  const handleJobStatus = async (job: JobPost, status: "active" | "paused" | "closed") => {
    setJobActionId(job.id);
    setError("");
    try {
      await updateJob(job.id, { status });
      if (user) await loadData(user.id);
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "Kunde inte uppdatera annonsen.");
    } finally {
      setJobActionId(null);
    }
  };

  const handleDeleteJob = async (job: JobPost) => {
    if (!window.confirm(`Ta bort annonsen "${job.title}"?`)) return;
    setJobActionId(job.id);
    setError("");
    try {
      await deleteJob(job.id);
      if (user) await loadData(user.id);
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "Kunde inte ta bort annonsen.");
    } finally {
      setJobActionId(null);
    }
  };

  const handleSaveDraft = async () => {
    if (busy || !draftHydrated) return;
    try { await jobDraft.saveNow(); } catch { /* The draft panel reports the exact storage failure. */ }
  };

  const aiSession = editing ? `edit:${jobEdit.job?.id ?? ""}` : `create:${form.copiedFromTitle}`;
  const shownAiReview = aiReview?.session === aiSession ? aiReview.review : null;
  const addSuggestedRequirement = (item: string) => {
    setForm(current => ({ ...current, requirements: addMustHave(current.requirements, item), listingRequirements: addMustHave(current.listingRequirements ?? current.requirements, item) }));
    setAiReview(current => current && { ...current, review: { ...current.review, suggestedMustHaves: current.review.suggestedMustHaves.filter(entry => entry !== item) } });
  };

  const handleAiGenerate = async () => {
    if (!form.title.trim()) {
      setError("Skriv en jobbtitel först.");
      return;
    }
    if (generatingAi || busy) return;
    setGeneratingAi(true);
    setError("");
    setAiMessage("");
    try {
      const response = await fetch("/api/company/job/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(await authenticatedHeaders()) },
        body: JSON.stringify({
          title: form.title,
          industry: companyProfile?.industry ?? "",
          description: form.description,
          category: form.category,
          employmentType: form.employmentType,
          requirements: form.listingRequirements ?? form.requirements,
          trainableRequirements: form.trainableRequirements,
          topTraits: form.topTraits,
          benefits: form.benefits,
        }),
      });
      const data = (await response.json()) as AiJobSuggestion & { error?: string };
      if (!response.ok) throw new Error(data.error || "Kunde inte skapa annonsen.");
      // Computed from the form the request was built from; only changed fields are merged.
      const { patch, review } = applyAiJobSuggestion(form, data);
      setForm((previous) => ({ ...previous, ...patch }));
      setAiReview({ session: aiSession, review });
      setAiMessage(data.source === "ai" ? "AI-förslaget är klart. Granska texten nu och matchprofilen i nästa steg." : "Ett grundförslag är klart. Granska texten och matchprofilen innan publicering.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Kunde inte skapa annonsen.");
    } finally {
      setGeneratingAi(false);
    }
  };

  const useCroppedJobImage = (file: File) => {
    setForm(current => ({ ...current, imagePending: true }));
    setJobImageFiles([file]);
    setImageToCrop(null);
  };

  if (status !== "ready") return <AuthGateMessage status={status} error={sessionError} />;

  if (!hasCompanyAccess) {
    return (
      <main className="mobile-shell company-access-denied">
        <div className="card company-access-card">
          <p>Den här sidan är för företagskonton.</p>
        </div>
      </main>
    );
  }

  if (dataOwnerId !== user?.id) return <main className="mobile-shell mnw-company-workspace">
      {user && <CompanyRecruitmentStatus userId={user.id} />}
      {closingJob && <CloseRecruitmentDialog jobId={closingJob.id} title={closingJob.title} onClose={() => setClosingJob(null)} onSaved={async () => {if (user) await loadData(user.id);}} />}<section className="card company-applicants-empty">
    {error ? <><h1>Företagsvyn kunde inte hämtas</h1><p role="alert">{error}</p><button type="button" className="secondary-btn" onClick={() => user && void loadData(user.id)}>Försök igen</button></> : <p role="status">Hämtar företagets annonser och ansökningar…</p>}
  </section></main>;

  const verificationStatus = companyProfile?.verification_status;
  const publication = jobPublicationAction(verificationStatus);
  const createdJob = jobs.find(job => job.id === searchParams.get("created") && job.company_user_id === user?.id);

  return (
    <main className="mobile-shell mnw-company-workspace">
      {user && <CompanyRecruitmentStatus userId={user.id} />}
      {closingJob && <CloseRecruitmentDialog jobId={closingJob.id} title={closingJob.title} onClose={() => setClosingJob(null)} onSaved={async () => {if (user) await loadData(user.id);}} />}
      <datalist id="company-job-title-suggestions">{JOB_TITLE_SUGGESTIONS.map((suggestion) => <option key={suggestion} value={suggestion} />)}</datalist>
      <datalist id="company-city-suggestions">{CITY_SUGGESTIONS.map((suggestion) => <option key={suggestion} value={suggestion} />)}</datalist>
      <datalist id="company-address-suggestions">{ADDRESS_SUGGESTIONS.map((suggestion) => <option key={suggestion} value={suggestion} />)}</datalist>
      {verificationStatus !== "verified" && <CompanyVerificationStatus profile={companyProfile} compact action={{ href: "/profile?tab=details", label: "Kontrollera företagsuppgifter" }} />}
      {tab === "annonser" && <header className="company-workspace-heading"><p>Er rekrytering</p><h1>Era jobbannonser</h1><span>Skapa möjligheter och hitta nästa person till ert team.</span></header>}
      {/* Tab bar */}
      {(tab === "annonser" || tab === "skapa" || editing) && <TabList id="company-workspace" label="Annonser" className="company-workspace-tabs" value={tab} items={[{ value: "annonser", label: <>Mina annonser <span>{jobs.length}</span></> }, { value: "skapa", label: <><UiIcon name="briefcase" width="17" />Ny annons</> }]} onChange={(item) => { if (editing && jobEdit.dirty && !window.confirm("Ändringarna i annonsen är inte sparade. Vill du lämna redigeringen?")) return; window.history.pushState(null, "", item === "skapa" ? COMPANY_ROUTES.create : COMPANY_ROUTES.listings); setError(""); setEditReceipt(""); }} />}

      {tab === "annonser" && createdJob && <JobPublicationNotice job={createdJob}/>}
      {tab === "annonser" && editReceipt && <section className="card job-publication-notice" role="status"><strong>Annonsen är uppdaterad</strong><p>{editReceipt}</p></section>}
      {editing && jobEdit.error && <section className="card company-applicants-empty"><h1>Annonsen kunde inte öppnas</h1><p role="alert">{jobEdit.error}</p><button type="button" className="secondary-btn" onClick={jobEdit.retry}>Försök igen</button></section>}
      {editing && !jobEdit.error && !builderHydrated && <p role="status">Öppnar annonsen för redigering…</p>}
      {error && (
        <div className="company-error-banner">
          {error}
        </div>
      )}

      {/* ── KANDIDATER TAB ── */}
      {tab === "kandidater" && user && <CompanyJobCandidates userId={user.id} jobs={jobs} verified={verificationStatus === "verified"} jobId={searchParams.get("job")} candidateId={searchParams.get("candidate")} />}

      {/* ── NY ANNONS TAB ── */}
      {tab === "skapa" && !draftHydrated && <p role="status">Öppnar ditt annonsutkast…</p>}
      {(tab === "annonser" || tab === "skapa") && jobDraft.error && <p className="job-copy-notice" role="alert">{jobDraft.error} Dina ändringar är inte bekräftat sparade; behåll sidan öppen och försök igen.</p>}
      {(tab === "skapa" || editing) && builderHydrated && (
        <form
          {...(tab === "skapa" ? tabPanelProps("company-workspace", "skapa") : {})}
          className="job-builder job-builder-onboarding"
          onSubmit={(event) => {
            if (builderStep < 3) {
              event.preventDefault();
              moveToBuilderStep((builderStep + 1) as 2 | 3);
              return;
            }
            void (editing ? handleSaveJobEdit(event) : handleCreateJob(event));
          }}
        >
          {(() => {
            const salaryPeriod = form.salaryType === "timlön" ? "tim" : form.salaryType === "månadslön" ? "mån" : "period";
            const salaryTransfer = form.salaryText ? parseSalaryText(form.salaryText) : null;
            const salary = draftSalary(form) || "Lön ej angiven";
            const steps = [
              { number: 1 as const, label: "Jobbet", description: "Roll och arbetsuppgifter" },
              { number: 2 as const, label: "Matchning", description: "Vem ni söker" },
              { number: 3 as const, label: "Detaljer", description: "Lön, plats och bild" },
            ];
            return <>
              <header className="job-builder-heading">
                <div><p><BrandLogo/></p><h1>{editing ? "Redigera annons" : form.copiedFromTitle ? "Granska din annonskopia" : "Skapa jobbannons"}</h1><span>{editing ? "Gå direkt till det steg du vill ändra och spara när du är klar. Annonsen behåller sin status, sina ansökningar och sina chattar." : "Tre korta steg. Ni behåller kontrollen, medan MatchnWork använder svaren för att skapa rätt matchning."}</span></div>
              </header>
              <nav className="job-builder-steps" aria-label={editing ? "Delar av annonsen" : "Steg i annonsskapandet"}>
                {steps.map((step) => (
                  <button
                    key={step.number}
                    type="button"
                    className={builderStep === step.number ? "is-current" : builderStep > step.number ? "is-complete" : ""}
                    onClick={() => { if (editing || step.number <= builderStep) moveToBuilderStep(step.number); }}
                    disabled={!editing && step.number > builderStep}
                    aria-current={builderStep === step.number ? "step" : undefined}
                  >
                    <span>{builderStep > step.number ? "✓" : step.number}</span>
                    <div><strong>{step.label}</strong><small>{step.description}</small></div>
                  </button>
                ))}
              </nav>
              <div className="job-builder-layout">
                <div className="job-builder-form">
                  {editing && jobEdit.job && <section className="job-copy-notice" role="status"><strong>Du redigerar {jobEdit.job.title}</strong><p>{jobEditVisibility(jobEdit.job)}</p><ul>{JOB_EDIT_CONSEQUENCES.map(item => <li key={item}>{item}</li>)}</ul><p>Osparade ändringar sparas inte som utkast. Ditt eget annonsutkast påverkas inte.</p></section>}
                  {form.copiedFromTitle && <section className="job-copy-notice" role="status"><strong>Kopia av {form.copiedFromTitle}</strong><p>Detta är ett nytt utkast. Originalets ansökningar, chattar och statistik följer inte med. Kontrollera datum, lön och övriga villkor innan du publicerar.</p></section>}
                  {shownAiReview && <JobAiReviewPanel review={shownAiReview} onAddRequirement={addSuggestedRequirement} onClose={() => setAiReview(null)} />}
                  {builderStep === 1 && (
                    <section className="card job-builder-section job-builder-step-panel">
                      <div className="job-builder-section-title">
                        <div><p className="job-builder-eyebrow">Steg 1 av 3</p><h2>Berätta om jobbet</h2><p className="job-builder-help">Visas i annonsen. Beskriv arbetsuppgifter, villkor och viktiga krav som den sökande behöver känna till. Ni kan låta AI formulera ett första förslag och sedan granska texten.</p></div>
                        <button type="button" onClick={() => void handleAiGenerate()} disabled={generatingAi || busy} className="job-builder-ai">{generatingAi ? "AI bygger förslag..." : "✦ Skapa annons + matchning med AI"}</button>
                      </div>
                      {aiMessage && <p role="status" className="job-builder-ai-message">✓ {aiMessage}</p>}
                      <label className="job-builder-title-field">Arbetstitel *<input className="input-field" placeholder="T.ex. Butikssäljare" list="company-job-title-suggestions" value={form.title} onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))} required /></label>
                      <label htmlFor="job-builder-description" className="job-builder-label job-builder-description-label">Beskriv jobbet, vem ni söker och vad ni erbjuder *</label>
                      <textarea id="job-builder-description" rows={7} className="job-builder-textarea" placeholder="T.ex. Vi söker en social och punktlig person som kan arbeta helger i vår butik. Erfarenhet är inget krav eftersom vi lär upp på plats..." value={form.description} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} required />
                      <label>Krav i annonsen<textarea className="job-builder-textarea" rows={3} value={form.listingRequirements ?? form.requirements} onChange={event => setForm(current => ({ ...current, listingRequirements: event.target.value }))}/><small>Visas i annonsen. Skriv konkreta krav, till exempel körkort eller nödvändiga arbetstider. Avgörande villkor ska framgå här eller i beskrivningen.</small></label>
                      <div className="job-builder-age"><span>Åldersspann <em>(valfritt)</em></span><div><label>Ålder från<input className="input-field" inputMode="numeric" maxLength={2} placeholder="T.ex. 16" value={form.minAge} onChange={(e) => setForm((p) => ({ ...p, minAge: e.target.value }))} {...fieldProps("minAge")} /></label><b>—</b><label>Ålder till<input className="input-field" inputMode="numeric" maxLength={2} placeholder="T.ex. 19" value={form.maxAge} onChange={(e) => setForm((p) => ({ ...p, maxAge: e.target.value }))} {...fieldProps("maxAge")} /></label></div>{(["minAge", "maxAge"] as const).map(field => fieldError(field) && <p key={field} id={`job-field-${field}-error`} className="job-builder-field-error" role="alert">{fieldError(field)}</p>)}</div>
                      <JobCategoryField title={form.title} description={form.description} legacyCategory={form.category} value={draftJobCategories(form)} manual={form.categoryManual} disabled={busy||generatingAi} onChange={(categoryIds,categoryManual)=>setForm(current=>({...current,categoryIds,categoryManual}))}/>
                      <p id="job-employment-type-label" className="job-builder-label company-builder-spaced">Anställningsform *</p>
                      <div className="job-builder-chips" role="group" aria-labelledby="job-employment-type-label">{EMPLOYMENT_TYPES.map((type) => <button key={type} type="button" aria-pressed={form.employmentType === type} onClick={() => setForm((p) => ({ ...p, employmentType: p.employmentType === type ? "" : type }))} className={`chip ${form.employmentType === type ? "job-builder-chip-selected" : ""}`}>{type}</button>)}</div><label>Anställningsform – välj ovan eller skriv eget<input className="input-field" maxLength={80} value={form.employmentType} onChange={event=>setForm(current=>({...current,employmentType:event.target.value}))} placeholder="Egen anställningsform"/></label>
                    </section>
                  )}

                  {builderStep === 2 && (
                    <section className="card job-builder-section job-builder-step-panel">
                      <p className="job-builder-eyebrow">Steg 2 av 3</p>
                      <h2>Vem passar för jobbet?</h2>
                      <p className="job-builder-help">Används som internt bedömningsstöd. Den exakta kriterielistan visas inte för den sökande. Viktiga behörighetskrav och avgörande villkor ska också framgå i annonsen i steg 1. Företagets sparade kultur och värderingar läggs till automatiskt.</p>
                      <div className="job-builder-match-note"><div><strong>Er företagsprofil återanvänds</strong><p>Ni behöver bara ange vad som är särskilt för den här rollen.</p></div><button type="button" onClick={() => setShowMatchProfileEditor(true)}>Granska grundprofil →</button></div>
                      <label className="job-builder-label">Rollbeskrivning för matchning<textarea className="job-builder-textarea" rows={4} maxLength={2000} value={form.matchRoleSummary || form.description} onChange={event => setForm(current => ({ ...current, matchRoleSummary: event.target.value }))}/></label>
                      <div className="job-builder-tags">
                        <div><h3 id="job-requirements-label">Absoluta krav <span>(valfritt)</span></h3><p className="job-builder-field-help">Ange bara sådant kandidaten måste uppfylla från start.</p><div className="job-builder-chips" role="group" aria-labelledby="job-requirements-label">{[...new Set([...REQUIREMENT_TIPS, ...textListItems(form.requirements)])].map((tip) => { const selected = textListItems(form.requirements).includes(tip); return <button key={tip} type="button" aria-pressed={selected} onClick={() => setForm((p) => ({ ...p, requirements: toggleTextList(p.requirements, tip) }))} className={`chip ${selected ? "job-builder-chip-selected" : ""}`}>{tip}</button>; })}<button type="button" className="chip" onClick={() => setShowCustomRequirement((visible) => !visible)}>+ Eget krav</button></div>{showCustomRequirement && <div className="job-builder-custom"><input aria-label="Eget krav" className="input-field" placeholder="Skriv eget krav" value={customRequirement} onChange={(e) => setCustomRequirement(e.target.value)} /><button type="button" className="secondary-btn" onClick={() => { if (customRequirement.trim()) { setForm((p) => ({ ...p, requirements: toggleTextList(p.requirements, customRequirement.trim()) })); setCustomRequirement(""); setShowCustomRequirement(false); } }}>Lägg till</button></div>}</div>
                        <div><h3 id="job-traits-label">Viktigaste egenskaperna <span>(välj högst 5)</span></h3><div className="job-builder-chips" role="group" aria-labelledby="job-traits-label">{[...new Set([...TRAIT_TIPS, ...textListItems(form.topTraits)])].map((tip) => { const selected = textListItems(form.topTraits).includes(tip); return <button key={tip} type="button" aria-pressed={selected} onClick={() => toggleTrait(tip)} className={`chip ${selected ? "job-builder-chip-selected" : ""}`}>{tip}</button>; })}</div></div>
                      </div>
                      <div className="job-builder-fields company-builder-spaced">
                        <label>Vad kan personen lära sig på plats?<textarea className="input-field" rows={3} placeholder="T.ex. kassasystem, produktkunskap, rutiner" value={form.trainableRequirements} onChange={(e) => setForm((p) => ({ ...p, trainableRequirements: e.target.value }))} /></label>
                      </div>
                      {form.candidateQuestions.length > 0 && <div className="job-builder-ai-questions"><div><strong>Kompletteringsfrågor vid behov</strong><p>Granska förslagen. Frågorna visas som frivillig komplettering efter att ansökan skickats. Alla frågor är valfria.</p></div>{form.candidateQuestions.map((question, index) => <label key={index}>Fråga {index + 1}<div><input className="input-field" value={question} onChange={(event) => setForm((current) => ({ ...current, candidateQuestions: current.candidateQuestions.map((item, itemIndex) => itemIndex === index ? event.target.value : item) }))} /><button type="button" aria-label={`Ta bort fråga ${index + 1}`} onClick={() => setForm((current) => ({ ...current, candidateQuestions: current.candidateQuestions.filter((_, itemIndex) => itemIndex !== index) }))}>×</button></div></label>)}</div>}
                    </section>
                  )}

                  {builderStep === 3 && (<>
                    <section className="card job-builder-section job-builder-step-panel">
                      <p className="job-builder-eyebrow">Steg 3 av 3</p><h2>Plats och praktiska detaljer</h2><p className="job-builder-help">Slutför annonsen. Lön, förmåner och bild är valfria men gör annonsen mer attraktiv.</p>
                      <p className="job-builder-help">Du behöver inte bestämma hur många du vill anställa. Pausa eller avsluta annonsen när du är klar med rekryteringen.</p>
                      <JobWorkplaceFields value={formWorkplaces(form)} disabled={busy} onChange={workplaces => setForm(current => ({ ...current, workplaces, address: workplaces[0].address, postalCode: workplaces[0].postal_code, city: workplaces[0].city }))}/>
                      {cityPrefill && formWorkplaces(form)[0].city === cityPrefill && <p className="job-builder-help" role="status">Orten är hämtad från er företagsprofil. Ändra den om jobbet finns någon annanstans.</p>}
                    </section>
                    <JobPracticalFields value={form.practical} onChange={practical => setForm(current => ({ ...current, practical }))} today={editing ? undefined : localIsoDate()} showAll={practicalShowAll} disabled={busy} />
                    <section className="card job-builder-section"><h2>Lön <span className="job-builder-optional">Valfritt</span></h2>{form.salaryText && <label>Kopierad löneuppgift<input className="input-field" value={form.salaryText} onChange={event => setForm(current => ({ ...current, salaryText: event.target.value }))}/><small>Redigera texten här, eller fyll i beloppsfälten nedan för att ersätta den.</small></label>}{form.salaryText && (salaryTransfer ? <div className="job-builder-transfer"><span>Texten anger {draftSalary({ ...form, ...salaryTransfer, salaryText: "" })}.</span><button type="button" className="secondary-btn" onClick={() => setForm(current => ({ ...current, ...salaryTransfer, salaryText: "" }))}>Fyll i lönefälten</button></div> : <p className="job-builder-help">Texten saknar ett tydligt belopp med enhet och kan inte fyllas i automatiskt.</p>)}<div className="job-builder-info">✦ Annonser med angiven lön får ofta fler ansökningar.</div><label className="job-builder-label">Lönetyp</label><div className="job-builder-chips">{(["timlön", "månadslön", "fast lön"] as const).map((type) => <button key={type} type="button" onClick={() => setForm((p) => ({ ...p, salaryType: type, salaryText: "" }))} className={`chip ${form.salaryType === type ? "job-builder-chip-selected" : ""}`}>{type}</button>)}</div><div className="job-builder-salary"><label>Lön från<input className="input-field" inputMode="numeric" placeholder="T.ex. 120" value={form.salaryFrom} onChange={(e) => setForm((p) => ({ ...p, salaryFrom: e.target.value, salaryText: "" }))} {...fieldProps("salaryFrom")} /></label><span>—</span><label>Lön till<input className="input-field" inputMode="numeric" placeholder="T.ex. 145" value={form.salaryTo} onChange={(e) => setForm((p) => ({ ...p, salaryTo: e.target.value, salaryText: "" }))} {...fieldProps("salaryTo")} /></label><em>kr/{salaryPeriod}</em></div>{(["salaryFrom", "salaryTo"] as const).map(field => fieldError(field) && <p key={field} id={`job-field-${field}-error`} className="job-builder-field-error" role="alert">{fieldError(field)}</p>)}</section>
                    <section className="card job-builder-section"><h2 id="job-benefits-label">Förmåner <span className="job-builder-optional">Valfritt</span></h2><p className="job-builder-help">Visa vad kandidaten får utöver själva jobbet.</p><div className="job-builder-chips" role="group" aria-labelledby="job-benefits-label">{BENEFIT_TIPS.map((tip) => { const selected = textListItems(form.benefits).includes(tip); return <button key={tip} type="button" aria-pressed={selected} onClick={() => setForm((p) => ({ ...p, benefits: toggleTextList(p.benefits, tip) }))} className={`chip ${selected ? "job-builder-chip-selected" : ""}`}>{tip}</button>; })}<button type="button" className="chip" onClick={() => setShowCustomBenefit((visible) => !visible)}>+ Egen förmån</button></div>{showCustomBenefit && <div className="job-builder-custom"><input className="input-field" placeholder="Skriv egen förmån" value={customBenefit} onChange={(e) => setCustomBenefit(e.target.value)} /><button type="button" className="secondary-btn" onClick={() => { if (customBenefit.trim()) { setForm((p) => ({ ...p, benefits: toggleTextList(p.benefits, customBenefit.trim()) })); setCustomBenefit(""); setShowCustomBenefit(false); } }}>Lägg till</button></div>}</section>
                    <section className="card job-builder-section"><h2>Omslagsbild <span className="job-builder-optional">Valfritt</span></h2><p className="job-builder-help">Välj en bild och beskär den för annonsformatet.</p><label className="job-builder-dropzone"><input type="file" accept=".jpg,.jpeg,.png,.webp" onChange={(event) => { const file = event.target.files?.[0]; event.target.value = ""; if (file) setImageToCrop(file); }} />{(jobImageFiles.length ? jobImagePreviews : form.imageUrls).length ? <div className="job-builder-image-grid">{(jobImageFiles.length ? jobImagePreviews : form.imageUrls).map((preview, index) => <img key={preview} src={preview} alt={`Förhandsgranskning ${index + 1}`} />)}</div> : <><b>↑</b><strong>Lägg till omslagsbild</strong><span>JPG, PNG eller WEBP · beskärs till 4:3</span></>}</label></section>
                    {form.imagePending && jobImageFiles.length === 0 && <p className="job-copy-notice" role="alert">Den nya bilden behöver väljas igen efter omladdningen. Den sparade bilden visas tills dess.</p>}
                    {(form.imageUrls.length > 0 || jobImageFiles.length > 0 || form.imagePending) && <div className="job-copy-image-actions"><button type="button" className="secondary-btn" onClick={() => { setJobImageFiles([]); setForm(current => ({ ...current, imageUrls: [], imagePending: false })); }}>Ta bort bild</button>{form.imagePending && form.imageUrls.length > 0 && <button type="button" className="secondary-btn" onClick={() => { setJobImageFiles([]); setForm(current => ({ ...current, imagePending: false })); }}>Behåll den sparade bilden</button>}</div>}
                    {form.copiedFromTitle && <label className="job-copy-review"><input type="checkbox" checked={form.copyReviewed} onChange={event => setForm(current => ({ ...current, copyReviewed: event.target.checked }))}/><span>Jag har kontrollerat datum, lön och övriga villkor för den nya annonsen.</span></label>}
                  </>)}
                </div>
                {previewOpen && <JobPreviewDialog form={{ ...form, requirements: form.listingRequirements ?? form.requirements }} image={jobImageFiles.length ? jobImagePreviews[0] : form.imageUrls[0]} companyName={companyProfile?.company_name || "Ditt företag"} salary={salary} verificationStatus={verificationStatus} editNote={editing && jobEdit.job ? `Förhandsvisningen visar dina ändringar. Inget sparas förrän du väljer Spara ändringar. ${jobEditVisibility(jobEdit.job)}` : undefined} onClose={() => setPreviewOpen(false)} />}
              </div>
              {builderStep === 3 && <p className="job-builder-help" role="status">{editing && jobEdit.job ? jobEditVisibility(jobEdit.job) : publication.description}</p>}
              {editing ? <div className="job-builder-actions">
                <span role="status">{jobEdit.dirty ? "Osparade ändringar" : "Inga ändringar ännu"}</span>
                <button type="button" className="job-builder-save" disabled={busy} onClick={() => { if (jobEdit.dirty && !window.confirm("Ändringarna i annonsen är inte sparade. Vill du avbryta redigeringen?")) return; setError(""); window.history.pushState(null, "", COMPANY_ROUTES.listings); }}>Avbryt</button>
                <button type="button" className="secondary-btn" onClick={openPreview}>Förhandsvisa</button>
                {builderStep < 3 && <button type="submit" className="secondary-btn">Nästa del</button>}
                <button type="button" className="cta-btn" disabled={busy} onClick={(event) => void handleSaveJobEdit(event)}>{busy ? "Sparar ändringar…" : "Spara ändringar"}</button>
              </div> : <div className="job-builder-actions">
                <span role="status">{jobDraft.saveStatus === "saving" ? "Sparar utkast…" : jobDraft.saveStatus === "saved" ? "Utkast sparat på den här enheten" : ""}</span>
                <button type="button" className="job-builder-save" disabled={!draftHydrated || busy} onClick={() => void handleSaveDraft()}>Spara utkast</button>
                {builderStep > 1 && <button type="button" className="secondary-btn" onClick={() => moveToBuilderStep((builderStep - 1) as 1 | 2)}>Tillbaka</button>}
                {builderStep < 3 ? <button type="submit" className="cta-btn">Fortsätt</button> : <><button type="button" className="secondary-btn" onClick={openPreview}>Förhandsvisa</button><button type="submit" className="cta-btn" disabled={busy}>{busy ? publication.busyLabel : publication.label}</button></>}
              </div>}
            </>;
          })()}
        </form>
      )}

      {/* ── ANNONSER TAB ── */}
      {tab === "annonser" && (
        <div {...tabPanelProps("company-workspace", "annonser")}>
          {!draftHydrated ? <p role="status">Öppnar annonsutkast…</p> : hasJobDraftContent(jobDraft.form) && <article className="card company-draft-card">
            <div><span className="chip">Utkast · inte publicerat</span><h2>{form.title.trim() || "Namnlöst annonsutkast"}</h2>
            <p>Steg {builderStep} av 3 · {builderStep === 1 ? "Berätta om jobbet" : builderStep === 2 ? "Matchningsunderlag" : "Plats och praktiska detaljer"}</p>
            <p role="status">{jobDraft.saveStatus === "saving" ? "Sparar ändringar…" : jobDraft.saveStatus === "error" ? "Senaste ändringarna kunde inte sparas" : jobDraft.savedAt ? `Senast sparat ${new Date(jobDraft.savedAt).toLocaleString("sv-SE")}` : "Tidigare textutkast – sparas när det öppnas"}</p>
            <small>Finns på den här enheten och i den här webbläsaren. Inget skickas till MatchnWork innan du väljer att spara inför publicering eller publicera annonsen.</small></div>
            <button type="button" className="cta-btn" onClick={() => window.history.pushState(null, "", COMPANY_ROUTES.create)}>Återuppta utkast</button>
          </article>}

          {jobs.length === 0 ? (
            <div className="card company-jobs-empty">
              <p>Inga annonser ännu</p>
              <button type="button" className="cta-btn" onClick={() => window.history.pushState(null, "", COMPANY_ROUTES.create)}>
                Skapa din första annons
              </button>
            </div>
          ) : (
            <div className="company-jobs-grid">
              {jobs.map((job) => {
                const agePart = job.min_age || job.max_age ? `${job.min_age ?? "?"}–${job.max_age ?? "?"} år` : null;
                const status = job.status ?? (job.is_active ? "active" : "paused");
                const isWorking = jobActionId === job.id;
                const publicState = jobPublicationState(job);
                const awaitingVerification = publicState === "waiting";
                return (
                  <article key={job.id} className="card job-list-card">
                    <Link className="company-job-summary" href={`/jobb/${job.id}`}>
                    <div className="company-job-heading"><span className="company-job-icon"><UiIcon name="briefcase" width="23" /></span><h2>{job.title}</h2></div>
                    <p className="company-job-meta">{[jobCities(job), effectiveJobCategories(job).map(categoryLabel).join(" / ") || job.category, agePart].filter(Boolean).join(" · ")}</p>
                    {job.employment_type && (
                      <div className="company-job-chips">
                        {job.employment_type.split(",").map((t) => (<span key={t} className="chip">{t.trim()}</span>))}
                      </div>
                    )}
                    <div className="company-job-status" data-state={awaitingVerification ? "waiting" : publicState === "published" ? "published" : "other"}>
                      {jobPublicationLabel(job)}
                    </div>
                    <span className="job-list-card-link">Visa hela annonsen →</span>
                    </Link>
                    <div className="company-job-actions">
                    {verificationStatus === "verified" && <Link className="secondary-btn" href={companyJobCandidatesHref(job.id)}>Visa ansökningar</Link>}
                      <button type="button" className="cta-btn" disabled={isWorking || busy} onClick={() => { setError(""); setEditReceipt(""); window.history.pushState(null, "", editCompanyJobHref(job.id)); window.scrollTo({ top: 0 }); }}>Redigera annons</button>
                      <button type="button" className="secondary-btn" disabled={isWorking || busy || copyBusy || !draftHydrated} onClick={() => { setCopyError(""); setCopyingJob(job); }}>Kopiera annons</button>
                      <button type="button" className="secondary-btn" disabled={isWorking} onClick={() => setEditingCategory(job)}>Redigera jobbtyp</button>
                      <button type="button" className="secondary-btn" disabled={isWorking} onClick={() => setEditingWorkplaces(job)}>Redigera arbetsplatser</button>
                      <button type="button" className="secondary-btn" disabled={isWorking} onClick={() => setEditingCriteria(job)}>Redigera matchkriterier</button>
                      {status !== "active" && <button type="button" className="secondary-btn" disabled={isWorking} onClick={() => void handleJobStatus(job, "active")}>Återaktivera</button>}
                      {status === "active" && <button type="button" className="secondary-btn" disabled={isWorking} onClick={() => void handleJobStatus(job, "paused")}>Pausa</button>}
                      {status !== "closed" && <button type="button" className="secondary-btn" disabled={isWorking} onClick={() => setClosingJob(job)}>Stäng rekrytering</button>}
                      <button type="button" className="company-job-delete" disabled={isWorking} onClick={() => void handleDeleteJob(job)}>{isWorking ? "Sparar..." : "Ta bort"}</button>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      )}
      {/* CV full-text modal */}
      {showMatchProfileEditor && user && (
        <ModalDialog label="Företagets matchprofil" onClose={() => setShowMatchProfileEditor(false)}>
          <div className="company-match-modal-content" onClick={(event) => event.stopPropagation()}>
            <button type="button" className="company-match-modal-close" onClick={() => setShowMatchProfileEditor(false)} aria-label="Stäng matchprofil">×</button>
            <CompanyMatchProfileForm userId={user.id} embedded />
          </div>
        </ModalDialog>
      )}
      {copyingJob && <ModalDialog label="Kopiera annons" busy={copyBusy} onClose={() => { if (!copyBusy) setCopyingJob(null); }} className="job-copy-dialog"><h2>Kopiera annons</h2><p>Skapa ett nytt redigerbart utkast från ”{copyingJob.title}”. Originalet och dess kandidater finns kvar.</p>{hasJobDraftContent(jobDraft.form) && <p className="job-copy-notice">Du har redan ett annonsutkast på den här enheten. Om du fortsätter ersätts det med kopian.</p>}{copyError && <p role="alert">{copyError}</p>}<div><button type="button" className="cta-btn" disabled={copyBusy} onClick={() => void handleCopyJob()}>{copyBusy ? "Kopierar…" : hasJobDraftContent(jobDraft.form) ? "Ersätt utkast med kopia" : "Skapa annonskopia"}</button><button type="button" className="secondary-btn" disabled={copyBusy} onClick={() => setCopyingJob(null)}>Avbryt</button></div></ModalDialog>}
      {editingCategory && <JobCategoryEditor key={editingCategory.id} job={editingCategory} onClose={()=>setEditingCategory(null)} onSaved={updated=>{setJobs(current=>current.map(job=>job.id===updated.id?updated:job));setEditingCategory(null);}}/>}
      {editingWorkplaces && <JobWorkplaceEditor key={editingWorkplaces.id} job={editingWorkplaces} onClose={() => setEditingWorkplaces(null)} onSaved={updated => { setJobs(current => current.map(job => job.id === updated.id ? updated : job)); setEditingWorkplaces(null); }}/>}
      {editingCriteria && <JobMatchProfileEditor key={editingCriteria.id} jobId={editingCriteria.id} title={editingCriteria.title} onClose={closeCriteria} onSaved={() => { setEditingCriteria(null); setError(""); }} />}
      {imageToCrop && <ImageCropDialog file={imageToCrop} onCancel={() => setImageToCrop(null)} onConfirm={useCroppedJobImage} />}
    </main>
  );
}

export default function CompanyPage() {
  return <Suspense fallback={<PageLoading label="Laddar..." />}><CompanyPageContent /></Suspense>;
}
