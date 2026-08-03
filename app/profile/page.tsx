"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { MinimalProfileSection } from "@/components/profile/minimal-profile-section";
import { ExperienceCard, ProfileHeader, SidebarCard, SkillList } from "@/components/profile/professional-profile";
import { useSession } from "@/hooks/use-session";
import { createCvPdfFile, downloadPdfFile } from "@/lib/cv-pdf";
import { getYouthProfile, saveYouthProfileDraft } from "@/lib/onboarding";
import { uploadYouthDocument } from "@/lib/storage";
import type { YouthDocument, YouthProfile } from "@/lib/types";

interface YouthProfileForm {
  name: string;
  dateOfBirth: string;
  address: string;
  postalCode: string;
  city: string;
  skills: string[];
  experience: string;
  education: string;
  languages: string;
  certificates: string;
  extracurriculars: string;
}

const initialForm: YouthProfileForm = {
  name: "",
  dateOfBirth: "",
  address: "",
  postalCode: "",
  city: "",
  skills: [],
  experience: "",
  education: "",
  languages: "",
  certificates: "",
  extracurriculars: "",
};

function normalizeStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function mapProfileToForm(profile: YouthProfile | null, fallbackName: string): YouthProfileForm {
  if (!profile) {
    return { ...initialForm, name: fallbackName };
  }

  const experienceList = normalizeStringArray(profile.work_experience);

  return {
    name: typeof profile.full_name === "string" && profile.full_name.trim() ? profile.full_name : fallbackName,
    dateOfBirth: typeof profile.date_of_birth === "string" ? profile.date_of_birth : "",
    address: typeof profile.address === "string" ? profile.address : "",
    postalCode: typeof profile.postal_code === "string" ? profile.postal_code : "",
    city: typeof profile.city === "string" ? profile.city : "",
    skills: normalizeStringArray(profile.strengths),
    experience: experienceList.join("\n"),
    education: normalizeStringArray(profile.education).join("\n"),
    languages: normalizeStringArray(profile.languages).join(", "),
    certificates: typeof profile.certificates === "string" ? profile.certificates : "",
    extracurriculars: typeof profile.extracurriculars === "string" ? profile.extracurriculars : "",
  };
}

function hasContent(value: string) {
  return value.trim().length > 0;
}

