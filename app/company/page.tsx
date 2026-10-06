"use client";

import { FormEvent, Suspense, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useRequireAuth } from "@/hooks/use-require-auth";
import { AuthGateMessage } from "@/components/auth-gate-message";
import "./company-design.css";
import { JobPreviewDialog } from "@/components/job-preview-dialog";
import { ModalDialog } from "@/components/modal-dialog";
import { UiIcon } from "@/components/ui-icon";
import { CandidateAssessmentPanel } from "@/components/candidate-assessment-panel";
import { CompanyMatchProfileForm } from "@/components/company-match-profile-form";
import { JobMatchProfileEditor } from "@/components/job-match-profile-editor";
import { ImageCropDialog } from "@/components/image-crop-dialog";
import { getSupabaseClient } from "@/lib/supabase";
import { getCandidatesForJob, getCompanyJobs as getFeedCompanyJobs } from "@/lib/feeds";
import { getMessages, getMyConversations, sendMessage, subscribeToConversationMessages } from "@/lib/chat";
import { createJob, deleteJob, updateJob } from "@/lib/jobs";
import { reviewCandidate } from "@/lib/matching";
import { createInitialJobMatchProfile } from "@/lib/match-profiles";
import { uploadJobImage } from "@/lib/storage";
import { authenticatedHeaders } from "@/lib/api-client";
import { ADDRESS_SUGGESTIONS, CITY_SUGGESTIONS, JOB_TITLE_SUGGESTIONS } from "@/lib/form-suggestions";
import type { CandidateFeedItem, ChatMessage, CompanyProfile, ConversationSummary, JobPost, MatchRecord, SwipeDecision } from "@/lib/types";

const JOB_CATEGORIES = ["Café/restaurang", "Butik", "Barnomsorg", "Idrott", "Event", "Lager", "Leverans", "Kundtjänst", "Administration", "Handledare", "Sociala medier", "Övrigt"];
const EMPLOYMENT_TYPES = ["Deltid", "Heltid", "Sommarjobb", "Helgjobb", "Extra vid behov"];
const BENEFIT_TIPS = ["Flexibla tider", "Introduktion", "Personalrabatt", "Friskvårdsbidrag", "Måltid ingår"];
const REQUIREMENT_TIPS = ["Kan arbeta helger", "Tidigare erfarenhet", "B-körkort", "Svenska", "Kan börja omgående"];
const TRAIT_TIPS = ["Ansvarstagande", "Punktlig", "Social", "Noggrann", "Serviceinriktad", "Nyfiken", "Samarbetsvillig"];
const JOB_DRAFT_STORAGE_KEY = "employo-job-draft";

type CandidateCv =
  | { kind: "pdf"; url: string; expiresAt: string }
  | { kind: "text"; text: string };

function toggleTextList(value: string, item: string): string {
  const items = value.split(",").map((entry) => entry.trim()).filter(Boolean);
  return items.includes(item) ? items.filter((entry) => entry !== item).join(", ") : [...items, item].join(", ");
}

function textListItems(value: string): string[] {
  return value.split(/[,\n]+/).map((item) => item.trim()).filter(Boolean);
}

type Tab = "kandidater" | "skapa" | "annonser";

interface JobForm {
  title: string;
  city: string;
  address: string;
  postalCode: string;
  category: string;
  employmentType: string;
  minAge: string;
  maxAge: string;
  salaryFrom: string;
  salaryTo: string;
  salaryType: "timlön" | "månadslön" | "fast lön";
  description: string;
  benefits: string;
  requirements: string;
  trainableRequirements: string;
  topTraits: string;
  candidateQuestions: string[];
  aiGenerated: boolean;
}

const EMPTY_FORM: JobForm = {
  title: "",
  city: "",
  address: "",
  postalCode: "",
  category: "",
  employmentType: "",
  minAge: "",
  maxAge: "",
  salaryFrom: "",
  salaryTo: "",
  salaryType: "timlön",
  description: "",
  benefits: "",
  requirements: "",
  trainableRequirements: "",
  topTraits: "",
  candidateQuestions: [],
  aiGenerated: false,
};

function CompanyPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, profile, loading, status, error: sessionError } = useRequireAuth();
  const hasCompanyAccess = profile?.role === "company";

  const [tab, setTab] = useState<Tab>("kandidater");
  const [jobs, setJobs] = useState<JobPost[]>([]);
  const [feed, setFeed] = useState<CandidateFeedItem[]>([]);
  const [companyProfile, setCompanyProfile] = useState<CompanyProfile | null>(null);
  const [busy, setBusy] = useState(false);
  const [jobActionId, setJobActionId] = useState<string | null>(null);
  const [candidateActionKey, setCandidateActionKey] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [form, setForm] = useState<JobForm>(EMPTY_FORM);
  const [candidateSearch, setCandidateSearch] = useState("");
  const [candidateFilter, setCandidateFilter] = useState<"pending" | "all">("pending");
  const [selectedCandidateId, setSelectedCandidateId] = useState<string | null>(null);
  const [cvModalOpen, setCvModalOpen] = useState(false);
  const [candidateCv, setCandidateCv] = useState<(CandidateCv & { candidateKey: string }) | null>(null);
  const [uploadedCvError, setUploadedCvError] = useState("");
  const [openingUploadedCv, setOpeningUploadedCv] = useState(false);
  const [matchedConvId, setMatchedConvId] = useState<string | null>(null);
  const [feedIndex, setFeedIndex] = useState(0);
  const [candidateDragX, setCandidateDragX] = useState(0);
  const [candidateIsDragging, setCandidateIsDragging] = useState(false);
  const [candidateFlyDir, setCandidateFlyDir] = useState<"left" | "right" | null>(null);
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatDraft, setChatDraft] = useState("");
  const candidateStartXRef = useRef<number | null>(null);
  const candidateFlyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [jobImageFiles, setJobImageFiles] = useState<File[]>([]);
  const [jobImagePreviews, setJobImagePreviews] = useState<string[]>([]);
  const [imageToCrop, setImageToCrop] = useState<File | null>(null);
  const [draftSaved, setDraftSaved] = useState(false);
  const [generatingAi, setGeneratingAi] = useState(false);
  const [aiMessage, setAiMessage] = useState("");
  const [showCustomBenefit, setShowCustomBenefit] = useState(false);
  const [showCustomRequirement, setShowCustomRequirement] = useState(false);
  const [customBenefit, setCustomBenefit] = useState("");
  const [customRequirement, setCustomRequirement] = useState("");
  const [previewOpen, setPreviewOpen] = useState(false);
  const [builderStep, setBuilderStep] = useState<1 | 2 | 3>(1);
  const [draftHydrated, setDraftHydrated] = useState(false);
  const [showMatchProfileEditor, setShowMatchProfileEditor] = useState(false);
  const [editingCriteria, setEditingCriteria] = useState<JobPost | null>(null);
  const closeCriteria = useCallback(() => setEditingCriteria(null), []);
  const skipNextDraftSaveRef = useRef(false);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(JOB_DRAFT_STORAGE_KEY);
      if (!stored) return;
      const parsed = JSON.parse(stored) as Partial<JobForm> | { form?: Partial<JobForm>; builderStep?: number };
      const savedForm = "form" in parsed ? parsed.form : parsed;
      if (savedForm && typeof savedForm === "object") setForm({ ...EMPTY_FORM, ...savedForm });
      if ("builderStep" in parsed && (parsed.builderStep === 1 || parsed.builderStep === 2 || parsed.builderStep === 3)) setBuilderStep(parsed.builderStep);
    } catch {
      window.localStorage.removeItem(JOB_DRAFT_STORAGE_KEY);
    } finally {
      setDraftHydrated(true);
    }
  }, []);

  useEffect(() => {
    if (!draftHydrated) return;
    if (skipNextDraftSaveRef.current) { skipNextDraftSaveRef.current = false; return; }
    window.localStorage.setItem(JOB_DRAFT_STORAGE_KEY, JSON.stringify({ form, builderStep }));
  }, [builderStep, draftHydrated, form]);

  const loadData = async (userId: string) => {
    try {
      const supabase = getSupabaseClient();
      const [jobsData, { data: cp }] = await Promise.all([
        getFeedCompanyJobs(),
        supabase.from("company_profiles").select("*").eq("user_id", userId).maybeSingle(),
      ]);
      setJobs(jobsData);
      if (cp) {
        const nextCompanyProfile = cp as CompanyProfile;
        setCompanyProfile(nextCompanyProfile);
        if (nextCompanyProfile.verification_status === "verified") {
          const candidateGroups = await Promise.all(jobsData.map((job) => getCandidatesForJob(job.id, { includeReviewed: true })));
          setFeed(candidateGroups.flat());
        } else {
          // Unverified companies stay in their company workspace, but candidate
          // data and review actions remain unavailable until approval.
          setFeed([]);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Kunde inte ladda data.");
    }
  };

  useEffect(() => {
    if (!loading && user && profile?.role === "company") {
      void loadData(user.id);
    }
  }, [loading, user, profile?.role, router]);

  useEffect(() => {
    const requestedView = searchParams.get("view");
    const requestedJob = searchParams.get("job"), requestedCandidate = searchParams.get("candidate");
    if (requestedJob && requestedCandidate) { setSelectedCandidateId(`${requestedJob}:${requestedCandidate}`); setCandidateCv(null); setUploadedCvError(""); setCandidateSearch(""); setCandidateFilter("all"); }
    if (requestedView === "kandidater" || requestedView === "skapa" || requestedView === "annonser") {
      setTab(requestedView);
    } else if (requestedView === "swipe") {
      setTab(companyProfile?.verification_status === "verified" ? "kandidater" : "skapa");
    }
  }, [companyProfile?.verification_status, searchParams]);

  useEffect(() => {
    if (!user || profile?.role !== "company") return;
    void getMyConversations()
      .then(setConversations)
      .catch((loadError) => setError(loadError instanceof Error ? loadError.message : "Kunde inte ladda konversationer."));
  }, [profile?.role, user]);

  useEffect(() => {
    if (!activeConversationId) {
      setChatMessages([]);
      return;
    }
    void getMessages(activeConversationId)
      .then(setChatMessages)
      .catch((loadError) => setError(loadError instanceof Error ? loadError.message : "Kunde inte ladda meddelanden."));
  }, [activeConversationId]);

  useEffect(() => {
    if (!activeConversationId) return;
    return subscribeToConversationMessages(activeConversationId, (message) => {
      setChatMessages((current) => current.some((item) => item.id === message.id) ? current : [...current, message]);
      void getMyConversations().then(setConversations).catch(() => undefined);
    });
  }, [activeConversationId]);

  const sendCompanyMessage = async (event: FormEvent) => {
    event.preventDefault();
    if (!activeConversationId || !chatDraft.trim()) return;
    const text = chatDraft.trim();
    setChatDraft("");
    try {
      await sendMessage(activeConversationId, text);
      setChatMessages(await getMessages(activeConversationId));
    } catch (sendError) {
      setChatDraft(text);
      setError(sendError instanceof Error ? sendError.message : "Kunde inte skicka meddelandet.");
    }
  };

  const triggerCandidateDecision = (decision: SwipeDecision) => {
    if (candidateFlyTimerRef.current) clearTimeout(candidateFlyTimerRef.current);
    setCandidateFlyDir(decision === "interested" ? "right" : "left");
    setCandidateIsDragging(false);
    setCandidateDragX(0);
    candidateStartXRef.current = null;
    candidateFlyTimerRef.current = setTimeout(() => void handleDecision(decision), 280);
  };

  const onCandidatePointerDown = (x: number) => {
    if (candidateFlyDir) return;
    candidateStartXRef.current = x;
    setCandidateIsDragging(true);
  };

  const onCandidatePointerMove = (x: number) => {
    if (!candidateIsDragging || candidateStartXRef.current === null) return;
    setCandidateDragX(x - candidateStartXRef.current);
  };

  const onCandidatePointerEnd = () => {
    if (candidateDragX > 90) {
      triggerCandidateDecision("interested");
    } else if (candidateDragX < -90) {
      triggerCandidateDecision("skip");
    } else {
      setCandidateIsDragging(false);
      setCandidateDragX(0);
      candidateStartXRef.current = null;
    }
  };

  const handleDecision = async (decision: SwipeDecision) => {
    const item = candidateFeed.filter((candidate) => !candidate.reviewDecision)[feedIndex];
    if (!item) return;
    try {
      const result: MatchRecord | null = await reviewCandidate(item.job.id, item.youthUserId, decision);
      setCandidateFlyDir(null);
      setCandidateDragX(0);
      setFeedIndex((i) => i + 1);
      setError("");
      if (decision === "interested" && result?.conversation_id) {
        setMatchedConvId(result.conversation_id);
      }
    } catch (err) {
      setCandidateFlyDir(null);
      setCandidateDragX(0);
      setError(err instanceof Error ? err.message : "Kunde inte spara beslut.");
    }
  };

  const handleApplicantDecision = async (candidate: CandidateFeedItem, decision: SwipeDecision) => {
    const actionKey = `${candidate.job.id}:${candidate.youthUserId}`;
    setCandidateActionKey(actionKey);
    setError("");
    try {
      const result = await reviewCandidate(candidate.job.id, candidate.youthUserId, decision);
      if (decision === "interested" && result?.conversation_id) {
        setMatchedConvId(result.conversation_id);
      }
      setSelectedCandidateId(null);
      if (user) await loadData(user.id);
      setConversations(await getMyConversations());
    } catch (decisionError) {
      setError(decisionError instanceof Error ? decisionError.message : "Kunde inte spara beslutet.");
    } finally {
      setCandidateActionKey(null);
    }
  };

  const openUploadedCv = async (candidate: CandidateFeedItem) => {
    setOpeningUploadedCv(true);
    setUploadedCvError("");
    setCandidateCv(null);
    try {
      const response = await fetch("/api/company/candidate-cv", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(await authenticatedHeaders()) },
        body: JSON.stringify({ jobId: candidate.job.id, youthUserId: candidate.youthUserId }),
      });
      const result = await response.json().catch(() => ({})) as { kind?: unknown; url?: unknown; expiresAt?: unknown; text?: unknown; error?: string };
      if (!response.ok || (result.kind !== "pdf" && result.kind !== "text")) throw new Error(result.error || "Kunde inte öppna CV:t just nu.");
      if (result.kind === "pdf" && typeof result.url === "string" && typeof result.expiresAt === "string") {
        setCandidateCv({ kind: "pdf", url: result.url, expiresAt: result.expiresAt, candidateKey: `${candidate.job.id}:${candidate.youthUserId}` });
      } else if (result.kind === "text" && typeof result.text === "string") {
        setCandidateCv({ kind: "text", text: result.text, candidateKey: `${candidate.job.id}:${candidate.youthUserId}` });
      } else {
        throw new Error("CV:t hade ett format som inte kunde visas.");
      }
    } catch (cvError) {
      setUploadedCvError(cvError instanceof Error ? cvError.message : "Kunde inte öppna CV:t just nu.");
    } finally {
      setOpeningUploadedCv(false);
    }
  };

  const handleCreateJob = async (e: FormEvent) => {
    e.preventDefault();
    if (!form.category) { setError("Välj en arbetskategori."); return; }
    if (!form.employmentType) { setError("Välj en anställningsform."); return; }
    if (!form.description.trim()) { setError("Skriv en beskrivning av jobbet."); return; }
    if (!form.city.trim()) { setError("Fyll i vilken stad jobbet finns i."); return; }
    if (!form.address.trim()) { setError("Fyll i arbetsplatsens gatuadress."); return; }
    if (!form.postalCode.trim()) { setError("Fyll i arbetsplatsens postnummer."); return; }
    if (generatingAi) { setError("Vänta tills AI-förslaget är klart innan publicering."); return; }
    setBusy(true);
    setError("");
    try {
      const imageUrls = jobImageFiles.length > 0
        ? await Promise.all(jobImageFiles.map((file) => uploadJobImage(file)))
        : [];
      const job = await createJob({
        title: form.title,
        city: form.city,
        address: form.address,
        postal_code: form.postalCode,
        category: form.category,
        employment_type: form.employmentType,
        description: form.description,
        salary_per_hour: form.salaryFrom || form.salaryTo ? `${form.salaryFrom || "?"}–${form.salaryTo || "?"} kr/${form.salaryType === "timlön" ? "tim" : form.salaryType === "månadslön" ? "mån" : "period"}` : "",
        requirements: form.requirements,
        benefits: form.benefits,
        company_name: companyProfile?.company_name || user?.email || "Företag",
        image_url: imageUrls.join(","),
        min_age: form.minAge ? parseInt(form.minAge, 10) : null,
        max_age: form.maxAge ? parseInt(form.maxAge, 10) : null,
      });
      let matchProfileWarning = "";
      try {
        await createInitialJobMatchProfile({
          jobId: job.id,
          roleSummary: form.description,
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
      skipNextDraftSaveRef.current = true;
      setForm(EMPTY_FORM);
      setBuilderStep(1);
      window.localStorage.removeItem(JOB_DRAFT_STORAGE_KEY);
      setJobImageFiles([]);
      setJobImagePreviews((previews) => { previews.forEach((preview) => URL.revokeObjectURL(preview)); return []; });
      if (user) await loadData(user.id);
      setTab("annonser");
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
        if (!form.category) { setError("Välj en arbetskategori innan du går vidare."); return; }
        if (!form.employmentType) { setError("Välj en anställningsform innan du går vidare."); return; }
      }
      if (builderStep === 2 && nextStep === 3 && textListItems(form.topTraits).length > 5) {
        setError("Välj högst fem viktiga egenskaper.");
        return;
      }
    }
    setError("");
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

  const handleSaveDraft = () => {
    window.localStorage.setItem(JOB_DRAFT_STORAGE_KEY, JSON.stringify({ form, builderStep }));
    setDraftSaved(true);
    window.setTimeout(() => setDraftSaved(false), 2500);
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
          requirements: form.requirements,
          trainableRequirements: form.trainableRequirements,
          topTraits: form.topTraits,
          benefits: form.benefits,
        }),
      });
      const data = (await response.json()) as {
        category?: string;
        employmentType?: string;
        description?: string;
        benefits?: string[];
        source?: "ai" | "fallback";
        matchProfile?: { roleSummary?: string; mustHaves?: string[]; trainableRequirements?: string[]; topTraits?: string[]; candidateQuestions?: string[] };
        error?: string;
      };
      if (!response.ok) throw new Error(data.error || "Kunde inte skapa annonsen.");
      setForm((previous) => ({
        ...previous,
        category: data.category || previous.category,
        employmentType: data.employmentType || previous.employmentType,
        description: data.description || previous.description,
        benefits: data.benefits?.join(", ") || previous.benefits,
        requirements: data.matchProfile?.mustHaves?.join(", ") || previous.requirements,
        trainableRequirements: data.matchProfile?.trainableRequirements?.join(", ") || previous.trainableRequirements,
        topTraits: data.matchProfile?.topTraits?.join(", ") || previous.topTraits,
        candidateQuestions: data.matchProfile?.candidateQuestions?.slice(0, 3) || previous.candidateQuestions,
        aiGenerated: data.source === "ai",
      }));
      setAiMessage(data.source === "ai" ? "AI-förslaget är klart. Granska texten nu och matchprofilen i nästa steg." : "Ett grundförslag är klart. Granska texten och matchprofilen innan publicering.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Kunde inte skapa annonsen.");
    } finally {
      setGeneratingAi(false);
    }
  };

  const useCroppedJobImage = (file: File) => {
    setJobImageFiles([file]);
    setJobImagePreviews((previews) => {
      previews.forEach((preview) => URL.revokeObjectURL(preview));
      return [URL.createObjectURL(file)];
    });
    setImageToCrop(null);
  };

  if (status !== "ready") return <AuthGateMessage status={status} error={sessionError} />;

  if (!hasCompanyAccess) {
    return (
      <main className="mobile-shell" style={{ paddingTop: "2rem" }}>
        <div className="card" style={{ padding: "1.25rem", textAlign: "center" }}>
          <p style={{ fontWeight: 700, color: "#111" }}>Den här sidan är för företagskonton.</p>
        </div>
      </main>
    );
  }

  const candidateFeed = feed;
  const verificationStatus = companyProfile?.verification_status ?? "pending";
  const pendingCandidates = candidateFeed.filter((candidate) => !candidate.reviewDecision);
  const displayedCandidates = candidateFilter === "pending" ? pendingCandidates : candidateFeed;
  const currentCandidate = pendingCandidates[feedIndex] ?? null;
  const candidateFlyX = candidateFlyDir === "right" ? 600 : candidateFlyDir === "left" ? -600 : candidateDragX;
  const candidateFlyRot = candidateFlyDir === "right" ? 12 : candidateFlyDir === "left" ? -12 : candidateDragX * 0.02;
  const candidateJaOpacity = candidateFlyDir === "right" ? 1 : candidateDragX > 20 ? Math.min(candidateDragX / 100, 1) : 0;
  const candidateNejOpacity = candidateFlyDir === "left" ? 1 : candidateDragX < -20 ? Math.min(-candidateDragX / 100, 1) : 0;
  const selectedCandidate = displayedCandidates.find((candidate) => `${candidate.job.id}:${candidate.youthUserId}` === selectedCandidateId) ?? (selectedCandidateId ? null : displayedCandidates[0] ?? null);

  return (
    <main className="mobile-shell mnw-company-workspace">
      <datalist id="company-job-title-suggestions">{JOB_TITLE_SUGGESTIONS.map((suggestion) => <option key={suggestion} value={suggestion} />)}</datalist>
      <datalist id="company-city-suggestions">{CITY_SUGGESTIONS.map((suggestion) => <option key={suggestion} value={suggestion} />)}</datalist>
      <datalist id="company-address-suggestions">{ADDRESS_SUGGESTIONS.map((suggestion) => <option key={suggestion} value={suggestion} />)}</datalist>
      {verificationStatus !== "verified" && (
        <section className="card" style={{ padding: "1rem", marginBottom: "1rem", borderColor: verificationStatus === "rejected" ? "#ffd6d3" : "#f0c36d", background: verificationStatus === "rejected" ? "#fff1f0" : "#fffaf0" }} role="status">
          <strong style={{ color: verificationStatus === "rejected" ? "#b42318" : "#6a4a00" }}>
            {verificationStatus === "rejected" ? "Verifieringen behöver kompletteras" : "Företagsverifiering pågår"}
          </strong>
          <p style={{ margin: ".35rem 0 0", color: verificationStatus === "rejected" ? "#b42318" : "#6a4a00", fontSize: ".86rem", lineHeight: 1.5 }}>
            {verificationStatus === "rejected"
              ? companyProfile?.verification_rejection_reason || "Kontrollera företagsuppgifterna och skicka in dem igen."
              : "Du kan skapa och hantera annonser. De publiceras automatiskt när företaget har godkänts."}
          </p>
          <Link href="/profile" className="secondary-btn" style={{ display: "inline-block", marginTop: ".75rem", padding: ".55rem .8rem", fontSize: ".8rem" }}>Kontrollera företagsuppgifter</Link>
        </section>
      )}
      {/* Match banner */}
      {matchedConvId && (
        <div style={{ borderRadius: 14, background: "#e8faf0", border: "1.5px solid #b6e8cf", padding: "1rem 1.1rem", marginBottom: "1rem", display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <span style={{ fontSize: "1.4rem", flexShrink: 0 }}>🎉</span>
          <div style={{ flex: 1 }}>
            <p style={{ fontWeight: 700, fontSize: "0.95rem", color: "#1a7f4b", margin: "0 0 0.15rem" }}>Det blev en match!</p>
            <p style={{ fontSize: "0.82rem", color: "#2d7a52", margin: 0 }}>Ni kan nu chatta med varandra.</p>
          </div>
          <button
            type="button"
            className="cta-btn"
            style={{ flexShrink: 0, padding: "0.5rem 0.85rem", fontSize: "0.82rem", background: "#1a7f4b" }}
            onClick={() => router.push("/chats")}
          >
            Chatta →
          </button>
          <button
            type="button"
            onClick={() => setMatchedConvId(null)}
            style={{ flexShrink: 0, background: "none", border: "none", cursor: "pointer", color: "#a3a3a3", fontSize: "1rem", padding: "0.25rem" }}
            aria-label="Stäng"
          >
            ✕
          </button>
        </div>
      )}

      {tab === "annonser" && <header className="company-workspace-heading"><p>Er rekrytering</p><h1>Era jobbannonser</h1><span>Skapa möjligheter och hitta nästa person till ert team.</span></header>}
      {/* Tab bar */}
      {(tab === "annonser" || tab === "skapa") && <div className="company-workspace-tabs">
        {(["annonser", "skapa"] as const).map((item) => <button key={item} type="button" aria-pressed={tab === item} onClick={() => { setTab(item); setError(""); }}>{item === "skapa" ? <><UiIcon name="briefcase" width="17" />Ny annons</> : <>Mina annonser <span>{jobs.length}</span></>}</button>)}
      </div>}

      {error && (
        <div style={{ borderRadius: 10, background: "#fff1f0", border: "1px solid #ffd6d3", padding: "0.75rem 1rem", fontSize: "0.85rem", color: "#c0392b", marginBottom: "1rem" }}>
          {error}
        </div>
      )}

      {/* ── KANDIDATER TAB ── */}
      {false && (
        <div>
          {candidateFeed.length === 0 ? (
            <div className="card" style={{ padding: "2rem", textAlign: "center" }}>
              <p style={{ fontWeight: 700, color: "#111", marginBottom: "0.5rem" }}>Inga annonser ännu</p>
              <p style={{ fontSize: "0.85rem", color: "#737373", marginBottom: "1rem" }}>
                Skapa din första jobbannons för att börja se kandidater.
              </p>
              <button type="button" className="cta-btn" style={{ padding: "0.75rem 1.5rem", fontSize: "0.9rem" }} onClick={() => setTab("skapa")}>
                Skapa annons
              </button>
            </div>
          ) : currentCandidate ? (
            <div
              className="card"
              style={{
                padding: "1.5rem",
                overflow: "hidden",
                position: "relative",
                userSelect: "none",
                transform: `translateX(${candidateFlyX}px) rotate(${candidateFlyRot}deg)`,
                transition: candidateIsDragging ? "none" : "transform 0.28s cubic-bezier(0.25,0.46,0.45,0.94)",
                cursor: candidateIsDragging ? "grabbing" : "grab",
                touchAction: "pan-y",
              }}
              onPointerDown={(e) => onCandidatePointerDown(e.clientX)}
              onPointerMove={(e) => onCandidatePointerMove(e.clientX)}
              onPointerUp={onCandidatePointerEnd}
              onPointerCancel={onCandidatePointerEnd}
            >
              <div style={{ position: "absolute", top: 14, left: 14, padding: "4px 10px", borderRadius: 8, border: "2.5px solid #21d07a", color: "#21d07a", fontWeight: 800, fontSize: "0.9rem", letterSpacing: "0.05em", opacity: candidateJaOpacity, transform: "rotate(-15deg)", transition: "opacity 0.1s ease", pointerEvents: "none" }}>JA</div>
              <div style={{ position: "absolute", top: 14, right: 14, padding: "4px 10px", borderRadius: 8, border: "2.5px solid #fd5564", color: "#fd5564", fontWeight: 800, fontSize: "0.9rem", letterSpacing: "0.05em", opacity: candidateNejOpacity, transform: "rotate(15deg)", transition: "opacity 0.1s ease", pointerEvents: "none" }}>NEJ</div>
              <div style={{ display: "inline-flex", alignItems: "center", gap: "0.4rem", background: "#f5f5f5", borderRadius: 8, padding: "0.3rem 0.65rem", marginBottom: "1rem" }}>
                <span style={{ fontSize: "0.72rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "#a3a3a3" }}>Ansökt till</span>
                <span style={{ fontSize: "0.8rem", fontWeight: 600, color: "#111" }}>{currentCandidate.job.title}</span>
              </div>
              <h2 style={{ fontSize: "1.4rem", fontWeight: 800, color: "#111", margin: "0 0 0.2rem" }}>
                {currentCandidate.profile?.full_name || "Anonym kandidat"}
              </h2>
              <p style={{ fontSize: "0.85rem", color: "#737373", margin: "0 0 1rem" }}>
                {[currentCandidate.profile?.age ? `${currentCandidate.profile?.age} år` : "", currentCandidate.profile?.city].filter(Boolean).join(" · ")}
              </p>
              {(currentCandidate.profile?.desired_roles ?? []).length > 0 && (
                <div style={{ marginBottom: "0.85rem" }}>
                  <p style={{ fontSize: "0.72rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#a3a3a3", marginBottom: "0.4rem" }}>Söker jobb inom</p>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "0.35rem" }}>
                    {(currentCandidate.profile?.desired_roles ?? []).map((role) => (<span key={role} className="chip">{role}</span>))}
                  </div>
                </div>
              )}
              {(currentCandidate.profile?.employment_preferences ?? []).length > 0 && (
                <div style={{ marginBottom: "0.85rem" }}>
                  <p style={{ fontSize: "0.72rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#a3a3a3", marginBottom: "0.4rem" }}>Tillgänglighet</p>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "0.35rem" }}>
                    {(currentCandidate.profile?.employment_preferences ?? []).map((pref) => (<span key={pref} className="chip">{pref}</span>))}
                  </div>
                </div>
              )}
              {currentCandidate.profile?.cv_text && (
                <div style={{ marginBottom: "0.5rem" }}>
                  <div style={{ background: "#f8f8f8", borderRadius: 10, padding: "0.85rem", fontSize: "0.82rem", color: "#444", lineHeight: 1.55 }}>
                    {currentCandidate.profile?.cv_text?.slice(0, 250)}{(currentCandidate.profile?.cv_text?.length ?? 0) > 250 ? "\u2026" : ""}
                  </div>
                  {(currentCandidate.profile?.cv_text?.length ?? 0) > 250 && (
                    <button
                      type="button"
                      onPointerDown={(e) => e.stopPropagation()}
                      onClick={() => setCvModalOpen(true)}
                      style={{ background: "none", border: "none", cursor: "pointer", fontSize: "0.8rem", color: "#737373", padding: "0.35rem 0", textDecoration: "underline" }}
                    >
                      Visa hela CV →
                    </button>
                  )}
                </div>
              )}
              <div style={{ display: "flex", gap: "0.75rem", marginTop: "0.75rem" }}>
                <button type="button" className="secondary-btn" style={{ flex: 1, padding: "0.9rem", fontSize: "0.95rem" }} onPointerDown={(e) => e.stopPropagation()} onClick={() => triggerCandidateDecision("skip")}>
                  Hoppa över
                </button>
                <button type="button" className="cta-btn" style={{ flex: 1, padding: "0.9rem", fontSize: "0.95rem" }} onPointerDown={(e) => e.stopPropagation()} onClick={() => triggerCandidateDecision("interested")}>
                  Intresserad ✓
                </button>
              </div>
            </div>
          ) : (
            <div className="card" style={{ padding: "2rem", textAlign: "center" }}>
              <p style={{ fontSize: "1.5rem", marginBottom: "0.5rem" }}>🎉</p>
              <p style={{ fontWeight: 700, color: "#111", marginBottom: "0.4rem" }}>Inga fler kandidater just nu</p>
              <p style={{ fontSize: "0.85rem", color: "#737373" }}>Kom tillbaka senare eller skapa en ny annons.</p>
            </div>
          )}
        </div>
      )}

      {tab === "kandidater" && (
        <section className="company-applicants" aria-label="Sökande kandidater">
          <header className="company-applicants-heading">
            <p>Ansökningar</p>
            <h1>Kandidater som har sökt era jobb</h1>
            <span>{candidateFeed.length} sökande</span>
          </header>
          <nav className="company-application-tabs" aria-label="Visa ansökningar"><button type="button" aria-pressed={candidateFilter === "pending"} onClick={() => {setCandidateFilter("pending");setSelectedCandidateId(null);setCandidateCv(null);}}>Att granska <span>{pendingCandidates.length}</span></button><button type="button" aria-pressed={candidateFilter === "all"} onClick={() => {setCandidateFilter("all");setSelectedCandidateId(null);setCandidateCv(null);}}>Alla ansökningar <span>{candidateFeed.length}</span></button></nav>
          {candidateFilter === "pending" && !pendingCandidates.length && candidateFeed.length > 0 ? <section className="card company-applicants-empty"><UiIcon name="check" width="30" /><h2>Alla ansökningar är granskade</h2><p>Tidigare kandidater och deras kompletteringar finns kvar under Alla ansökningar.</p><button type="button" className="secondary-btn" onClick={() => setCandidateFilter("all")}>Visa alla ansökningar</button></section> : candidateFeed.length === 0 ? (
            <div className="card company-applicants-empty"><h2>Inga ansökningar ännu</h2><p>När någon söker en av era annonser visas deras profil här.</p></div>
          ) : (
            <div className="company-applicants-layout">
              <div className="company-applicant-sidebar"><label className="company-candidate-search">Sök bland ansökningar<input className="input-field" type="search" value={candidateSearch} onChange={(event) => setCandidateSearch(event.target.value)} placeholder="Namn eller jobb…" /></label><div className="company-applicant-list">
                {displayedCandidates.filter((candidate) => [candidate.profile?.full_name, candidate.job.title].join(" ").toLocaleLowerCase("sv-SE").includes(candidateSearch.trim().toLocaleLowerCase("sv-SE"))).map((candidate) => {
                  const profile = candidate.profile;
                  const isSelected = selectedCandidate?.youthUserId === candidate.youthUserId && selectedCandidate?.job.id === candidate.job.id;
                  return <button key={`${candidate.youthUserId}-${candidate.job.id}`} type="button" className={`company-applicant-row${isSelected ? " is-selected" : ""}`} aria-pressed={isSelected} onClick={() => { setSelectedCandidateId(`${candidate.job.id}:${candidate.youthUserId}`); setCandidateCv(null); setUploadedCvError(""); }}>
                    <span className="company-applicant-avatar">{(profile?.full_name?.trim().charAt(0) || "?").toUpperCase()}</span>
                    <span><strong>{profile?.full_name || "Anonym kandidat"}</strong><small>{candidate.job.title}</small>{candidate.reviewDecision && <em className="company-application-reviewed">{candidate.reviewDecision === "interested" ? "Intresse visat" : "Avslutad"}</em>}</span>
                    <span aria-hidden="true">›</span>
                  </button>;
                })}
              </div>{candidateSearch.trim() && !displayedCandidates.some((candidate) => [candidate.profile?.full_name, candidate.job.title].join(" ").toLocaleLowerCase("sv-SE").includes(candidateSearch.trim().toLocaleLowerCase("sv-SE"))) && <p className="company-search-empty">Inga ansökningar matchar din sökning.</p>}</div>
              {!selectedCandidate && selectedCandidateId && <section className="card company-applicants-empty"><h2>Ansökan är inte tillgänglig</h2><p>Välj en annan kandidat i listan för att fortsätta.</p></section>}
              {selectedCandidate && <article className="company-candidate-profile card">
                <header><div className="company-candidate-profile-avatar">{(selectedCandidate.profile?.full_name?.trim().charAt(0) || "?").toUpperCase()}</div><div><p>Kandidat</p><h2>{selectedCandidate.profile?.full_name || "Anonym kandidat"}</h2><span>{[selectedCandidate.profile?.age ? `${selectedCandidate.profile.age} år` : "", selectedCandidate.profile?.city].filter(Boolean).join(" · ") || "Plats ej angiven"}</span></div></header>
                <section aria-label="Kandidatens CV"><button type="button" className="cta-btn" onClick={() => void openUploadedCv(selectedCandidate)} disabled={openingUploadedCv} style={{ width: "100%", padding: "0.8rem 1rem" }}>{openingUploadedCv ? "Hämtar CV..." : "Öppna CV"}</button>{uploadedCvError && <p role="alert" style={{ color: "#b42318", marginTop: ".55rem" }}>{uploadedCvError}</p>}</section>
                <CandidateAssessmentPanel key={`${selectedCandidate.job.id}:${selectedCandidate.youthUserId}`} jobId={selectedCandidate.job.id} youthUserId={selectedCandidate.youthUserId} application={selectedCandidate.application} />
                {selectedCandidate.reviewDecision ? <section className="company-reviewed-application"><UiIcon name={selectedCandidate.reviewDecision === "interested" ? "check" : "info"} width="22" /><div><strong>{selectedCandidate.reviewDecision === "interested" ? "Ni har visat intresse" : "Ansökan är avslutad"}</strong><p>Ansökan och kompletteringarna finns kvar här som underlag.</p></div>{selectedCandidate.reviewDecision === "interested" && <Link href="/chats" className="secondary-btn">Till chattarna <UiIcon name="arrow" width="16" /></Link>}</section> : (() => {
                  const actionKey = `${selectedCandidate.job.id}:${selectedCandidate.youthUserId}`;
                  const isDeciding = candidateActionKey === actionKey;
                  return <section aria-label="Beslut om ansökan" style={{ display: "flex", gap: "0.6rem", marginTop: "1.25rem", paddingTop: "1rem", borderTop: "1px solid #e8e8e8" }}>
                    <button
                      type="button"
                      className="secondary-btn"
                      disabled={isDeciding}
                      onClick={() => {
                        if (window.confirm(`Neka ${selectedCandidate.profile?.full_name || "den här kandidaten"} för ${selectedCandidate.job.title}?`)) {
                          void handleApplicantDecision(selectedCandidate, "skip");
                        }
                      }}
                      style={{ flex: 1, padding: "0.8rem" }}
                    >
                      {isDeciding ? "Sparar..." : "Neka"}
                    </button>
                    <button
                      type="button"
                      className="cta-btn"
                      disabled={isDeciding}
                      onClick={() => void handleApplicantDecision(selectedCandidate, "interested")}
                      style={{ flex: 1, padding: "0.8rem" }}
                    >
                      {isDeciding ? "Sparar..." : "Acceptera"}
                    </button>
                  </section>;
                })()}
              </article>}
            </div>
          )}
        </section>
      )}

      {false && (
        <div className="company-candidate-workspace" style={{ display: "grid", gridTemplateColumns: "minmax(150px, 0.8fr) minmax(0, 1.6fr)", gap: "0.75rem", minHeight: 520 }}>
          <aside className="card" style={{ padding: "0.65rem", overflowY: "auto", minHeight: 0 }}>
            <p style={{ margin: "0.3rem 0.7rem 0.75rem", color: "#737373", fontSize: "0.72rem", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.06em" }}>Kandidater</p>
            {candidateFeed.length === 0 ? <p style={{ padding: "0.7rem", color: "#737373", fontSize: "0.82rem" }}>Inga kandidater ännu.</p> : candidateFeed.map((candidate, index) => {
              const candidateId = candidate.youthUserId;
              const conversation = conversations.find((item) => item.youth_user_id === candidateId);
              const isActive = conversation?.id === activeConversationId;
              return <button key={`${candidateId}-${candidate.job.id}-${index}`} type="button" onClick={() => setActiveConversationId(conversation?.id ?? null)} style={{ display: "block", width: "100%", padding: "0.75rem 0.65rem", marginBottom: "0.35rem", border: 0, borderRadius: 10, textAlign: "left", background: isActive ? "#111" : "#f7f7f7", color: isActive ? "#fff" : "#111", cursor: conversation ? "pointer" : "default" }}>
                <strong style={{ display: "block", fontSize: "0.85rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{candidate.profile?.full_name || "Anonym kandidat"}</strong>
                <span style={{ display: "block", marginTop: "0.2rem", color: isActive ? "#ddd" : "#737373", fontSize: "0.72rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{candidate.job.title}</span>
              </button>;
            })}
          </aside>
          <section className="card" style={{ display: "flex", flexDirection: "column", overflow: "hidden", minHeight: 0 }}>
            {activeConversationId ? <>
              <div style={{ padding: "0.9rem 1rem", borderBottom: "1px solid #e8e8e8" }}>
                <p style={{ margin: 0, color: "#111", fontWeight: 800 }}>{feed.find((candidate) => conversations.find((item) => item.id === activeConversationId)?.youth_user_id === candidate.youthUserId)?.profile?.full_name || "Aktiv chatt"}</p>
                <p style={{ margin: "0.2rem 0 0", color: "#737373", fontSize: "0.75rem" }}>Skriv ett meddelande</p>
              </div>
              <div style={{ flex: 1, minHeight: 350, overflowY: "auto", padding: "1rem" }}>
                {chatMessages.length === 0 ? <p style={{ color: "#737373", fontSize: "0.85rem", textAlign: "center" }}>Inga meddelanden ännu.</p> : chatMessages.map((message) => <div key={message.id} style={{ display: "flex", justifyContent: message.sender_user_id === user?.id ? "flex-end" : "flex-start", marginBottom: "0.5rem" }}><span style={{ maxWidth: "78%", padding: "0.6rem 0.75rem", borderRadius: 12, background: message.sender_user_id === user?.id ? "#111" : "#f1f1f1", color: message.sender_user_id === user?.id ? "#fff" : "#111", fontSize: "0.84rem", lineHeight: 1.4 }}>{message.message_text}</span></div>)}
              </div>
              <form onSubmit={(event) => void sendCompanyMessage(event)} style={{ display: "flex", gap: "0.45rem", padding: "0.75rem", borderTop: "1px solid #e8e8e8" }}><input className="input-field" value={chatDraft} onChange={(event) => setChatDraft(event.target.value)} placeholder="Skriv ett meddelande..." /><button type="submit" className="cta-btn" style={{ padding: "0 0.9rem" }}>Skicka</button></form>
            </> : <div style={{ display: "grid", placeItems: "center", flex: 1, minHeight: 450, padding: "2rem", textAlign: "center" }}><p style={{ margin: 0, color: "#737373", fontSize: "0.9rem" }}>Välj en kandidat med en aktiv chatt.</p></div>}
          </section>
        </div>
      )}

      {/* ── NY ANNONS TAB ── */}
      {tab === "skapa" && (
        <form
          className="job-builder job-builder-onboarding"
          onSubmit={(event) => {
            if (builderStep < 3) {
              event.preventDefault();
              moveToBuilderStep((builderStep + 1) as 2 | 3);
              return;
            }
            void handleCreateJob(event);
          }}
        >
          {(() => {
            const salaryPeriod = form.salaryType === "timlön" ? "tim" : form.salaryType === "månadslön" ? "mån" : "period";
            const salary = form.salaryFrom || form.salaryTo ? `${form.salaryFrom || "?"}–${form.salaryTo || "?"} kr/${salaryPeriod}` : "Lön ej angiven";
            const steps = [
              { number: 1 as const, label: "Jobbet", description: "Roll och arbetsuppgifter" },
              { number: 2 as const, label: "Matchning", description: "Vem ni söker" },
              { number: 3 as const, label: "Detaljer", description: "Lön, plats och bild" },
            ];
            return <>
              <header className="job-builder-heading">
                <div><p>MatchnWork</p><h1>Skapa jobbannons</h1><span>Tre korta steg. Ni behåller kontrollen, medan MatchnWork använder svaren för att skapa rätt matchning.</span></div>
              </header>
              <nav className="job-builder-steps" aria-label="Steg i annonsskapandet">
                {steps.map((step) => (
                  <button
                    key={step.number}
                    type="button"
                    className={builderStep === step.number ? "is-current" : builderStep > step.number ? "is-complete" : ""}
                    onClick={() => { if (step.number <= builderStep) moveToBuilderStep(step.number); }}
                    disabled={step.number > builderStep}
                    aria-current={builderStep === step.number ? "step" : undefined}
                  >
                    <span>{builderStep > step.number ? "✓" : step.number}</span>
                    <div><strong>{step.label}</strong><small>{step.description}</small></div>
                  </button>
                ))}
              </nav>
              <div className="job-builder-layout">
                <div className="job-builder-form">
                  {builderStep === 1 && (
                    <section className="card job-builder-section job-builder-step-panel">
                      <div className="job-builder-section-title">
                        <div><p className="job-builder-eyebrow">Steg 1 av 3</p><h2>Berätta om jobbet</h2><p className="job-builder-help">Börja med det viktigaste. Ni kan låta AI formulera ett första förslag och sedan redigera texten.</p></div>
                        <button type="button" onClick={() => void handleAiGenerate()} disabled={generatingAi || busy} className="job-builder-ai">{generatingAi ? "AI bygger förslag..." : "✦ Skapa annons + matchning med AI"}</button>
                      </div>
                      {aiMessage && <p role="status" className="job-builder-ai-message">✓ {aiMessage}</p>}
                      <label className="job-builder-title-field">Arbetstitel *<input className="input-field" placeholder="T.ex. Butikssäljare" list="company-job-title-suggestions" value={form.title} onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))} required /></label>
                      <label htmlFor="job-builder-description" className="job-builder-label job-builder-description-label">Beskriv jobbet, vem ni söker och vad ni erbjuder *</label>
                      <textarea id="job-builder-description" rows={7} className="job-builder-textarea" placeholder="T.ex. Vi söker en social och punktlig person som kan arbeta helger i vår butik. Erfarenhet är inget krav eftersom vi lär upp på plats..." value={form.description} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} required />
                      <label className="job-builder-label" style={{ marginTop: "1.2rem" }}>Arbetskategori *</label>
                      <div className="job-builder-chips">{JOB_CATEGORIES.map((category) => <button key={category} type="button" aria-pressed={form.category === category} onClick={() => setForm((p) => ({ ...p, category: p.category === category ? "" : category }))} className={`chip ${form.category === category ? "job-builder-chip-selected" : ""}`}>{category}</button>)}</div>
                      <label className="job-builder-label" style={{ marginTop: "1rem" }}>Anställningsform *</label>
                      <div className="job-builder-chips">{EMPLOYMENT_TYPES.map((type) => <button key={type} type="button" aria-pressed={form.employmentType === type} onClick={() => setForm((p) => ({ ...p, employmentType: p.employmentType === type ? "" : type }))} className={`chip ${form.employmentType === type ? "job-builder-chip-selected" : ""}`}>{type}</button>)}</div>
                    </section>
                  )}

                  {builderStep === 2 && (
                    <section className="card job-builder-section job-builder-step-panel">
                      <p className="job-builder-eyebrow">Steg 2 av 3</p>
                      <h2>Vem passar för jobbet?</h2>
                      <p className="job-builder-help">Detta används i den jobbspecifika matchprofilen. Företagets sparade kultur och värderingar läggs till automatiskt.</p>
                      <div className="job-builder-match-note"><div><strong>Er företagsprofil återanvänds</strong><p>Ni behöver bara ange vad som är särskilt för den här rollen.</p></div><button type="button" onClick={() => setShowMatchProfileEditor(true)}>Granska grundprofil →</button></div>
                      <div className="job-builder-age"><span>Åldersspann <em>(valfritt)</em></span><div><label>Ålder från<input className="input-field" type="number" min="13" max="30" placeholder="T.ex. 16" value={form.minAge} onChange={(e) => setForm((p) => ({ ...p, minAge: e.target.value }))} /></label><b>—</b><label>Ålder till<input className="input-field" type="number" min="13" max="30" placeholder="T.ex. 19" value={form.maxAge} onChange={(e) => setForm((p) => ({ ...p, maxAge: e.target.value }))} /></label></div></div>
                      <div className="job-builder-tags">
                        <div><h3>Absoluta krav <span>(valfritt)</span></h3><p className="job-builder-field-help">Ange bara sådant kandidaten måste uppfylla från start.</p><div className="job-builder-chips">{REQUIREMENT_TIPS.map((tip) => { const selected = textListItems(form.requirements).includes(tip); return <button key={tip} type="button" aria-pressed={selected} onClick={() => setForm((p) => ({ ...p, requirements: toggleTextList(p.requirements, tip) }))} className={`chip ${selected ? "job-builder-chip-selected" : ""}`}>{tip}</button>; })}<button type="button" className="chip" onClick={() => setShowCustomRequirement((visible) => !visible)}>+ Eget krav</button></div>{showCustomRequirement && <div className="job-builder-custom"><input aria-label="Eget krav" className="input-field" placeholder="Skriv eget krav" value={customRequirement} onChange={(e) => setCustomRequirement(e.target.value)} /><button type="button" className="secondary-btn" onClick={() => { if (customRequirement.trim()) { setForm((p) => ({ ...p, requirements: toggleTextList(p.requirements, customRequirement.trim()) })); setCustomRequirement(""); setShowCustomRequirement(false); } }}>Lägg till</button></div>}</div>
                        <div><h3>Viktigaste egenskaperna <span>(välj högst 5)</span></h3><div className="job-builder-chips">{TRAIT_TIPS.map((tip) => { const selected = textListItems(form.topTraits).includes(tip); return <button key={tip} type="button" aria-pressed={selected} onClick={() => toggleTrait(tip)} className={`chip ${selected ? "job-builder-chip-selected" : ""}`}>{tip}</button>; })}</div></div>
                      </div>
                      <div className="job-builder-fields" style={{ marginTop: "1rem" }}>
                        <label>Vad kan personen lära sig på plats?<textarea className="input-field" rows={3} placeholder="T.ex. kassasystem, produktkunskap, rutiner" value={form.trainableRequirements} onChange={(e) => setForm((p) => ({ ...p, trainableRequirements: e.target.value }))} /></label>
                      </div>
                      {form.candidateQuestions.length > 0 && <div className="job-builder-ai-questions"><div><strong>Kompletteringsfrågor vid behov</strong><p>Granska förslagen. Frågorna visas separat för ungdomen innan ansökan skickas. Alla frågor är valfria.</p></div>{form.candidateQuestions.map((question, index) => <label key={index}>Fråga {index + 1}<div><input className="input-field" value={question} onChange={(event) => setForm((current) => ({ ...current, candidateQuestions: current.candidateQuestions.map((item, itemIndex) => itemIndex === index ? event.target.value : item) }))} /><button type="button" aria-label={`Ta bort fråga ${index + 1}`} onClick={() => setForm((current) => ({ ...current, candidateQuestions: current.candidateQuestions.filter((_, itemIndex) => itemIndex !== index) }))}>×</button></div></label>)}</div>}
                    </section>
                  )}

                  {builderStep === 3 && (<>
                    <section className="card job-builder-section job-builder-step-panel">
                      <p className="job-builder-eyebrow">Steg 3 av 3</p><h2>Plats och praktiska detaljer</h2><p className="job-builder-help">Slutför annonsen. Lön, förmåner och bild är valfria men gör annonsen mer attraktiv.</p>
                      <div className="job-builder-fields two-columns"><label>Gatuadress *<input className="input-field" placeholder="T.ex. Storgatan 12" list="company-address-suggestions" autoComplete="street-address" value={form.address} onChange={(e) => setForm((p) => ({ ...p, address: e.target.value }))} required /></label><label>Postnummer *<input className="input-field" placeholder="123 45" autoComplete="postal-code" inputMode="numeric" value={form.postalCode} onChange={(e) => setForm((p) => ({ ...p, postalCode: e.target.value }))} required /></label><label>Stad *<input className="input-field" placeholder="T.ex. Stockholm" list="company-city-suggestions" value={form.city} onChange={(e) => setForm((p) => ({ ...p, city: e.target.value }))} required /></label></div>
                    </section>
                    <section className="card job-builder-section"><h2>Lön <span className="job-builder-optional">Valfritt</span></h2><div className="job-builder-info">✦ Annonser med angiven lön får ofta fler ansökningar.</div><label className="job-builder-label">Lönetyp</label><div className="job-builder-chips">{(["timlön", "månadslön", "fast lön"] as const).map((type) => <button key={type} type="button" onClick={() => setForm((p) => ({ ...p, salaryType: type }))} className={`chip ${form.salaryType === type ? "job-builder-chip-selected" : ""}`}>{type}</button>)}</div><div className="job-builder-salary"><label>Lön från<input className="input-field" inputMode="numeric" placeholder="T.ex. 120" value={form.salaryFrom} onChange={(e) => setForm((p) => ({ ...p, salaryFrom: e.target.value }))} /></label><span>—</span><label>Lön till<input className="input-field" inputMode="numeric" placeholder="T.ex. 145" value={form.salaryTo} onChange={(e) => setForm((p) => ({ ...p, salaryTo: e.target.value }))} /></label><em>kr/{salaryPeriod}</em></div></section>
                    <section className="card job-builder-section"><h2>Förmåner <span className="job-builder-optional">Valfritt</span></h2><p className="job-builder-help">Visa vad kandidaten får utöver själva jobbet.</p><div className="job-builder-chips">{BENEFIT_TIPS.map((tip) => { const selected = textListItems(form.benefits).includes(tip); return <button key={tip} type="button" aria-pressed={selected} onClick={() => setForm((p) => ({ ...p, benefits: toggleTextList(p.benefits, tip) }))} className={`chip ${selected ? "job-builder-chip-selected" : ""}`}>{tip}</button>; })}<button type="button" className="chip" onClick={() => setShowCustomBenefit((visible) => !visible)}>+ Egen förmån</button></div>{showCustomBenefit && <div className="job-builder-custom"><input className="input-field" placeholder="Skriv egen förmån" value={customBenefit} onChange={(e) => setCustomBenefit(e.target.value)} /><button type="button" className="secondary-btn" onClick={() => { if (customBenefit.trim()) { setForm((p) => ({ ...p, benefits: toggleTextList(p.benefits, customBenefit.trim()) })); setCustomBenefit(""); setShowCustomBenefit(false); } }}>Lägg till</button></div>}</section>
                    <section className="card job-builder-section"><h2>Omslagsbild <span className="job-builder-optional">Valfritt</span></h2><p className="job-builder-help">Välj en bild och beskär den för annonsformatet.</p><label className="job-builder-dropzone"><input type="file" accept=".jpg,.jpeg,.png,.webp" onChange={(event) => { const file = event.target.files?.[0]; event.target.value = ""; if (file) setImageToCrop(file); }} />{jobImagePreviews.length ? <div className="job-builder-image-grid">{jobImagePreviews.map((preview, index) => <img key={preview} src={preview} alt={`Förhandsgranskning ${index + 1}`} />)}</div> : <><b>↑</b><strong>Lägg till omslagsbild</strong><span>JPG, PNG eller WEBP · beskärs till 4:3</span></>}</label></section>
                  </>)}
                </div>
                {previewOpen && <JobPreviewDialog form={form} image={jobImagePreviews[0]} companyName={companyProfile?.company_name || "Ditt företag"} salary={salary} onClose={() => setPreviewOpen(false)} />}
              </div>
              <div className="job-builder-actions">
                {draftSaved && <span>Utkast sparat</span>}
                <button type="button" className="job-builder-save" onClick={handleSaveDraft}>Spara utkast</button>
                {builderStep > 1 && <button type="button" className="secondary-btn" onClick={() => moveToBuilderStep((builderStep - 1) as 1 | 2)}>Tillbaka</button>}
                {builderStep < 3 ? <button type="submit" className="cta-btn">Fortsätt</button> : <><button type="button" className="secondary-btn" onClick={() => setPreviewOpen(true)}>Förhandsvisa</button><button type="submit" className="cta-btn" disabled={busy}>{busy ? "Publicerar..." : "Publicera annons"}</button></>}
              </div>
            </>;
          })()}
        </form>
      )}

      {/* ── ANNONSER TAB ── */}
      {tab === "annonser" && (
        <div>
          {jobs.length === 0 ? (
            <div className="card" style={{ padding: "2rem", textAlign: "center" }}>
              <p style={{ fontWeight: 700, color: "#111", marginBottom: "0.75rem" }}>Inga annonser ännu</p>
              <button type="button" className="cta-btn" style={{ padding: "0.75rem 1.5rem", fontSize: "0.9rem" }} onClick={() => setTab("skapa")}>
                Skapa din första annons
              </button>
            </div>
          ) : (
            <div className="company-jobs-grid">
              {jobs.map((job) => {
                const agePart = job.min_age || job.max_age ? `${job.min_age ?? "?"}–${job.max_age ?? "?"} år` : null;
                const status = job.status ?? (job.is_active ? "active" : "paused");
                const isWorking = jobActionId === job.id;
                const awaitingVerification = job.publication_status === "pending_verification";
                return (
                  <article key={job.id} className="card job-list-card" style={{ padding: "1rem 1.1rem" }}>
                    <Link className="company-job-summary" href={`/jobb/${job.id}`} style={{ color: "inherit", textDecoration: "none" }}>
                    <div className="company-job-heading"><span className="company-job-icon"><UiIcon name="briefcase" width="23" /></span><h2>{job.title}</h2></div>
                    <p style={{ fontSize: "0.82rem", color: "#737373" }}>{[[job.address, job.postal_code, job.city].filter(Boolean).join(", "), job.category, agePart].filter(Boolean).join(" · ")}</p>
                    {job.employment_type && (
                      <div style={{ display: "flex", flexWrap: "wrap", gap: "0.3rem", marginTop: "0.5rem" }}>
                        {job.employment_type.split(",").map((t) => (<span key={t} className="chip">{t.trim()}</span>))}
                      </div>
                    )}
                    <div style={{ display: "inline-block", marginTop: "0.5rem", padding: "0.15rem 0.55rem", borderRadius: 999, fontSize: "0.72rem", fontWeight: 600, background: awaitingVerification ? "#fff3d6" : status === "active" ? "#e8faf0" : "#f5f5f5", color: awaitingVerification ? "#6a4a00" : status === "active" ? "#1a7f4b" : "#a3a3a3" }}>
                      {awaitingVerification ? "Inväntar verifiering" : status === "active" ? "Publicerad" : status === "paused" ? "Pausad" : "Stängd"}
                    </div>
                    <span className="job-list-card-link">Visa hela annonsen →</span>
                    </Link>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: ".45rem", marginTop: ".8rem" }}>
                      <button type="button" className="secondary-btn" disabled={isWorking} onClick={() => setEditingCriteria(job)} style={{ padding: ".5rem .7rem", fontSize: ".78rem" }}>Redigera matchkriterier</button>
                      {status !== "active" && <button type="button" className="secondary-btn" disabled={isWorking} onClick={() => void handleJobStatus(job, "active")} style={{ padding: ".5rem .7rem", fontSize: ".78rem" }}>Återaktivera</button>}
                      {status === "active" && <button type="button" className="secondary-btn" disabled={isWorking} onClick={() => void handleJobStatus(job, "paused")} style={{ padding: ".5rem .7rem", fontSize: ".78rem" }}>Pausa</button>}
                      {status !== "closed" && <button type="button" className="secondary-btn" disabled={isWorking} onClick={() => void handleJobStatus(job, "closed")} style={{ padding: ".5rem .7rem", fontSize: ".78rem" }}>Stäng rekrytering</button>}
                      <button type="button" disabled={isWorking} onClick={() => void handleDeleteJob(job)} style={{ padding: ".5rem .7rem", border: 0, color: "#b42318", background: "transparent", font: "inherit", fontSize: ".78rem", fontWeight: 700, cursor: isWorking ? "wait" : "pointer" }}>{isWorking ? "Sparar..." : "Ta bort"}</button>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      )}
      {/* CV full-text modal */}
      {cvModalOpen && currentCandidate?.profile?.cv_text && (
        <div
          onClick={() => setCvModalOpen(false)}
          style={{ position: "fixed", inset: 0, zIndex: 100, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "flex-end", justifyContent: "center" }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ background: "#fff", borderRadius: "20px 20px 0 0", padding: "1.5rem 1.5rem 2rem", width: "100%", maxWidth: 430, maxHeight: "80svh", overflowY: "auto" }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
              <div>
                <p style={{ fontWeight: 700, fontSize: "1.05rem", color: "#111", margin: 0 }}>{currentCandidate.profile?.full_name || "Kandidat"}</p>
                <p style={{ fontSize: "0.78rem", color: "#737373", margin: "0.1rem 0 0" }}>Fullständigt CV</p>
              </div>
              <button type="button" onClick={() => setCvModalOpen(false)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: "1.3rem", color: "#737373", padding: "0.25rem" }}>✕</button>
            </div>
            <p style={{ fontSize: "0.88rem", color: "#333", lineHeight: 1.7, whiteSpace: "pre-wrap", margin: 0 }}>
              {currentCandidate.profile.cv_text}
            </p>
          </div>
        </div>
      )}
      {candidateCv && selectedCandidate && candidateCv.candidateKey === `${selectedCandidate.job.id}:${selectedCandidate.youthUserId}` && <ModalDialog label="Kandidatens CV" onClose={() => setCandidateCv(null)} className="mnw-candidate-cv-modal"><div className="candidate-cv-dialog"><header><div><p>Fullständigt CV</p><h2>{selectedCandidate.profile?.full_name || "Anonym kandidat"}</h2><span>{[selectedCandidate.profile?.age ? `${selectedCandidate.profile.age} år` : "", selectedCandidate.profile?.city].filter(Boolean).join(" · ") || "Plats ej angiven"}</span></div><button type="button" onClick={() => setCandidateCv(null)} aria-label="Stäng CV">×</button></header>{candidateCv.kind === "pdf" ? <iframe title={`CV för ${selectedCandidate.profile?.full_name || "kandidat"}`} src={candidateCv.url} /> : <article><p>{candidateCv.text}</p></article>}</div></ModalDialog>}
      {showMatchProfileEditor && user && (
        <ModalDialog label="Företagets matchprofil" onClose={() => setShowMatchProfileEditor(false)}>
          <div className="company-match-modal-content" onClick={(event) => event.stopPropagation()}>
            <button type="button" className="company-match-modal-close" onClick={() => setShowMatchProfileEditor(false)} aria-label="Stäng matchprofil">×</button>
            <CompanyMatchProfileForm userId={user.id} embedded />
          </div>
        </ModalDialog>
      )}
      {editingCriteria && <JobMatchProfileEditor key={editingCriteria.id} jobId={editingCriteria.id} title={editingCriteria.title} onClose={closeCriteria} onSaved={() => { setEditingCriteria(null); setError(""); }} />}
      {imageToCrop && <ImageCropDialog file={imageToCrop} onCancel={() => setImageToCrop(null)} onConfirm={useCroppedJobImage} />}
    </main>
  );
}

export default function CompanyPage() {
  return <Suspense fallback={<main className="mobile-shell map-page-loading"><p>Laddar...</p></main>}><CompanyPageContent /></Suspense>;
}
