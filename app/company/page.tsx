"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useSession } from "@/hooks/use-session";
import { getSupabaseClient } from "@/lib/supabase";
import { getCandidatesForJob, getCompanyJobs as getFeedCompanyJobs } from "@/lib/feeds";
import { createJob } from "@/lib/jobs";
import { getMessages, getMyConversations, sendMessage } from "@/lib/chat";
import { reviewCandidate } from "@/lib/matching";
import { uploadJobImage } from "@/lib/storage";
import { ADDRESS_SUGGESTIONS, CITY_SUGGESTIONS, JOB_TITLE_SUGGESTIONS } from "@/lib/form-suggestions";
import type { CandidateFeedItem, ChatMessage, CompanyProfile, ConversationSummary, JobPost, MatchRecord, SwipeDecision, YouthDocumentType } from "@/lib/types";

const DOC_TYPE_LABELS: Record<YouthDocumentType, string> = {
  grades: "Betyg",
  recommendation: "Rekommendationsbrev",
  certificate: "Intyg",
  other: "Övrigt",
};

const JOB_TYPES = ["Deltid", "Heltid", "Sommarjobb", "Helgjobb", "Extra vid behov"];
const BENEFIT_TIPS = ["Flexibla tider", "Introduktion", "Personalrabatt", "Friskvårdsbidrag", "Måltid ingår"];
const REQUIREMENT_TIPS = ["Social", "Ansvarsfull", "Noggrann", "Kan samarbeta", "Tidigare erfarenhet"];

function toggleTextList(value: string, item: string): string {
  const items = value.split(",").map((entry) => entry.trim()).filter(Boolean);
  return items.includes(item) ? items.filter((entry) => entry !== item).join(", ") : [...items, item].join(", ");
}

function textListItems(value: string): string[] {
  return value.split(/[,\n]+/).map((item) => item.trim()).filter(Boolean);
}

const SOCIAL_NETWORKS = [
  { key: "linkedin_url", label: "LinkedIn", mark: "in", color: "#0a66c2" },
  { key: "instagram_url", label: "Instagram", mark: "◎", color: "#c13584" },
  { key: "facebook_url", label: "Facebook", mark: "f", color: "#1877f2" },
  { key: "tiktok_url", label: "TikTok", mark: "♪", color: "#111" },
  { key: "x_url", label: "X", mark: "𝕏", color: "#111" },
] as const;

