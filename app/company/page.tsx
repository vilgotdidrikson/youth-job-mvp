"use client";

import { FormEvent, Suspense, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useSession } from "@/hooks/use-session";
import { getSupabaseClient } from "@/lib/supabase";
import { getCandidatesForJob, getCompanyJobs as getFeedCompanyJobs } from "@/lib/feeds";
import { createJob, deleteJob, updateJob } from "@/lib/jobs";
import { getMessages, getMyConversations, sendMessage, subscribeToConversationMessages } from "@/lib/chat";
import { reviewCandidate } from "@/lib/matching";
import { uploadJobImage } from "@/lib/storage";
import { ADDRESS_SUGGESTIONS, CITY_SUGGESTIONS, JOB_TITLE_SUGGESTIONS } from "@/lib/form-suggestions";
import type { CandidateFeedItem, ChatMessage, CompanyProfile, ConversationSummary, JobPost, MatchRecord, SwipeDecision } from "@/lib/types";

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

type Tab = "kandidater" | "swipe" | "skapa" | "annonser";

interface JobForm {
  title: string;
  city: string;
  address: string;
  postalCode: string;
  category: string;
  minAge: string;
  maxAge: string;
  salaryFrom: string;
  salaryTo: string;
  salaryType: "timlön" | "månadslön" | "fast lön";
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
  minAge: "",
  maxAge: "",
  salaryFrom: "",
  salaryTo: "",
  salaryType: "timlön",
  description: "",
  benefits: "",
  requirements: "",
};

function CompanyPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, profile, loading } = useSession();

  const [tab, setTab] = useState<Tab>("kandidater");
  const [jobs, setJobs] = useState<JobPost[]>([]);
  const [feed, setFeed] = useState<CandidateFeedItem[]>([]);
  const [feedIndex, setFeedIndex] = useState(0);
  const [companyProfile, setCompanyProfile] = useState<CompanyProfile | null>(null);
  const [busy, setBusy] = useState(false);
  const [jobActionId, setJobActionId] = useState<string | null>(null);
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
    const item = candidateFeed[feedIndex];
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

  const handleCreateJob = async (e: FormEvent) => {
    e.preventDefault();
    if (!form.category) { setError("Välj typ av jobb."); return; }
    if (!form.description.trim()) { setError("Skriv en beskrivning av jobbet."); return; }
    if (!form.city.trim()) { setError("Fyll i vilken stad jobbet finns i."); return; }
    if (!form.address.trim()) { setError("Fyll i arbetsplatsens gatuadress."); return; }
    if (!form.postalCode.trim()) { setError("Fyll i arbetsplatsens postnummer."); return; }
    setBusy(true);
    setError("");
    try {
      const imageUrls = jobImageFiles.length > 0
        ? await Promise.all(jobImageFiles.map((file) => uploadJobImage(file)))
        : [];
      await createJob({
        title: form.title,
        city: form.city,
        address: form.address,
        postal_code: form.postalCode,
        category: form.category,
        employment_type: form.category,
        description: form.description,
        salary_per_hour: form.salaryFrom || form.salaryTo ? `${form.salaryFrom || "?"}–${form.salaryTo || "?"} kr/${form.salaryType === "timlön" ? "tim" : form.salaryType === "månadslön" ? "mån" : "period"}` : "",
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

  const candidateFeed = feed;
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
        <form className="job-builder" onSubmit={(e) => void handleCreateJob(e)}>
          {(() => {
            const checks = [
              { label: "Titel och beskrivning", done: Boolean(form.title.trim() && form.description.trim()) },
              { label: "Plats", done: Boolean(form.city.trim() && form.address.trim() && form.postalCode.trim()) },
              { label: "Omslagsbild", done: jobImageFiles.length > 0 },
              { label: "Lön", done: Boolean(form.salaryFrom || form.salaryTo) },
            ];
            const percent = Math.round((checks.filter((check) => check.done).length / checks.length) * 100);
            const salaryPeriod = form.salaryType === "timlön" ? "tim" : form.salaryType === "månadslön" ? "mån" : "period";
            const salary = form.salaryFrom || form.salaryTo ? `${form.salaryFrom || "?"}–${form.salaryTo || "?"} kr/${salaryPeriod}` : "Lön ej angiven";
            return <>
              <header className="job-builder-heading">
                <div><p>Ny annons</p><h1>Skapa en annons som får fler swipes</h1></div>
                <div className="job-builder-progress" aria-label={`${percent}% klart`}>
                  <div><strong>{percent}% klart</strong><span>En komplett annons syns bättre i flödet.</span></div>
                  <div className="job-builder-progress-track"><i style={{ width: `${percent}%` }} /></div>
                  <ul>{checks.map((check) => <li key={check.label} className={check.done ? "is-done" : ""}><span>{check.done ? "✓" : "○"}</span>{check.label}</li>)}</ul>
                </div>
              </header>
              <div className="job-builder-layout">
                <div className="job-builder-form">
                  <section className="card job-builder-section">
                    <div className="job-builder-section-title"><div><h2>Om jobbet</h2><p className="job-builder-help">Berätta vad kandidaten faktiskt får göra.</p></div><button type="button" onClick={() => void handleAiGenerate()} disabled={generatingAi} className="job-builder-ai">{generatingAi ? "AI skriver..." : "✦ Låt AI skapa min annons"}</button></div>
                    <label className="job-builder-title-field">Arbetstitel *<input className="input-field" placeholder="T.ex. Butikssäljare" list="company-job-title-suggestions" value={form.title} onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))} required /></label>
                    <textarea rows={7} className="job-builder-textarea job-builder-description" placeholder="Beskriv jobbet och arbetsuppgifterna..." value={form.description} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} required />
                    <label className="job-builder-label" style={{ marginTop: "1rem" }}>Typ av jobb *</label><div className="job-builder-chips">{JOB_TYPES.map((type) => <button key={type} type="button" aria-pressed={form.category === type} onClick={() => setForm((p) => ({ ...p, category: p.category === type ? "" : type }))} className={`chip ${form.category === type ? "job-builder-chip-selected" : ""}`}>{type}</button>)}</div>
                  </section>
                  <section className="card job-builder-section">
                    <h2>Krav och förmåner</h2><p className="job-builder-help">Gör det tydligt vad jobbet kräver och erbjuder.</p>
                    <div className="job-builder-age"><span>Åldersspann <em>(valfritt)</em></span><div><label>Ålder från<input className="input-field" type="number" min="13" max="30" placeholder="T.ex. 16" value={form.minAge} onChange={(e) => setForm((p) => ({ ...p, minAge: e.target.value }))} /></label><b>—</b><label>Ålder till<input className="input-field" type="number" min="13" max="30" placeholder="T.ex. 19" value={form.maxAge} onChange={(e) => setForm((p) => ({ ...p, maxAge: e.target.value }))} /></label></div></div>
                    <div className="job-builder-tags">
                      <div><h3>Förmåner <span>(valfritt)</span></h3><div className="job-builder-chips">{BENEFIT_TIPS.map((tip) => { const selected = textListItems(form.benefits).includes(tip); return <button key={tip} type="button" onClick={() => setForm((p) => ({ ...p, benefits: toggleTextList(p.benefits, tip) }))} className={`chip ${selected ? "job-builder-chip-selected" : ""}`}>{tip}</button>; })}<button type="button" className="chip" onClick={() => setShowCustomBenefit((visible) => !visible)}>+</button></div>{showCustomBenefit && <div className="job-builder-custom"><input className="input-field" placeholder="Skriv egen förmån" value={customBenefit} onChange={(e) => setCustomBenefit(e.target.value)} /><button type="button" className="secondary-btn" onClick={() => { if (customBenefit.trim()) { setForm((p) => ({ ...p, benefits: toggleTextList(p.benefits, customBenefit.trim()) })); setCustomBenefit(""); setShowCustomBenefit(false); } }}>Lägg till</button></div>}</div>
                      <div><h3>Krav <span>(valfritt)</span></h3><div className="job-builder-chips">{REQUIREMENT_TIPS.map((tip) => { const selected = textListItems(form.requirements).includes(tip); return <button key={tip} type="button" onClick={() => setForm((p) => ({ ...p, requirements: toggleTextList(p.requirements, tip) }))} className={`chip ${selected ? "job-builder-chip-selected" : ""}`}>{tip}</button>; })}<button type="button" className="chip" onClick={() => setShowCustomRequirement((visible) => !visible)}>+</button></div>{showCustomRequirement && <div className="job-builder-custom"><input className="input-field" placeholder="Skriv eget krav" value={customRequirement} onChange={(e) => setCustomRequirement(e.target.value)} /><button type="button" className="secondary-btn" onClick={() => { if (customRequirement.trim()) { setForm((p) => ({ ...p, requirements: toggleTextList(p.requirements, customRequirement.trim()) })); setCustomRequirement(""); setShowCustomRequirement(false); } }}>Lägg till</button></div>}</div>
                    </div>
                  </section>
                  <section className="card job-builder-section"><h2>Lön <span className="job-builder-optional">Valfritt</span></h2><div className="job-builder-info">✦ Annonser med angiven lön får ofta fler ansökningar.</div><label className="job-builder-label">Lönetyp</label><div className="job-builder-chips">{(["timlön", "månadslön", "fast lön"] as const).map((type) => <button key={type} type="button" onClick={() => setForm((p) => ({ ...p, salaryType: type }))} className={`chip ${form.salaryType === type ? "job-builder-chip-selected" : ""}`}>{type}</button>)}</div><div className="job-builder-salary"><label>Lön från<input className="input-field" inputMode="numeric" placeholder="T.ex. 120" value={form.salaryFrom} onChange={(e) => setForm((p) => ({ ...p, salaryFrom: e.target.value }))} /></label><span>—</span><label>Lön till<input className="input-field" inputMode="numeric" placeholder="T.ex. 145" value={form.salaryTo} onChange={(e) => setForm((p) => ({ ...p, salaryTo: e.target.value }))} /></label><em>kr/{form.salaryType === "timlön" ? "tim" : form.salaryType === "månadslön" ? "mån" : "period"}</em></div></section>
                  <section className="card job-builder-section"><h2>Adress</h2><p className="job-builder-help">Den fullständiga adressen används för att placera jobbet på kartan.</p><div className="job-builder-fields two-columns"><label>Gatuadress *<input className="input-field" placeholder="T.ex. Storgatan 12" list="company-address-suggestions" autoComplete="street-address" value={form.address} onChange={(e) => setForm((p) => ({ ...p, address: e.target.value }))} required /></label><label>Postnummer *<input className="input-field" placeholder="123 45" autoComplete="postal-code" inputMode="numeric" value={form.postalCode} onChange={(e) => setForm((p) => ({ ...p, postalCode: e.target.value }))} required /></label><label>Stad *<input className="input-field" placeholder="T.ex. Stockholm" list="company-city-suggestions" value={form.city} onChange={(e) => setForm((p) => ({ ...p, city: e.target.value }))} required /></label></div></section>
                  <section className="card job-builder-section"><h2>Omslagsbild</h2><p className="job-builder-help">En bild gör att annonsen sticker ut i flödet.</p><label className="job-builder-dropzone"><input type="file" accept=".jpg,.jpeg,.png,.webp" multiple onChange={(e) => { const files = Array.from(e.target.files ?? []); setJobImageFiles(files); setJobImagePreviews(files.map((file) => URL.createObjectURL(file))); }} />{jobImagePreviews.length ? <div className="job-builder-image-grid">{jobImagePreviews.map((preview, index) => <img key={preview} src={preview} alt={`Förhandsgranskning ${index + 1}`} />)}</div> : <><b>↑</b><strong>Lägg till omslagsbild</strong><span>JPG, PNG eller WEBP</span></>}</label></section>
                </div>
                <aside className="job-builder-preview"><p>Så här ser annonsen ut</p><article className="job-preview-detail"><div className="job-preview-image">{jobImagePreviews[0] ? <img src={jobImagePreviews[0]} alt="Omslag för annonsen" /> : <span>💼</span>}</div><div className="job-preview-detail-layout"><div><p className="job-preview-company">{companyProfile?.company_name || user?.email || "Ditt företag"}</p><h2>{form.title || "Din jobbtitel"}</h2><section><h3>Om jobbet</h3><p>{form.description || "Här visas arbetsbeskrivningen när du börjar skriva."}</p></section><section><h3>Tider</h3><p>{form.category || "Välj deltid, heltid eller annan jobbtyp"}</p></section></div><div className="job-preview-facts"><section><h3>Krav</h3><p>{[form.minAge || form.maxAge ? `${form.minAge || "?"}–${form.maxAge || "?"} år` : "", ...textListItems(form.requirements)].filter(Boolean).join(" · ") || "Inga särskilda krav"}</p></section><section><h3>Förmåner</h3><p>{textListItems(form.benefits).join(" · ") || "Inga förmåner angivna"}</p></section><section><h3>Lön</h3><p>{salary}</p></section><section><h3>Adress</h3><p>{[form.address, form.postalCode, form.city].filter(Boolean).join(", ") || "Adress"}</p></section></div></div></article><small>Förhandsvisningen uppdateras medan du skriver.</small></aside>
              </div>
              <div className="job-builder-actions">{draftSaved && <span>Utkast sparat</span>}<button type="button" className="secondary-btn" onClick={handleSaveDraft}>Spara utkast</button><button type="submit" className="cta-btn" disabled={busy}>{busy ? "Publicerar..." : "Publicera annons"}</button></div>
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
            <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
              {jobs.map((job) => {
                const agePart = job.min_age || job.max_age ? `${job.min_age ?? "?"}–${job.max_age ?? "?"} år` : null;
                const status = job.status ?? (job.is_active ? "active" : "paused");
                const isWorking = jobActionId === job.id;
                return (
                  <article key={job.id} className="card job-list-card" style={{ padding: "1rem 1.1rem" }}>
                    <Link href={`/jobb/${job.id}`} style={{ color: "inherit", textDecoration: "none" }}>
                    <p style={{ fontWeight: 700, fontSize: "1rem", color: "#111", marginBottom: "0.25rem" }}>{job.title}</p>
                    <p style={{ fontSize: "0.82rem", color: "#737373" }}>{[[job.address, job.postal_code, job.city].filter(Boolean).join(", "), job.category, agePart].filter(Boolean).join(" · ")}</p>
                    {job.employment_type && (
                      <div style={{ display: "flex", flexWrap: "wrap", gap: "0.3rem", marginTop: "0.5rem" }}>
                        {job.employment_type.split(",").map((t) => (<span key={t} className="chip">{t.trim()}</span>))}
                      </div>
                    )}
                    <div style={{ display: "inline-block", marginTop: "0.5rem", padding: "0.15rem 0.55rem", borderRadius: 999, fontSize: "0.72rem", fontWeight: 600, background: status === "active" ? "#e8faf0" : "#f5f5f5", color: status === "active" ? "#1a7f4b" : "#a3a3a3" }}>
                      {status === "active" ? "Aktiv" : status === "paused" ? "Pausad" : "Stängd"}
                    </div>
                    <span className="job-list-card-link">Visa hela annonsen →</span>
                    </Link>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: ".45rem", marginTop: ".8rem" }}>
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
    </main>
  );
}

export default function CompanyPage() {
  return <Suspense fallback={<main className="mobile-shell map-page-loading"><p>Laddar...</p></main>}><CompanyPageContent /></Suspense>;
}
