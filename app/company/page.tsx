"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "@/hooks/use-session";
import { getSupabaseClient } from "@/lib/supabase";
import { getCandidatesForJob, getCompanyJobs as getFeedCompanyJobs } from "@/lib/feeds";
import { createJob } from "@/lib/jobs";
import { reviewCandidate } from "@/lib/matching";
import { uploadJobImage } from "@/lib/storage";
import type { CandidateFeedItem, CompanyProfile, JobPost, MatchRecord, SwipeDecision, YouthDocumentType } from "@/lib/types";

const JOB_CATEGORIES = [
  "Café/restaurang",
  "Butik",
  "Barnomsorg",
  "Idrott",
  "Event",
  "Lager",
  "Leverans",
  "Kundtjänst",
  "Administration",
  "Handledare",
  "Sociala medier",
  "Övrigt",
];

const TIME_OPTIONS = ["Deltid", "Heltid", "Sommarjobb", "Helgjobb", "Extra vid behov"];

const DOC_TYPE_LABELS: Record<YouthDocumentType, string> = {
  grades: "Betyg",
  recommendation: "Rekommendationsbrev",
  certificate: "Intyg",
  other: "Övrigt",
};

type Tab = "kandidater" | "skapa" | "annonser";

interface JobForm {
  title: string;
  city: string;
  category: string;
  timePrefs: string[];
  minAge: string;
  maxAge: string;
  pay: string;
  description: string;
}

const EMPTY_FORM: JobForm = {
  title: "",
  city: "",
  category: "",
  timePrefs: [],
  minAge: "",
  maxAge: "",
  pay: "",
  description: "",
};

function toggleItem(arr: string[], item: string): string[] {
  return arr.includes(item) ? arr.filter((x) => x !== item) : [...arr, item];
}