function socialHref(value: unknown): string {
  const href = String(value ?? "").trim();
  return href ? (/^https?:\/\//i.test(href) ? href : `https://${href}`) : "";
}

const MOCK_CANDIDATES: CandidateFeedItem[] = [
  {
    youthUserId: "mock-youth-elin",
    profile: { user_id: "mock-youth-elin", full_name: "Elin Andersson", age: 17, city: "Stockholm", desired_roles: ["Butik", "Kundservice"], employment_preferences: ["Deltid", "Sommarjobb"], strengths: ["Social", "Ansvarsfull"], cv_text: "Jag är en social och nyfiken person som tycker om att möta människor och lära mig nya saker." },
    job: { id: "mock-job-butik", title: "Butikssäljare", description: "Hjälp kunder och skapa en bra butiksupplevelse.", city: "Stockholm", salary_per_hour: "", employment_type: "Deltid", category: "Butik", requirements: "Social, Ansvarsfull", benefits: "Introduktion, Personalrabatt", company_name: "", company_user_id: "mock-company", image_url: "", is_active: true, created_at: new Date().toISOString() },
  },
  {
    youthUserId: "mock-youth-noah",
    profile: { user_id: "mock-youth-noah", full_name: "Noah Berg", age: 18, city: "Göteborg", desired_roles: ["Café/restaurang"], employment_preferences: ["Helgjobb", "Extra vid behov"], strengths: ["Noggrann", "Kan samarbeta"], cv_text: "Jag gillar ett högt tempo och trivs bäst när jag får samarbeta med andra." },
    job: { id: "mock-job-cafe", title: "Cafémedarbetare", description: "Bli en del av vårt team i caféet.", city: "Göteborg", salary_per_hour: "", employment_type: "Helgjobb", category: "Café/restaurang", requirements: "Noggrann, Kan samarbeta", benefits: "Flexibla tider, Måltid ingår", company_name: "", company_user_id: "mock-company", image_url: "", is_active: true, created_at: new Date().toISOString() },
  },
];

const MOCK_CONVERSATIONS: ConversationSummary[] = MOCK_CANDIDATES.map((candidate, index) => ({
  id: `mock-conversation-${index + 1}`,
  youth_user_id: candidate.youthUserId,
  company_user_id: "mock-company",
  job_id: candidate.job.id,
  last_message_at: new Date().toISOString(),
  created_at: new Date().toISOString(),
}));

const MOCK_MESSAGES: ChatMessage[] = [
  { id: "mock-message-1", conversation_id: "mock-conversation-1", sender_user_id: "mock-youth-elin", message_text: "Hej! Jag är väldigt intresserad av tjänsten.", created_at: new Date().toISOString() },
  { id: "mock-message-2", conversation_id: "mock-conversation-1", sender_user_id: "mock-company", message_text: "Hej Elin! Vad roligt att höra. Berätta gärna lite om dig själv.", created_at: new Date().toISOString() },
];

type Tab = "kandidater" | "swipe" | "skapa" | "annonser";

interface JobForm {
  title: string;
  city: string;
  address: string;
  postalCode: string;
  category: string;
  timePrefs: string[];
  minAge: string;
  maxAge: string;
  pay: string;
  description: string;
  benefits: string;
  requirements: string;
}

const EMPTY_FORM: JobForm = {
  title: "",
  city: "",
  address: "",
  postalCode: "",
  category: "",
  timePrefs: [],
  minAge: "",
  maxAge: "",
  pay: "",
  description: "",
  benefits: "",
  requirements: "",
};

export default function CompanyPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, profile, loading } = useSession();

  const [tab, setTab] = useState<Tab>("kandidater");
  const [jobs, setJobs] = useState<JobPost[]>([]);
  const [feed, setFeed] = useState<CandidateFeedItem[]>([]);
  const [feedIndex, setFeedIndex] = useState(0);
  const [companyProfile, setCompanyProfile] = useState<CompanyProfile | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState<JobForm>(EMPTY_FORM);
  const [matchedConvId, setMatchedConvId] = useState<string | null>(null);
  const [cvModalOpen, setCvModalOpen] = useState(false);
  const [jobImageFiles, setJobImageFiles] = useState<File[]>([]);
  const [jobImagePreviews, setJobImagePreviews] = useState<string[]>([]);
  const [draftSaved, setDraftSaved] = useState(false);
  const [generatingAi, setGeneratingAi] = useState(false);
  const [showCustomBenefit, setShowCustomBenefit] = useState(false);
  const [showCustomRequirement, setShowCustomRequirement] = useState(false);
  const [customBenefit, setCustomBenefit] = useState("");
  const [customRequirement, setCustomRequirement] = useState("");
  const [candidateDragX, setCandidateDragX] = useState(0);
  const [candidateIsDragging, setCandidateIsDragging] = useState(false);
  const [candidateFlyDir, setCandidateFlyDir] = useState<"left" | "right" | null>(null);
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatDraft, setChatDraft] = useState("");
  const candidateStartXRef = useRef<number | null>(null);
  const candidateFlyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadData = async (userId: string) => {
    try {
      const supabase = getSupabaseClient();
      const [jobsData, { data: cp }] = await Promise.all([
        getFeedCompanyJobs(),
        supabase.from("company_profiles").select("*").eq("user_id", userId).maybeSingle(),
      ]);
      const candidateGroups = await Promise.all(jobsData.map((job) => getCandidatesForJob(job.id)));
      setJobs(jobsData);
      setFeed(candidateGroups.flat());
      setFeedIndex(0);
      if (cp) setCompanyProfile(cp as CompanyProfile);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Kunde inte ladda data.");
    }
  };

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/login");
      return;
    }
    if (!loading && user && profile?.role === "company") {
      void loadData(user.id);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, user, profile?.role]);

  useEffect(() => {
    const requestedView = searchParams.get("view");
    if (requestedView === "kandidater" || requestedView === "annonser" || requestedView === "swipe") {
      setTab(requestedView);
    }
  }, [searchParams]);

  useEffect(() => {
    if (!user || profile?.role !== "company") return;
    void getMyConversations().then((items) => setConversations(items.length > 0 ? items : MOCK_CONVERSATIONS)).catch(() => setConversations(MOCK_CONVERSATIONS));
  }, [profile?.role, user]);

  useEffect(() => {
    if (!activeConversationId) {
      setChatMessages([]);
      return;
    }
    if (activeConversationId.startsWith("mock-")) {
      setChatMessages(MOCK_MESSAGES.filter((message) => message.conversation_id === activeConversationId));
      return;
    }
    void getMessages(activeConversationId).then(setChatMessages).catch(() => setChatMessages([]));
  }, [activeConversationId]);

  const sendCompanyMessage = async (event: FormEvent) => {
    event.preventDefault();
    if (!activeConversationId || !chatDraft.trim()) return;
    const text = chatDraft.trim();
    setChatDraft("");
    if (activeConversationId.startsWith("mock-")) {
      setChatMessages((items) => [...items, { id: `mock-message-${Date.now()}`, conversation_id: activeConversationId, sender_user_id: user?.id ?? "mock-company", message_text: text, created_at: new Date().toISOString() }]);
      return;
    }
    await sendMessage(activeConversationId, text);
    setChatMessages(await getMessages(activeConversationId));
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
    const item = candidateFeed[feedIndex];
    if (!item) return;
    if (item.youthUserId.startsWith("mock-")) {
      setCandidateFlyDir(null);
      setCandidateDragX(0);
      setFeedIndex((i) => i + 1);
      return;
    }
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

  const handleCreateJob = async (e: FormEvent) => {
    e.preventDefault();
    if (!form.category) { setError("Välj typ av jobb."); return; }
    if (!form.description.trim()) { setError("Skriv en beskrivning av jobbet."); return; }
    if (!form.city.trim() || !form.address.trim() || !form.postalCode.trim()) { setError("Fyll i stad, adress och postnummer."); return; }
    setBusy(true);
    setError("");
    try {
      const imageUrls = jobImageFiles.length > 0
        ? await Promise.all(jobImageFiles.map((file) => uploadJobImage(file)))
        : [];
      await createJob({
        title: form.title,
        city: form.city,
        category: form.category,
        employment_type: "",
        description: form.description,
        salary_per_hour: form.pay,
        requirements: form.requirements,
        benefits: form.benefits,
        company_name: companyProfile?.company_name || user?.email || "Företag",
        image_url: imageUrls.join(","),
        min_age: form.minAge ? parseInt(form.minAge, 10) : null,
        max_age: form.maxAge ? parseInt(form.maxAge, 10) : null,
      });
      setForm(EMPTY_FORM);
      setJobImageFiles([]);
      setJobImagePreviews([]);
      if (user) await loadData(user.id);
      setTab("annonser");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Kunde inte skapa annonsen.");
    } finally {
      setBusy(false);
    }
  };

  const handleSaveDraft = () => {
    window.localStorage.setItem("employo-job-draft", JSON.stringify(form));
    setDraftSaved(true);
    window.setTimeout(() => setDraftSaved(false), 2500);
  };

  const handleAiGenerate = async () => {
    if (!form.title.trim()) {
      setError("Skriv en jobbtitel först.");
      return;
    }
    setGeneratingAi(true);
    setError("");
    try {
      const response = await fetch("/api/company/job/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: form.title, industry: companyProfile?.industry ?? "" }),
      });
      const data = (await response.json()) as { category?: string; description?: string; benefits?: string; requirements?: string; error?: string };
      if (!response.ok) throw new Error(data.error || "Kunde inte skapa annonsen.");
      setForm((previous) => ({
        ...previous,
        category: data.category || previous.category,
        description: data.description || previous.description,
        benefits: data.benefits || previous.benefits,
        requirements: data.requirements || previous.requirements,
      }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Kunde inte skapa annonsen.");
    } finally {
      setGeneratingAi(false);
    }
  };

  if (loading || !user) {
    return (
      <main className="mobile-shell" style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
        <p style={{ color: "#737373", fontSize: "0.9rem" }}>Laddar...</p>
      </main>
    );
  }

  if (profile?.role !== "company") {
    return (
      <main className="mobile-shell" style={{ paddingTop: "2rem" }}>
        <div className="card" style={{ padding: "1.25rem", textAlign: "center" }}>
          <p style={{ fontWeight: 700, color: "#111" }}>Den här sidan är för företagskonton.</p>
        </div>
      </main>
    );
  }

  const candidateFeed = feed.length > 0 ? feed : MOCK_CANDIDATES;
  const currentCandidate = candidateFeed[feedIndex] ?? null;
  const candidateFlyX = candidateFlyDir === "right" ? 600 : candidateFlyDir === "left" ? -600 : candidateDragX;
  const candidateFlyRot = candidateFlyDir === "right" ? 12 : candidateFlyDir === "left" ? -12 : candidateDragX * 0.02;
  const candidateJaOpacity = candidateFlyDir === "right" ? 1 : candidateDragX > 20 ? Math.min(candidateDragX / 100, 1) : 0;
  const candidateNejOpacity = candidateFlyDir === "left" ? 1 : candidateDragX < -20 ? Math.min(-candidateDragX / 100, 1) : 0;

  return (
    <main className="mobile-shell">
      <datalist id="company-job-title-suggestions">{JOB_TITLE_SUGGESTIONS.map((suggestion) => <option key={suggestion} value={suggestion} />)}</datalist>
      <datalist id="company-city-suggestions">{CITY_SUGGESTIONS.map((suggestion) => <option key={suggestion} value={suggestion} />)}</datalist>
      <datalist id="company-address-suggestions">{ADDRESS_SUGGESTIONS.map((suggestion) => <option key={suggestion} value={suggestion} />)}</datalist>
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

      {/* Tab bar */}
      {(tab === "annonser" || tab === "skapa") && <div style={{ display: "flex", gap: "0.4rem", marginBottom: "1rem" }}>
        {(["skapa", "annonser"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => { setTab(t); setError(""); }}
            style={{
              flex: 1,
              padding: "0.6rem 0.25rem",
              borderRadius: 10,
              fontSize: "0.78rem",
              fontWeight: 600,
              border: "1.5px solid",
              borderColor: tab === t ? "#111111" : "#e8e8e8",
              background: tab === t ? "#111111" : "#ffffff",
              color: tab === t ? "#ffffff" : "#737373",
              cursor: "pointer",
              transition: "all 0.15s ease",
            }}
          >
            {t === "skapa"
              ? "Ny annons"
              : `Mina annonser${jobs.length > 0 ? ` (${jobs.length})` : ""}`}
          </button>
        ))}
      </div>}

      {error && (
        <div style={{ borderRadius: 10, background: "#fff1f0", border: "1px solid #ffd6d3", padding: "0.75rem 1rem", fontSize: "0.85rem", color: "#c0392b", marginBottom: "1rem" }}>
          {error}
        </div>
      )}

      {/* ── KANDIDATER TAB ── */}
      {tab === "swipe" && (
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
              {(currentCandidate.profile?.documents as { name: string; url: string; type: YouthDocumentType }[] | null | undefined)?.length ? (
                <div style={{ marginBottom: "0.75rem" }}>
                  <p style={{ fontSize: "0.72rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#a3a3a3", marginBottom: "0.4rem" }}>Bilagor</p>
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem" }}>
                    {(currentCandidate.profile!.documents as { name: string; url: string; type: YouthDocumentType }[]).map((doc) => (
                      <a
                        key={doc.url}
                        href={doc.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        onPointerDown={(e) => e.stopPropagation()}
                        style={{ display: "flex", alignItems: "center", gap: "0.5rem", background: "#f5f5f5", borderRadius: 8, padding: "0.5rem 0.75rem", textDecoration: "none" }}
                      >
                        <span style={{ fontSize: "0.9rem" }}>📎</span>
                        <span style={{ fontSize: "0.82rem", color: "#111111", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{doc.name}</span>
                        <span style={{ fontSize: "0.7rem", color: "#a3a3a3", flexShrink: 0 }}>{DOC_TYPE_LABELS[doc.type]}</span>
                      </a>
                    ))}
                  </div>
                </div>
              ) : null}
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
                {chatMessages.length === 0 ? <p style={{ color: "#737373", fontSize: "0.85rem", textAlign: "center" }}>Inga meddelanden ännu.</p> : chatMessages.map((message) => <div key={message.id} style={{ display: "flex", justifyContent: message.sender_user_id === user.id ? "flex-end" : "flex-start", marginBottom: "0.5rem" }}><span style={{ maxWidth: "78%", padding: "0.6rem 0.75rem", borderRadius: 12, background: message.sender_user_id === user.id ? "#111" : "#f1f1f1", color: message.sender_user_id === user.id ? "#fff" : "#111", fontSize: "0.84rem", lineHeight: 1.4 }}>{message.message_text}</span></div>)}
              </div>
              <form onSubmit={(event) => void sendCompanyMessage(event)} style={{ display: "flex", gap: "0.45rem", padding: "0.75rem", borderTop: "1px solid #e8e8e8" }}><input className="input-field" value={chatDraft} onChange={(event) => setChatDraft(event.target.value)} placeholder="Skriv ett meddelande..." /><button type="submit" className="cta-btn" style={{ padding: "0 0.9rem" }}>Skicka</button></form>
            </> : <div style={{ display: "grid", placeItems: "center", flex: 1, minHeight: 450, padding: "2rem", textAlign: "center" }}><p style={{ margin: 0, color: "#737373", fontSize: "0.9rem" }}>Välj en kandidat med en aktiv chatt.</p></div>}
          </section>
        </div>
      )}

      {/* ── NY ANNONS TAB ── */}
      {tab === "skapa" && (
        <form className="card" style={{ padding: "1.25rem" }} onSubmit={(e) => void handleCreateJob(e)}>
          <div style={{ display: "grid", gridTemplateColumns: "minmax(180px, 0.9fr) minmax(0, 1.1fr)", gap: "1.25rem", alignItems: "stretch", padding: "0.35rem", marginBottom: "1.5rem", border: "1px solid #e8e8e8", borderRadius: 18, background: "#fafafa" }}>
            <label style={{ minHeight: 230, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "0.55rem", overflow: "hidden", border: "1.5px dashed #cfd8d0", borderRadius: 14, padding: "0.75rem", textAlign: "center", cursor: "pointer", background: "#fff" }}>
              <input
                type="file"
                accept=".jpg,.jpeg,.png,.webp"
                multiple
                style={{ display: "none" }}
                onChange={(e) => {
                  const files = Array.from(e.target.files ?? []);
                  setJobImageFiles(files);
                  setJobImagePreviews(files.map((file) => URL.createObjectURL(file)));
                }}
              />
              {jobImagePreviews.length > 0 ? (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "0.35rem", width: "100%", height: "100%" }}>
                  {jobImagePreviews.map((preview, index) => (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img key={preview} src={preview} alt={`Förhandsgranskning ${index + 1}`} style={{ width: "100%", height: 100, objectFit: "cover", borderRadius: 9 }} />
                  ))}
                </div>
              ) : (
                <><span style={{ fontSize: "2.2rem" }}>🖼️</span><strong style={{ color: "#111", fontSize: "0.95rem" }}>Lägg till bilder</strong><span style={{ color: "#737373", fontSize: "0.78rem" }}>En eller flera · JPG, PNG eller WEBP</span></>
              )}
            </label>
            <div style={{ display: "flex", flexDirection: "column", justifyContent: "flex-start", padding: "1.5rem 1rem 1rem 0.25rem" }}>
              <label style={{ fontSize: "0.78rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "#737373", display: "block", marginBottom: "0.45rem" }}>Jobbtitel *</label>
              <input className="h-11 w-full rounded-xl border border-[#e8e8e8] px-3 text-base" style={{ height: 54, marginBottom: "0.55rem", background: "#fff" }} placeholder="T.ex. Butikssäljare" list="company-job-title-suggestions" value={form.title} onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))} required />
              <p style={{ margin: 0, color: "#737373", fontSize: "1.15rem", fontWeight: 600 }}>{companyProfile?.company_name || user?.email || "Ditt företag"}</p>
              <button type="button" onClick={() => void handleAiGenerate()} disabled={generatingAi} style={{ alignSelf: "flex-start", marginTop: "1rem", padding: "0.6rem 0.8rem", border: "1px solid #e8c98d", borderRadius: 10, color: "#755315", background: "#fff8e8", fontSize: "0.78rem", fontWeight: 700, cursor: generatingAi ? "wait" : "pointer" }}>
                {generatingAi ? "AI skriver..." : "Låt AI skapa min annons"}
              </button>
              <div style={{ display: "flex", gap: "0.45rem", marginTop: "0.85rem" }}>
                {SOCIAL_NETWORKS.map((network) => {
                  const href = socialHref(companyProfile?.[network.key]);
                  if (!href) return null;
                  return <a key={network.key} href={href} target="_blank" rel="noreferrer" aria-label={network.label} title={network.label} style={{ display: "grid", placeItems: "center", width: 28, height: 28, borderRadius: "50%", color: "#fff", background: network.color, textDecoration: "none", fontSize: network.key === "linkedin_url" ? "0.72rem" : "0.95rem", fontWeight: 800 }}>{network.mark}</a>;
                })}
              </div>
            </div>
          </div>

          <div className="job-creation-details" style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)", gap: "1.5rem", minHeight: 520 }}>
            <div>
              <h3 style={{ margin: "0 0 0.8rem", color: "#111", fontSize: "1.15rem", fontWeight: 800 }}>Om jobbet</h3>
              <textarea
                rows={7}
                className="w-full rounded-xl border border-[#e8e8e8] px-3 py-3 text-sm"
                style={{ marginBottom: "1.2rem", resize: "vertical" }}
                placeholder="Beskriv jobbet och arbetsuppgifterna..."
                value={form.description}
                onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
                required
              />
              <h3 style={{ margin: "0 0 0.8rem", color: "#111", fontSize: "1rem", fontWeight: 800 }}>Adress</h3>
              <div style={{ display: "grid", gap: "0.65rem" }}>
                <input className="input-field" placeholder="Stad" list="company-city-suggestions" value={form.city} onChange={(e) => setForm((p) => ({ ...p, city: e.target.value }))} required />
                <input className="input-field" placeholder="Adress" list="company-address-suggestions" value={form.address} onChange={(e) => setForm((p) => ({ ...p, address: e.target.value }))} required />
                <input className="input-field" placeholder="Postnummer" value={form.postalCode} onChange={(e) => setForm((p) => ({ ...p, postalCode: e.target.value }))} required />
              </div>
            </div>

            <div>
              <h3 style={{ margin: "0 0 0.8rem", color: "#111", fontSize: "1rem", fontWeight: 800 }}>Typ av jobb</h3>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem", marginBottom: "1.5rem" }}>
                {JOB_TYPES.map((type) => (
                  <button key={type} type="button" aria-pressed={form.category === type} onClick={() => setForm((p) => ({ ...p, category: p.category === type ? "" : type }))} className="chip" style={{ border: form.category === type ? "1.5px solid #111" : "1px solid #e8e8e8", background: form.category === type ? "#111" : "#f5f5f5", color: form.category === type ? "#fff" : "#555", cursor: "pointer" }}>{type}</button>
                ))}
              </div>

              <h3 style={{ margin: "0 0 0.65rem", color: "#111", fontSize: "1rem", fontWeight: 800 }}>Förmåner <span style={{ color: "#a3a3a3", fontSize: "0.75rem", fontWeight: 500 }}>(valfritt)</span></h3>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem", marginBottom: "0.65rem" }}>
                {BENEFIT_TIPS.map((tip) => {
                  const selected = form.benefits.split(",").map((item) => item.trim()).includes(tip);
                  return <button key={tip} type="button" onClick={() => setForm((p) => ({ ...p, benefits: toggleTextList(p.benefits, tip) }))} className="chip" style={{ border: selected ? "1.5px solid #111" : "1px solid #e8e8e8", background: selected ? "#111" : "#f5f5f5", color: selected ? "#fff" : "#555", cursor: "pointer" }}>{tip}</button>;
                })}
                <button type="button" className="chip" onClick={() => setShowCustomBenefit((visible) => !visible)} style={{ border: "1px solid #e8e8e8", background: "#fff", color: "#555", cursor: "pointer", fontWeight: 800 }} aria-label="Lägg till egen förmån">+</button>
              </div>
              {showCustomBenefit && <div style={{ display: "flex", gap: "0.4rem", marginBottom: "0.75rem" }}><input className="input-field" placeholder="Skriv egen förmån" value={customBenefit} onChange={(e) => setCustomBenefit(e.target.value)} /><button type="button" className="secondary-btn" style={{ padding: "0 0.8rem", whiteSpace: "nowrap" }} onClick={() => { if (!customBenefit.trim()) return; setForm((p) => ({ ...p, benefits: toggleTextList(p.benefits, customBenefit.trim()) })); setCustomBenefit(""); setShowCustomBenefit(false); }}>Lägg till</button></div>}
              {textListItems(form.benefits).length > 0 && <ul style={{ margin: "0 0 1.5rem", paddingLeft: "1.2rem", color: "#4a4a4a", fontSize: "0.84rem", lineHeight: 1.55 }}>{textListItems(form.benefits).map((benefit) => <li key={benefit}>{benefit}</li>)}</ul>}

              <h3 style={{ margin: "0 0 0.65rem", color: "#111", fontSize: "1rem", fontWeight: 800 }}>Krav <span style={{ color: "#a3a3a3", fontSize: "0.75rem", fontWeight: 500 }}>(valfritt)</span></h3>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem", marginBottom: "0.65rem" }}>
                {REQUIREMENT_TIPS.map((tip) => {
                  const selected = form.requirements.split(",").map((item) => item.trim()).includes(tip);
                  return <button key={tip} type="button" onClick={() => setForm((p) => ({ ...p, requirements: toggleTextList(p.requirements, tip) }))} className="chip" style={{ border: selected ? "1.5px solid #111" : "1px solid #e8e8e8", background: selected ? "#111" : "#f5f5f5", color: selected ? "#fff" : "#555", cursor: "pointer" }}>{tip}</button>;
                })}
                <button type="button" className="chip" onClick={() => setShowCustomRequirement((visible) => !visible)} style={{ border: "1px solid #e8e8e8", background: "#fff", color: "#555", cursor: "pointer", fontWeight: 800 }} aria-label="Lägg till eget krav">+</button>
              </div>
              {showCustomRequirement && <div style={{ display: "flex", gap: "0.4rem", marginBottom: "0.75rem" }}><input className="input-field" placeholder="Skriv eget krav" value={customRequirement} onChange={(e) => setCustomRequirement(e.target.value)} /><button type="button" className="secondary-btn" style={{ padding: "0 0.8rem", whiteSpace: "nowrap" }} onClick={() => { if (!customRequirement.trim()) return; setForm((p) => ({ ...p, requirements: toggleTextList(p.requirements, customRequirement.trim()) })); setCustomRequirement(""); setShowCustomRequirement(false); }}>Lägg till</button></div>}
              {textListItems(form.requirements).length > 0 && <ul style={{ margin: 0, paddingLeft: "1.2rem", color: "#4a4a4a", fontSize: "0.84rem", lineHeight: 1.55 }}>{textListItems(form.requirements).map((requirement) => <li key={requirement}>{requirement}</li>)}</ul>}
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: "0.6rem", marginTop: "1.5rem", paddingTop: "1rem", borderTop: "1px solid #e8e8e8" }}>
            {draftSaved && <span style={{ marginRight: "auto", color: "#26734d", fontSize: "0.8rem", fontWeight: 600 }}>Utkast sparat</span>}
            <button type="button" className="secondary-btn" onClick={handleSaveDraft} style={{ padding: "0.8rem 1.2rem", fontSize: "0.9rem" }}>Spara</button>
            <button type="submit" className="cta-btn" disabled={busy} style={{ padding: "0.8rem 1.2rem", fontSize: "0.9rem" }}>{busy ? "Publicerar..." : "Publicera"}</button>
          </div>
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
            <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
              {jobs.map((job) => {
                const agePart = job.min_age || job.max_age ? `${job.min_age ?? "?"}–${job.max_age ?? "?"} år` : null;
                return (
                  <div key={job.id} className="card" style={{ padding: "1rem 1.1rem" }}>
                    <p style={{ fontWeight: 700, fontSize: "1rem", color: "#111", marginBottom: "0.25rem" }}>{job.title}</p>
                    <p style={{ fontSize: "0.82rem", color: "#737373" }}>{[job.city, job.category, agePart].filter(Boolean).join(" · ")}</p>
                    {job.employment_type && (
                      <div style={{ display: "flex", flexWrap: "wrap", gap: "0.3rem", marginTop: "0.5rem" }}>
                        {job.employment_type.split(",").map((t) => (<span key={t} className="chip">{t.trim()}</span>))}
                      </div>
                    )}
                    <div style={{ display: "inline-block", marginTop: "0.5rem", padding: "0.15rem 0.55rem", borderRadius: 999, fontSize: "0.72rem", fontWeight: 600, background: job.is_active ? "#e8faf0" : "#f5f5f5", color: job.is_active ? "#1a7f4b" : "#a3a3a3" }}>
                      {job.is_active ? "Aktiv" : "Inaktiv"}
                    </div>
                  </div>
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
    </main>
  );
}