export default function ProfilePage() {
  const router = useRouter();
const { user, profile, loading, logout } = useSession();

  const [form, setForm] = useState<YouthProfileForm>(initialForm);
  const [saving, setSaving] = useState(false);
  const [savedNote, setSavedNote] = useState("");
  const [loggingOut, setLoggingOut] = useState(false);
  const [generatedCv, setGeneratedCv] = useState("");
  const [cvDocuments, setCvDocuments] = useState<YouthDocument[]>([]);
  const [editingCv, setEditingCv] = useState(false);
  const [cvEditText, setCvEditText] = useState("");
  const [editingProfile, setEditingProfile] = useState(false);
  const [showProfileEditor, setShowProfileEditor] = useState(false);
  const [error, setError] = useState("");

  // ── company profile state ──────────────────────────────────
  const [companyName, setCompanyName] = useState("");
  const [companyCity, setCompanyCity] = useState("");
  const [companyDescription, setCompanyDescription] = useState("");
  const [companyJobCount, setCompanyJobCount] = useState(0);

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/login");
      return;
    }

    if (!loading && user && profile?.role === "company") {
      void (async () => {
        try {
          const { getSupabaseClient } = await import("@/lib/supabase");
          const supabase = getSupabaseClient();
          const [cpResult, jobsResult] = await Promise.all([
            supabase.from("company_profiles").select("*").eq("user_id", user.id).maybeSingle(),
            supabase.from("jobs").select("id").eq("company_user_id", user.id).eq("is_active", true),
          ]);
          if (cpResult.data) {
            setCompanyName((cpResult.data as Record<string, unknown>).company_name as string ?? "");
            setCompanyCity((cpResult.data as Record<string, unknown>).city as string ?? "");
            setCompanyDescription((cpResult.data as Record<string, unknown>).description as string ?? "");
          }
          setCompanyJobCount((jobsResult.data ?? []).length);
          setError("");
        } catch (loadError) {
          setError(loadError instanceof Error ? loadError.message : "Kunde inte ladda företagsprofilen.");
        }
      })();
    }

    if (!loading && user && profile?.role === "youth") {
      const fallbackName = user.email?.split("@")[0] ?? "";

      void (async () => {
        try {
          const youthProfile = await getYouthProfile(user.id);
          setForm(mapProfileToForm(youthProfile, fallbackName));
          const cv = typeof youthProfile?.cv_text === "string" ? youthProfile.cv_text : "";
          setGeneratedCv(cv);
          setCvEditText(cv);
          setCvDocuments(Array.isArray(youthProfile?.documents) ? youthProfile.documents : []);
          setError("");
        } catch (loadError) {
          console.error("Failed to load youth profile.", loadError);
          setForm({ ...initialForm, name: fallbackName });
          setGeneratedCv("");
          setCvEditText("");
          setCvDocuments([]);
          setError(loadError instanceof Error ? loadError.message : "Kunde inte ladda din profil.");
        }
      })();
    }
  }, [loading, profile?.role, router, user]);

  const completedSections = useMemo(() => {
    return {
      personal: hasContent(form.name) && hasContent(form.dateOfBirth) && hasContent(form.address),
      skills: form.skills.length > 0,
      experience: hasContent(form.experience),
      education: hasContent(form.education),
      extras: hasContent(form.languages) || hasContent(form.certificates) || hasContent(form.extracurriculars),
    };
  }, [form]);

  const completion = useMemo(() => {
    const entries = Object.values(completedSections);
    const completeCount = entries.filter(Boolean).length;
    return Math.round((completeCount / entries.length) * 100);
  }, [completedSections]);

  const generatedCvDocument = cvDocuments.find((document) => document.type === "generated_cv");
  const uploadedCvDocument = cvDocuments.find((document) => document.type === "cv");
  const hasGeneratedCv = generatedCv.trim().length > 0;
  const hasCv = hasGeneratedCv || Boolean(uploadedCvDocument);

  const handleSave = async () => {
    setSaving(true);
    try {
      await saveYouthProfileDraft(form);
      setSavedNote("Profil sparad.");
      setEditingProfile(false);
      setError("");
    } catch (saveError) {
      console.error("Failed to save youth profile.", saveError);
      setError(saveError instanceof Error ? saveError.message : "Kunde inte spara profilen.");
      setSavedNote("");
    } finally {
      setSaving(false);
    }
  };

  const handleSaveCv = async () => {
    if (!user?.id) return;
    setSaving(true);
    try {
      const pdfFile = await createCvPdfFile(cvEditText, form.name);
      const pdfUrl = await uploadYouthDocument(pdfFile);
      const updatedDocuments = [
        ...cvDocuments.filter((document) => document.type !== "generated_cv"),
        { name: pdfFile.name, url: pdfUrl, type: "generated_cv" as const },
      ];
      const supabase = (await import("@/lib/supabase")).getSupabaseClient();
      const { error: cvError } = await supabase
        .from("youth_profiles")
        .update({ cv_text: cvEditText, cv_generated: true, documents: updatedDocuments })
        .eq("user_id", user.id);
      if (cvError) throw new Error(cvError.message);
      setGeneratedCv(cvEditText);
      setCvDocuments(updatedDocuments);
      setEditingCv(false);
      setError("");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Kunde inte spara CV.");
    } finally {
      setSaving(false);
    }
  };

  const handleCreatePdfForExistingCv = async () => {
    if (!user?.id || !generatedCv.trim()) return;
    setSaving(true);
    try {
      const pdfFile = await createCvPdfFile(generatedCv, form.name);
      const pdfUrl = await uploadYouthDocument(pdfFile);
      const updatedDocuments = [
        ...cvDocuments.filter((document) => document.type !== "generated_cv"),
        { name: pdfFile.name, url: pdfUrl, type: "generated_cv" as const },
      ];
      const supabase = (await import("@/lib/supabase")).getSupabaseClient();
      const { error: cvError } = await supabase
        .from("youth_profiles")
        .update({ documents: updatedDocuments, cv_generated: true })
        .eq("user_id", user.id);
      if (cvError) throw new Error(cvError.message);
      setCvDocuments(updatedDocuments);
      downloadPdfFile(pdfFile);
      setError("");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Kunde inte skapa PDF-versionen av ditt CV.");
    } finally {
      setSaving(false);
    }
  };

  const handleSaveCompanyProfile = async () => {
    if (!user?.id) return;
    setSaving(true);
    setError("");
    try {
      const { getSupabaseClient } = await import("@/lib/supabase");
      const supabase = getSupabaseClient();
      const { error: dbError } = await supabase
        .from("company_profiles")
        .update({
          company_name: companyName.trim(),
          city: companyCity.trim(),
          description: companyDescription.trim(),
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", user.id);
      if (dbError) throw new Error(dbError.message);
      setSavedNote("Profil sparad.");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Kunde inte spara.");
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = async () => {
    setLoggingOut(true);
    await logout();
    router.replace("/login");
  };

  if (loading || !user) {
    return (
      <main className="mobile-shell" style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
        <p style={{ color: "#737373", fontSize: "0.9rem" }}>Laddar din profil...</p>
      </main>
    );
  }

  if (profile?.role === "company") {
    const labelStyle: React.CSSProperties = {
      fontSize: "0.78rem",
      fontWeight: 700,
      textTransform: "uppercase",
      letterSpacing: "0.06em",
      color: "#737373",
      display: "block",
      marginBottom: "0.35rem",
    };

    return (
      <main className="mobile-shell pb-20">
        {/* Header */}
        <div style={{ marginBottom: "1.5rem", paddingTop: "0.5rem" }}>
          <p style={{ fontSize: "0.7rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#a3a3a3", margin: 0 }}>Employo</p>
          <h1 style={{ fontSize: "1.6rem", fontWeight: 800, letterSpacing: "-0.03em", color: "#111", margin: "0.2rem 0 0" }}>
            {companyName || "Företagsprofil"}
          </h1>
          <p style={{ marginTop: "0.25rem", fontSize: "0.85rem", color: "#737373" }}>{user.email}</p>
        </div>

        {error && (
          <div style={{ borderRadius: 10, background: "#fff1f0", border: "1px solid #ffd6d3", padding: "0.75rem 1rem", fontSize: "0.85rem", color: "#c0392b", marginBottom: "1rem" }}>
            {error}
          </div>
        )}
        {savedNote && (
          <div style={{ borderRadius: 10, background: "#e8faf0", border: "1px solid #b6e8cf", padding: "0.65rem 1rem", fontSize: "0.85rem", color: "#1a7f4b", marginBottom: "1rem" }}>
            {savedNote}
          </div>
        )}

        {/* Stats */}
        <div className="card" style={{ padding: "1rem 1.25rem", marginBottom: "0.75rem", display: "flex", gap: "1.5rem" }}>
          <div>
            <p style={{ fontSize: "1.6rem", fontWeight: 800, color: "#111", margin: 0, lineHeight: 1 }}>{companyJobCount}</p>
            <p style={{ fontSize: "0.78rem", color: "#737373", marginTop: "0.2rem" }}>Aktiva annonser</p>
          </div>
        </div>

        {/* Edit form */}
        <div className="card" style={{ padding: "1.25rem", marginBottom: "0.75rem" }}>
          <p style={{ fontSize: "0.72rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#a3a3a3", marginBottom: "1rem" }}>Redigera profil</p>

          <label style={labelStyle}>Företagsnamn</label>
          <input
            className="h-11 w-full rounded-xl border border-[#e8e8e8] px-3 text-sm"
            style={{ marginBottom: "0.85rem" }}
            placeholder="T.ex. Bergströms Bageri AB"
            value={companyName}
            onChange={(e) => { setCompanyName(e.target.value); setSavedNote(""); }}
          />

          <label style={labelStyle}>Stad</label>
          <input
            className="h-11 w-full rounded-xl border border-[#e8e8e8] px-3 text-sm"
            style={{ marginBottom: "0.85rem" }}
            placeholder="T.ex. Stockholm"
            value={companyCity}
            onChange={(e) => { setCompanyCity(e.target.value); setSavedNote(""); }}
          />

          <label style={labelStyle}>Beskrivning</label>
          <textarea
            rows={4}
            className="w-full rounded-xl border border-[#e8e8e8] px-3 py-3 text-sm"
            style={{ marginBottom: "1rem" }}
            placeholder="Beskriv er verksamhet kort..."
            value={companyDescription}
            onChange={(e) => { setCompanyDescription(e.target.value); setSavedNote(""); }}
          />

          <button
            type="button"
            className="cta-btn"
            style={{ width: "100%", padding: "0.875rem", fontSize: "0.9rem" }}
            disabled={saving}
            onClick={() => void handleSaveCompanyProfile()}
          >
            {saving ? "Sparar..." : "Spara ändringar"}
          </button>
        </div>

        {/* Quick link to job management */}
        <button
          type="button"
          className="secondary-btn"
          style={{ width: "100%", padding: "0.875rem", fontSize: "0.9rem", marginBottom: "0.75rem", textAlign: "left", display: "flex", justifyContent: "space-between", alignItems: "center" }}
          onClick={() => router.push("/company")}
        >
          <span>Annonser &amp; kandidater</span>
          <span style={{ color: "#a3a3a3" }}>→</span>
        </button>

        {/* Logout */}
        <button
          type="button"
          className="secondary-btn"
          style={{ width: "100%", padding: "0.875rem", fontSize: "0.9rem", color: "#c0392b", borderColor: "#ffd6d3" }}
          disabled={loggingOut}
          onClick={() => void handleLogout()}
        >
          {loggingOut ? "Loggar ut..." : "Logga ut"}
        </button>
      </main>
    );
  }

  if (profile?.role !== "youth") {
    return (
      <main className="mobile-shell">
        <div className="card" style={{ padding: "1.25rem" }}>
          <h1 style={{ fontSize: "1.1rem", fontWeight: 700, color: "#111111", margin: 0 }}>Den här profilsidan är för ungdomskonton</h1>
          <p style={{ marginTop: "0.4rem", fontSize: "0.85rem", color: "#737373" }}>Logga in med ett ungdomskonto för att bygga din jobbprofil.</p>
        </div>
      </main>
    );
  }

  const profileSections = (
    <div className="minimal-profile-sections">
      <MinimalProfileSection id="work-experience" eyebrow="01 — Erfarenhet" title="Erfarenhet" description="Jobb, hjälp hemma, volontärarbete eller annat du har gjort.">
        <ExperienceCard title="Erfarenhet"><label className="minimal-profile-textarea"><span className="sr-only">Arbetslivserfarenhet</span><textarea value={form.experience} onChange={(e) => { setForm((p) => ({ ...p, experience: e.target.value })); setSavedNote(""); }} rows={6} placeholder="T.ex. barnvaktade för grannar, hjälpte i en butik..." /></label></ExperienceCard>
      </MinimalProfileSection>
      <MinimalProfileSection id="education" eyebrow="02 — Utbildning" title="Utbildning" description="Skola, kurs eller annan utbildning som du har lagt till.">
        <label className="minimal-profile-textarea"><span className="sr-only">Utbildning</span><textarea value={form.education} onChange={(e) => { setForm((p) => ({ ...p, education: e.target.value })); setSavedNote(""); }} rows={5} placeholder="T.ex. Norra gymnasium, grundskolan" /></label>
      </MinimalProfileSection>
      <MinimalProfileSection id="certificates" eyebrow="03 — Meriter" title="Licenser & certifikat" description="Certifikat, licenser och behörigheter du har fått.">
        <label className="minimal-profile-textarea"><span className="sr-only">Licenser och certifikat</span><textarea value={form.certificates} onChange={(e) => { setForm((p) => ({ ...p, certificates: e.target.value })); setSavedNote(""); }} rows={3} placeholder="T.ex. HLR-certifikat eller körkort" /></label>
      </MinimalProfileSection>
      <MinimalProfileSection id="awards" eyebrow="04 — Meriter" title="Utmärkelser & priser" description="Stipendier, fritidsmeriter och andra saker du är stolt över.">
        <label className="minimal-profile-textarea"><span className="sr-only">Utmärkelser och priser</span><textarea value={form.extracurriculars} onChange={(e) => { setForm((p) => ({ ...p, extracurriculars: e.target.value })); setSavedNote(""); }} rows={3} placeholder="T.ex. stipendium, tävling eller föreningsuppdrag" /></label>
      </MinimalProfileSection>
      <MinimalProfileSection id="languages" eyebrow="05 — Språk" title="Språk" description="Språk du kan använda i skolan, på jobbet eller i vardagen.">
        <label className="minimal-profile-textarea"><span className="sr-only">Språk</span><textarea value={form.languages} onChange={(e) => { setForm((p) => ({ ...p, languages: e.target.value })); setSavedNote(""); }} rows={2} placeholder="T.ex. svenska, engelska" /></label>
      </MinimalProfileSection>
    </div>
  );

  return (
    <main className="mobile-shell pb-20 profile-page network-profile-page">
      <ProfileHeader name={form.name} location={form.city} completion={completion} onEdit={() => setShowProfileEditor(true)} />

      {showProfileEditor && (
        <div className="network-profile-modal-backdrop" role="presentation" onMouseDown={() => setShowProfileEditor(false)}>
          <section className="network-profile-modal" role="dialog" aria-modal="true" aria-labelledby="profile-editor-title" onMouseDown={(event) => event.stopPropagation()}>
            <div><h2 id="profile-editor-title">Redigera profil</h2><button type="button" aria-label="Stäng" onClick={() => setShowProfileEditor(false)}>×</button></div>
            <p>Uppgifterna som tidigare visades under Om dig.</p>
            <div className="minimal-profile-fields">
              <label><span>Namn</span><input value={form.name} onChange={(e) => setForm((current) => ({ ...current, name: e.target.value }))} /></label>
              <label><span>Födelsedatum</span><input type="date" value={form.dateOfBirth} onChange={(e) => setForm((current) => ({ ...current, dateOfBirth: e.target.value }))} /></label>
              <label><span>Adress</span><input value={form.address} onChange={(e) => setForm((current) => ({ ...current, address: e.target.value }))} /></label>
              <label><span>Postnummer</span><input value={form.postalCode} onChange={(e) => setForm((current) => ({ ...current, postalCode: e.target.value }))} /></label>
              <label><span>Ort</span><input value={form.city} onChange={(e) => setForm((current) => ({ ...current, city: e.target.value }))} /></label>
            </div>
            <footer><button type="button" onClick={() => setShowProfileEditor(false)}>Avbryt</button><button type="button" onClick={() => { void handleSave(); setShowProfileEditor(false); }} disabled={saving}>{saving ? "Sparar..." : "Spara"}</button></footer>
          </section>
        </div>
      )}

      <div className="network-profile-layout"><div className="network-profile-main">

      {error && (
        <p style={{ borderRadius: 10, background: "#fff1f0", border: "1px solid #ffd6d3", padding: "0.65rem 0.85rem", fontSize: "0.85rem", color: "#c0392b", marginBottom: "0.75rem" }}>
          {error}
        </p>
      )}

      {hasCv ? (
        /* ── CV EXISTS ─────────────────────────────── */
        <>
          {/* CV preview / editor */}
          {hasGeneratedCv ? (
          <section className="card" style={{ padding: "1rem", marginBottom: "0.75rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.6rem" }}>
              <p style={{ fontSize: "0.72rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#a3a3a3", margin: 0 }}>
                Ditt CV
              </p>
              {!editingCv && (
                <button
                  type="button"
                  onClick={() => { setCvEditText(generatedCv); setEditingCv(true); }}
                  style={{ fontSize: "0.8rem", fontWeight: 600, color: "#111111", background: "none", border: "none", cursor: "pointer", padding: 0, whiteSpace: "nowrap", marginLeft: "1rem" }}
                >
                  Redigera
                </button>
              )}
            </div>
            {editingCv ? (
              <>
                <textarea
                  value={cvEditText}
                  onChange={(e) => setCvEditText(e.target.value)}
                  rows={14}
                  style={{
                    width: "100%", boxSizing: "border-box", borderRadius: 10,
                    border: "1.5px solid #e8e8e8", padding: "1rem",
                    fontSize: "0.9rem", fontFamily: "inherit",
                    resize: "vertical", color: "#111111", lineHeight: 1.6, outline: "none", transition: "border-color 0.15s ease",
                  }}
                  onFocus={(e) => e.target.style.borderColor = "#111111"}
                  onBlur={(e) => e.target.style.borderColor = "#e8e8e8"}
                />
                <div style={{ display: "flex", gap: "0.75rem", marginTop: "1rem" }}>
                  <button type="button" onClick={() => void handleSaveCv()} disabled={saving} className="cta-btn" style={{ flex: 1, padding: "0.9rem", fontSize: "0.9rem", fontWeight: 700 }}>
                    {saving ? "Sparar..." : "Spara CV"}
                  </button>
                  <button type="button" onClick={() => setEditingCv(false)} className="secondary-btn" style={{ flex: 1, padding: "0.9rem", fontSize: "0.9rem", fontWeight: 600 }}>
                    Avbryt
                  </button>
                </div>
              </>
            ) : (
              <pre style={{ margin: 0, borderRadius: 10, background: "#f9f9f9", border: "1px solid #e8e8e8", padding: "1rem", fontSize: "0.85rem", whiteSpace: "pre-wrap", color: "#333333", lineHeight: 1.7, maxHeight: "20rem", overflowY: "auto", fontFamily: "inherit" }}>
                {generatedCv}
              </pre>
            )}
            <div style={{ marginTop: "0.75rem" }}>
              {generatedCvDocument ? (
                <a href={generatedCvDocument.url} target="_blank" rel="noreferrer" className="secondary-btn" style={{ display: "block", padding: "0.7rem", textAlign: "center", fontSize: "0.85rem" }}>
                  {"\u00d6ppna CV som PDF"}
                </a>
              ) : (
                <button type="button" onClick={() => void handleCreatePdfForExistingCv()} disabled={saving} className="secondary-btn" style={{ width: "100%", padding: "0.7rem", fontSize: "0.85rem" }}>
                  {saving ? "Skapar PDF..." : "Spara CV som PDF"}
                </button>
              )}
            </div>
          </section>
          ) : (
            <section className="card" style={{ padding: "1rem", marginBottom: "0.75rem" }}>
              <p style={{ fontSize: "0.72rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#a3a3a3", margin: 0 }}>
                Ditt CV
              </p>
              <p style={{ margin: "0.45rem 0 0", fontSize: "0.95rem", fontWeight: 700, color: "#111111" }}>Eget CV uppladdat</p>
              <p style={{ margin: "0.35rem 0 0.8rem", fontSize: "0.84rem", lineHeight: 1.5, color: "#737373" }}>{"Ditt CV \u00e4r klart och du kan nu matchas med jobb."}</p>
              {uploadedCvDocument && (
                <a href={uploadedCvDocument.url} target="_blank" rel="noreferrer" className="cta-btn" style={{ display: "block", padding: "0.7rem", textAlign: "center", fontSize: "0.85rem" }}>
                  {"\u00d6ppna uppladdat CV (PDF)"}
                </a>
              )}
            </section>
          )}

          {/* Edit profile toggle */}
          {!editingProfile ? (
            <button
              type="button"
              className="secondary-btn"
              style={{ width: "100%", padding: "1rem", fontSize: "0.9rem", marginBottom: "1rem", fontWeight: 600 }}
              onClick={() => setEditingProfile(true)}
            >
              Redigera profilinformation
            </button>
          ) : (
            <>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", margin: "0 0 1.5rem 0", paddingBottom: "1rem", borderBottom: "1px solid #e8e8e8" }}>
                <p style={{ fontSize: "0.72rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#a3a3a3", margin: 0 }}>
                  Profilinformation
                </p>
                <button type="button" onClick={() => setEditingProfile(false)} style={{ fontSize: "0.8rem", fontWeight: 600, color: "#737373", background: "none", border: "none", cursor: "pointer", padding: 0 }}>
                  Avbryt
                </button>
              </div>
              <div className="space-y-4">
                {profileSections}
              </div>
              {savedNote && (
                <p style={{ borderRadius: 10, background: "#e8f8f1", border: "1px solid #b9e5d7", padding: "0.8rem 1rem", fontSize: "0.85rem", color: "#226a54", margin: "1rem 0", fontWeight: 500 }}>
                  ✓ {savedNote}
                </p>
              )}
              <button type="button" className="cta-btn" style={{ width: "100%", padding: "1rem", fontSize: "0.9rem", marginTop: "1.5rem", fontWeight: 700 }} onClick={() => void handleSave()} disabled={saving}>
                {saving ? "Sparar..." : "Spara profilinformation"}
              </button>
            </>
          )}
        </>
      ) : (
        /* ── NO CV YET ─────────────────────────────── */
        <>
          <section className="minimal-profile-status" aria-label="Profilens status">
            <span>{completion}%</span>
            <div><strong>{completion >= 70 ? "Nästan där." : "Börja med det viktigaste."}</strong><p>Varje detalj hjälper rätt arbetsgivare att hitta dig.</p></div>
          </section>

          <section className="card" style={{ padding: "1.25rem", marginTop: "1rem", background: "#fffaf5", borderColor: "#f5e8e0" }}>
            <p style={{ fontSize: "0.72rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#a3a3a3", margin: 0 }}>
              AI CV-byggare
            </p>
            <p style={{ marginTop: "0.5rem", fontSize: "0.9rem", color: "#737373", lineHeight: 1.5 }}>
              Generera ditt CV automatiskt via en kort chattintervju. Det tar bara några minuter!
            </p>
            <Link href="/cv-builder" className="cta-btn" style={{ marginTop: "1rem", display: "inline-block", padding: "0.85rem 1.25rem", fontSize: "0.9rem", fontWeight: 700 }}>
              Starta AI-chatt
            </Link>
          </section>

          <div className="mt-5 space-y-4">
            {profileSections}
          </div>

          {savedNote && (
            <p style={{ borderRadius: 10, background: "#e8f8f1", border: "1px solid #b9e5d7", padding: "0.8rem 1rem", fontSize: "0.85rem", color: "#226a54", marginTop: "1rem", fontWeight: 500 }}>
              ✓ {savedNote}
            </p>
          )}

          <div className="minimal-profile-save">
            <p>Dina ändringar sparas när du fortsätter.</p>
            <button type="button" className="cta-btn" onClick={() => void handleSave()} disabled={saving}>{saving ? "Sparar..." : "Spara ändringar"}</button>
          </div>
        </>
      )}

      </div><aside className="network-profile-sidebar">
        <SidebarCard title="Profilöversikt"><p>Håll din profil uppdaterad så att fler arbetsgivare kan hitta dig.</p><div className="network-sidebar-meter"><span style={{ width: `${completion}%` }} /></div><strong>{completion}% komplett</strong></SidebarCard>
        <SidebarCard title="Kontaktuppgifter"><dl><div><dt>Ort</dt><dd>{form.city || "Lägg till ort"}</dd></div><div><dt>E-post</dt><dd>{user.email}</dd></div></dl></SidebarCard>
        <SidebarCard title="Dina styrkor"><SkillList skills={form.skills} /></SidebarCard>
      </aside></div>

      <button
        type="button"
        className="secondary-btn"
        style={{ marginTop: "2rem", width: "100%", padding: "1rem", fontSize: "0.9rem", marginBottom: "2rem", fontWeight: 600 }}
        onClick={() => void handleLogout()}
        disabled={loggingOut}
      >
        {loggingOut ? "Loggar ut..." : "Logga ut"}
      </button>
    </main>
  );
}