export default function CompanyPage() {
  const router = useRouter();
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
  const [jobImageFile, setJobImageFile] = useState<File | null>(null);
  const [jobImagePreview, setJobImagePreview] = useState<string>("");
  const [candidateDragX, setCandidateDragX] = useState(0);
  const [candidateIsDragging, setCandidateIsDragging] = useState(false);
  const [candidateFlyDir, setCandidateFlyDir] = useState<"left" | "right" | null>(null);
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
      router.replace("/auth");
      return;
    }
    if (!loading && user && profile?.role === "company") {
      void loadData(user.id);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, user, profile?.role]);

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
    const item = feed[feedIndex];
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
    if (!form.timePrefs.length) { setError("Välj minst en arbetstid."); return; }
    setBusy(true);
    setError("");
    try {
      let imageUrl = "";
      if (jobImageFile) {
        imageUrl = await uploadJobImage(jobImageFile);
      }
      await createJob({
        title: form.title,
        city: form.city,
        category: form.category,
        employment_type: form.timePrefs.join(","),
        description: form.description,
        salary_per_hour: form.pay,
        requirements: "",
        benefits: "",
        company_name: companyProfile?.company_name || user?.email || "Företag",
        image_url: imageUrl || "",
        min_age: form.minAge ? parseInt(form.minAge, 10) : null,
        max_age: form.maxAge ? parseInt(form.maxAge, 10) : null,
      });
      setForm(EMPTY_FORM);
      setJobImageFile(null);
      setJobImagePreview("");
      if (user) await loadData(user.id);
      setTab("annonser");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Kunde inte skapa annonsen.");
    } finally {
      setBusy(false);
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

  const currentCandidate = feed[feedIndex] ?? null;
  const remainingCount = feed.length - feedIndex;
  const candidateFlyX = candidateFlyDir === "right" ? 600 : candidateFlyDir === "left" ? -600 : candidateDragX;
  const candidateFlyRot = candidateFlyDir === "right" ? 12 : candidateFlyDir === "left" ? -12 : candidateDragX * 0.02;
  const candidateJaOpacity = candidateFlyDir === "right" ? 1 : candidateDragX > 20 ? Math.min(candidateDragX / 100, 1) : 0;
  const candidateNejOpacity = candidateFlyDir === "left" ? 1 : candidateDragX < -20 ? Math.min(-candidateDragX / 100, 1) : 0;

  return (
    <main className="mobile-shell">
      {/* Header */}
      <div style={{ marginBottom: "1.25rem", paddingTop: "0.5rem" }}>
        <p style={{ fontSize: "0.7rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#a3a3a3", margin: 0 }}>
          WorkSpot
        </p>
        <h1 style={{ fontSize: "1.6rem", fontWeight: 800, letterSpacing: "-0.03em", color: "#111111", margin: "0.2rem 0 0" }}>
          {companyProfile?.company_name || "Företagskonto"}
        </h1>
      </div>

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
      <div style={{ display: "flex", gap: "0.4rem", marginBottom: "1rem" }}>
        {(["kandidater", "skapa", "annonser"] as const).map((t) => (
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
            {t === "kandidater"
              ? `Kandidater${remainingCount > 0 ? ` (${remainingCount})` : ""}`
              : t === "skapa"
              ? "Ny annons"
              : `Annonser${jobs.length > 0 ? ` (${jobs.length})` : ""}`}
          </button>
        ))}
      </div>

      {error && (
        <div style={{ borderRadius: 10, background: "#fff1f0", border: "1px solid #ffd6d3", padding: "0.75rem 1rem", fontSize: "0.85rem", color: "#c0392b", marginBottom: "1rem" }}>
          {error}
        </div>
      )}

      {/* ── KANDIDATER TAB ── */}
      {tab === "kandidater" && (
        <div>
          {jobs.length === 0 ? (
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
                {[currentCandidate.profile?.age && `${currentCandidate.profile.age} år`, currentCandidate.profile?.city].filter(Boolean).join(" · ")}
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
                    {currentCandidate.profile.cv_text.slice(0, 250)}{currentCandidate.profile.cv_text.length > 250 ? "\u2026" : ""}
                  </div>
                  {currentCandidate.profile.cv_text.length > 250 && (
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

      {/* ── NY ANNONS TAB ── */}
      {tab === "skapa" && (
        <form className="card" style={{ padding: "1.25rem" }} onSubmit={(e) => void handleCreateJob(e)}>
          <h2 style={{ fontSize: "1.15rem", fontWeight: 700, color: "#111", marginBottom: "1.1rem" }}>Skapa jobbannons</h2>

          <label style={{ fontSize: "0.78rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "#737373", display: "block", marginBottom: "0.35rem" }}>Annonstitel *</label>
          <input className="h-11 w-full rounded-xl border border-[#e8e8e8] px-3 text-sm" style={{ marginBottom: "0.85rem" }} placeholder="T.ex. Butikssäljare, Sommarjobbare" value={form.title} onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))} required />

          <label style={{ fontSize: "0.78rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "#737373", display: "block", marginBottom: "0.35rem" }}>Stad *</label>
          <input className="h-11 w-full rounded-xl border border-[#e8e8e8] px-3 text-sm" style={{ marginBottom: "0.85rem" }} placeholder="T.ex. Stockholm" value={form.city} onChange={(e) => setForm((p) => ({ ...p, city: e.target.value }))} required />

          <label style={{ fontSize: "0.78rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "#737373", display: "block", marginBottom: "0.5rem" }}>Typ av jobb *</label>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem", marginBottom: "0.85rem" }}>
            {JOB_CATEGORIES.map((cat) => (
              <button key={cat} type="button" onClick={() => setForm((p) => ({ ...p, category: p.category === cat ? "" : cat }))}
                style={{ padding: "0.35rem 0.75rem", borderRadius: 999, fontSize: "0.82rem", fontWeight: 500, border: "1.5px solid", borderColor: form.category === cat ? "#111" : "#e8e8e8", background: form.category === cat ? "#111" : "#f5f5f5", color: form.category === cat ? "#fff" : "#555", cursor: "pointer" }}>
                {cat}
              </button>
            ))}
          </div>

          <label style={{ fontSize: "0.78rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "#737373", display: "block", marginBottom: "0.5rem" }}>Arbetstider * <span style={{ fontWeight: 400, textTransform: "none", letterSpacing: 0 }}>(välj en eller flera)</span></label>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem", marginBottom: "0.85rem" }}>
            {TIME_OPTIONS.map((opt) => (
              <button key={opt} type="button" onClick={() => setForm((p) => ({ ...p, timePrefs: toggleItem(p.timePrefs, opt) }))}
                style={{ padding: "0.35rem 0.75rem", borderRadius: 999, fontSize: "0.82rem", fontWeight: 500, border: "1.5px solid", borderColor: form.timePrefs.includes(opt) ? "#111" : "#e8e8e8", background: form.timePrefs.includes(opt) ? "#111" : "#f5f5f5", color: form.timePrefs.includes(opt) ? "#fff" : "#555", cursor: "pointer" }}>
                {opt}
              </button>
            ))}
          </div>

          <label style={{ fontSize: "0.78rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "#737373", display: "block", marginBottom: "0.35rem" }}>Ålderskrav (valfritt)</label>
          <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", marginBottom: "0.85rem" }}>
            <input type="number" min={13} max={30} className="h-11 rounded-xl border border-[#e8e8e8] px-3 text-sm" style={{ flex: 1 }} placeholder="Min ålder" value={form.minAge} onChange={(e) => setForm((p) => ({ ...p, minAge: e.target.value }))} />
            <span style={{ color: "#a3a3a3", fontWeight: 600 }}>–</span>
            <input type="number" min={13} max={30} className="h-11 rounded-xl border border-[#e8e8e8] px-3 text-sm" style={{ flex: 1 }} placeholder="Max ålder" value={form.maxAge} onChange={(e) => setForm((p) => ({ ...p, maxAge: e.target.value }))} />
          </div>

          <label style={{ fontSize: "0.78rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "#737373", display: "block", marginBottom: "0.35rem" }}>Timlön (valfritt)</label>
          <input className="h-11 w-full rounded-xl border border-[#e8e8e8] px-3 text-sm" style={{ marginBottom: "0.85rem" }} placeholder="T.ex. 130 kr/h" value={form.pay} onChange={(e) => setForm((p) => ({ ...p, pay: e.target.value }))} />

          <label style={{ fontSize: "0.78rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "#737373", display: "block", marginBottom: "0.35rem" }}>Omslagsbild (valfritt)</label>
          <label
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: "0.4rem",
              border: "1.5px dashed #e8e8e8",
              borderRadius: 12,
              padding: jobImagePreview ? "0.5rem" : "1.25rem",
              textAlign: "center",
              cursor: "pointer",
              marginBottom: "0.85rem",
              overflow: "hidden",
            }}
          >
            <input
              type="file"
              accept=".jpg,.jpeg,.png,.webp"
              style={{ display: "none" }}
              onChange={(e) => {
                const f = e.target.files?.[0] ?? null;
                setJobImageFile(f);
                setJobImagePreview(f ? URL.createObjectURL(f) : "");
              }}
            />
            {jobImagePreview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={jobImagePreview} alt="Förhandsgranskning" style={{ width: "100%", maxHeight: 160, objectFit: "cover", borderRadius: 8 }} />
            ) : (
              <>
                <span style={{ fontSize: "1.5rem" }}>🖼️</span>
                <p style={{ fontSize: "0.85rem", color: "#737373", margin: 0 }}>Välj en bild för annonsen</p>
                <p style={{ fontSize: "0.75rem", color: "#a3a3a3", margin: 0 }}>JPG eller PNG · rekommenderat 1200×630</p>
              </>
            )}
          </label>
          {jobImagePreview && (
            <button
              type="button"
              onClick={() => { setJobImageFile(null); setJobImagePreview(""); }}
              style={{ fontSize: "0.78rem", color: "#737373", background: "none", border: "none", cursor: "pointer", padding: 0, marginBottom: "0.85rem", textDecoration: "underline" }}
            >
              Ta bort bild
            </button>
          )}

          <label style={{ fontSize: "0.78rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "#737373", display: "block", marginBottom: "0.35rem" }}>Beskrivning *</label>
          <textarea rows={4} className="w-full rounded-xl border border-[#e8e8e8] px-3 py-3 text-sm" style={{ marginBottom: "1.1rem" }} placeholder="Beskriv jobbet, arbetsuppgifter och vad ni erbjuder..." value={form.description} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} required />

          <button type="submit" className="cta-btn" style={{ width: "100%", padding: "0.9rem", fontSize: "0.95rem" }} disabled={busy}>
            {busy ? "Publicerar..." : "Publicera annons"}
          </button>
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
