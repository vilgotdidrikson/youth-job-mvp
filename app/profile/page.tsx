"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ProfileProgressCard } from "@/components/profile/profile-progress-card";
import { ProfileSectionCard } from "@/components/profile/profile-section-card";
import { SelectedChip } from "@/components/profile/selected-chip";
import { StickyProfileCta } from "@/components/profile/sticky-profile-cta";
import { SuggestionChip } from "@/components/profile/suggestion-chip";
import { useSession } from "@/hooks/use-session";
import { createCvPdfFile, downloadPdfFile } from "@/lib/cv-pdf";
import { getYouthProfile, saveYouthProfileDraft } from "@/lib/onboarding";
import { uploadYouthDocument } from "@/lib/storage";
import type { YouthDocument, YouthProfile } from "@/lib/types";

interface YouthProfileForm {
  name: string;
  age: string;
  city: string;
  targetRoles: string[];
  skills: string[];
  interests: string[];
  workingTime: string[];
  experience: string;
}

const initialForm: YouthProfileForm = {
  name: "",
  age: "",
  city: "",
  targetRoles: [],
  skills: [],
  interests: [],
  workingTime: [],
  experience: "",
};

const roleSuggestions = [
  "Café",
  "Butik",
  "Barnomsorg",
  "Idrott",
  "Event",
  "Lager",
  "Leverans",
  "Restaurang",
  "Kundtjänst",
  "Administration",
  "Handledare",
  "Sociala medier",
];

const skillSuggestions = [
  "Lagarbete",
  "Service",
  "Kommunikation",
  "Pålitlig",
  "Snabblärd",
  "Problemlösning",
  "Försäljning",
  "Kassaarbete",
  "Svenska",
  "Engelska",
  "Canva",
  "Microsoft 365",
];

const workingTimeSuggestions = [
  "Vardagseftermiddagar",
  "Vardagskvällar",
  "Helger",
  "Sommarlov",
  "Skollov",
  "Flexibel",
];

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
    age: typeof profile.age === "number" ? String(profile.age) : "",
    city: typeof profile.city === "string" ? profile.city : "",
    targetRoles: normalizeStringArray(profile.desired_roles),
    skills: normalizeStringArray(profile.strengths),
    interests: normalizeStringArray(profile.merits),
    workingTime: normalizeStringArray(profile.employment_preferences),
    experience: experienceList.join("\n"),
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
  const [customRole, setCustomRole] = useState("");
  const [customSkill, setCustomSkill] = useState("");
  const [showMoreRoles, setShowMoreRoles] = useState(false);
  const [showMoreSkills, setShowMoreSkills] = useState(false);
  const [openSection, setOpenSection] = useState<string>("targetRoles");
  const [loggingOut, setLoggingOut] = useState(false);
  const [generatedCv, setGeneratedCv] = useState("");
  const [cvDocuments, setCvDocuments] = useState<YouthDocument[]>([]);
  const [editingCv, setEditingCv] = useState(false);
  const [cvEditText, setCvEditText] = useState("");
  const [editingProfile, setEditingProfile] = useState(false);
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

  const t = {
    personalTitle: "Grunduppgifter",
    personalHelp: "Snabba detaljer som förbättrar dina matchningar.",
    name: "Namn",
    age: "Ålder",
    city: "Stad",
    targetRolesTitle: "Vilka jobb är du intresserad av?",
    targetRolesHelp: "Välj flera. Tryck för att lägga till.",
    skillsTitle: "Vad är du bra på?",
    skillsHelp: "Kompetenser hjälper oss hitta bättre matchningar.",
    workingTimeTitle: "När kan du jobba?",
    workingTimeHelp: "Välj tider som passar ditt schema.",
    experienceTitle: "Erfarenhet",
    experienceHelp: "Ingen erfarenhet än? Lägg till skol-, frivillig- eller hobbyprojekt.",
    addRole: "Lägg till roll",
    addSkill: "Lägg till kompetens",
    seeMoreRoles: "Visa fler roller",
    showFewerRoles: "Visa färre roller",
    seeMoreSkills: "Visa fler kompetenser",
    showFewerSkills: "Visa färre kompetenser",
    selected: "Valda",
  };

  const completedSections = useMemo(() => {
    return {
      personal: hasContent(form.name) && hasContent(form.age) && hasContent(form.city),
      targetRoles: form.targetRoles.length > 0,
      skills: form.skills.length > 0,
      workingTime: form.workingTime.length > 0,
      experience: hasContent(form.experience),
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

  const toggleSelection = (field: "targetRoles" | "skills" | "workingTime", value: string) => {
    setForm((prev) => {
      const active = prev[field].includes(value);
      return {
        ...prev,
        [field]: active ? prev[field].filter((item) => item !== value) : [...prev[field], value],
      };
    });
    setSavedNote("");
  };

  const removeSelection = (field: "targetRoles" | "skills" | "workingTime", value: string) => {
    setForm((prev) => ({
      ...prev,
      [field]: prev[field].filter((item) => item !== value),
    }));
    setSavedNote("");
  };

  const addCustomValue = (field: "targetRoles" | "skills", value: string, clear: () => void) => {
    const trimmed = value.trim();
    if (!trimmed) {
      return;
    }

    setForm((prev) => {
      if (prev[field].some((item) => item.toLowerCase() === trimmed.toLowerCase())) {
        return prev;
      }

      return {
        ...prev,
        [field]: [...prev[field], trimmed],
      };
    });

    clear();
    setSavedNote("");
  };

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

  const roleList = showMoreRoles ? roleSuggestions : roleSuggestions.slice(0, 8);
  const skillList = showMoreSkills ? skillSuggestions : skillSuggestions.slice(0, 8);

  const profileSections = (
    <>
      <ProfileSectionCard
        id="section-target-roles"
        title={t.targetRolesTitle}
        helperText={t.targetRolesHelp}
        completed={completedSections.targetRoles}
        open={openSection === "targetRoles"}
        onToggle={() => setOpenSection((c) => (c === "targetRoles" ? "" : "targetRoles"))}
      >
        <div className="profile-chip-wrap">
          {roleList.map((role) => (
            <SuggestionChip key={role} label={role} selected={form.targetRoles.includes(role)} onClick={() => toggleSelection("targetRoles", role)} />
          ))}
        </div>
        <button type="button" style={{ marginTop: "0.75rem", fontSize: "0.78rem", fontWeight: 600, color: "#737373", background: "none", border: "none", cursor: "pointer" }} onClick={() => setShowMoreRoles((c) => !c)}>
          {showMoreRoles ? t.showFewerRoles : t.seeMoreRoles}
        </button>
        <div className="mt-3 flex gap-2">
          <input value={customRole} onChange={(e) => setCustomRole(e.target.value)} placeholder={t.addRole} className="input-field" />
          <button type="button" className="secondary-btn min-h-11 px-3 text-xs" onClick={() => addCustomValue("targetRoles", customRole, () => setCustomRole(""))}>+</button>
        </div>
        {form.targetRoles.length > 0 && (
          <div className="mt-3">
            <p style={{ fontSize: "0.72rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#a3a3a3", marginBottom: "0.5rem" }}>{t.selected}</p>
            <div className="profile-chip-wrap">
              {form.targetRoles.map((role) => <SelectedChip key={role} label={role} onRemove={() => removeSelection("targetRoles", role)} />)}
            </div>
          </div>
        )}
      </ProfileSectionCard>

      <ProfileSectionCard
        id="section-personal"
        title={t.personalTitle}
        helperText={t.personalHelp}
        completed={completedSections.personal}
        open={openSection === "personal"}
        onToggle={() => setOpenSection((c) => (c === "personal" ? "" : "personal"))}
      >
        <div className="space-y-2.5">
          <input value={form.name} onChange={(e) => { setForm((p) => ({ ...p, name: e.target.value })); setSavedNote(""); }} placeholder={t.name} className="input-field" />
          <div className="grid grid-cols-2 gap-2">
            <input value={form.age} onChange={(e) => { setForm((p) => ({ ...p, age: e.target.value })); setSavedNote(""); }} inputMode="numeric" placeholder={t.age} className="input-field" />
            <input value={form.city} onChange={(e) => { setForm((p) => ({ ...p, city: e.target.value })); setSavedNote(""); }} placeholder={t.city} className="input-field" />
          </div>
        </div>
      </ProfileSectionCard>

      <ProfileSectionCard
        id="section-skills"
        title={t.skillsTitle}
        helperText={t.skillsHelp}
        completed={completedSections.skills}
        open={openSection === "skills"}
        onToggle={() => setOpenSection((c) => (c === "skills" ? "" : "skills"))}
      >
        <div className="profile-chip-wrap">
          {skillList.map((skill) => (
            <SuggestionChip key={skill} label={skill} selected={form.skills.includes(skill)} onClick={() => toggleSelection("skills", skill)} />
          ))}
        </div>
        <button type="button" style={{ marginTop: "0.75rem", fontSize: "0.78rem", fontWeight: 600, color: "#737373", background: "none", border: "none", cursor: "pointer" }} onClick={() => setShowMoreSkills((c) => !c)}>
          {showMoreSkills ? t.showFewerSkills : t.seeMoreSkills}
        </button>
        <div className="mt-3 flex gap-2">
          <input value={customSkill} onChange={(e) => setCustomSkill(e.target.value)} placeholder={t.addSkill} className="input-field" />
          <button type="button" className="secondary-btn min-h-11 px-3 text-xs" onClick={() => addCustomValue("skills", customSkill, () => setCustomSkill(""))}>+</button>
        </div>
        {form.skills.length > 0 && (
          <div className="mt-3">
            <p style={{ fontSize: "0.72rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#a3a3a3", marginBottom: "0.5rem" }}>{t.selected}</p>
            <div className="profile-chip-wrap">
              {form.skills.map((skill) => <SelectedChip key={skill} label={skill} onRemove={() => removeSelection("skills", skill)} />)}
            </div>
          </div>
        )}
      </ProfileSectionCard>

      <ProfileSectionCard
        id="section-working-time"
        title={t.workingTimeTitle}
        helperText={t.workingTimeHelp}
        completed={completedSections.workingTime}
        open={openSection === "workingTime"}
        onToggle={() => setOpenSection((c) => (c === "workingTime" ? "" : "workingTime"))}
      >
        <div className="profile-chip-wrap">
          {workingTimeSuggestions.map((slot) => (
            <SuggestionChip key={slot} label={slot} selected={form.workingTime.includes(slot)} onClick={() => toggleSelection("workingTime", slot)} />
          ))}
        </div>
        {form.workingTime.length > 0 && (
          <div className="mt-3">
            <p style={{ fontSize: "0.72rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#a3a3a3", marginBottom: "0.5rem" }}>{t.selected}</p>
            <div className="profile-chip-wrap">
              {form.workingTime.map((slot) => <SelectedChip key={slot} label={slot} onRemove={() => removeSelection("workingTime", slot)} />)}
            </div>
          </div>
        )}
      </ProfileSectionCard>

      <ProfileSectionCard
        id="section-experience"
        title={t.experienceTitle}
        helperText={t.experienceHelp}
        completed={completedSections.experience}
        open={openSection === "experience"}
        onToggle={() => setOpenSection((c) => (c === "experience" ? "" : "experience"))}
      >
        <textarea
          value={form.experience}
          onChange={(e) => { setForm((p) => ({ ...p, experience: e.target.value })); setSavedNote(""); }}
          rows={4}
          placeholder="Skolprojekt, frivilligarbete, idrottslag, hobbyprojekt..."
          className="input-field"
          style={{ height: "auto", paddingTop: "0.6rem", paddingBottom: "0.6rem" }}
        />
      </ProfileSectionCard>
    </>
  );

  return (
    <main className="mobile-shell pb-20">
      <div style={{ marginBottom: "1rem", paddingTop: "0.5rem" }}>
        <h1 style={{ fontSize: "1.6rem", fontWeight: 800, letterSpacing: "-0.03em", color: "#111111", margin: 0 }}>
          Profil
        </h1>
        <p style={{ marginTop: "0.3rem", fontSize: "0.85rem", color: "#737373" }}>
          {hasCv ? "Ditt CV och profilinformation." : "Kompletta profiler får bättre matchningar."}
        </p>
      </div>

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
                  style={{ fontSize: "0.78rem", fontWeight: 600, color: "#111111", background: "none", border: "none", cursor: "pointer", padding: 0 }}
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
                    width: "100%", boxSizing: "border-box", borderRadius: 8,
                    border: "1.5px solid #e8e8e8", padding: "0.75rem",
                    fontSize: "0.82rem", fontFamily: "monospace",
                    resize: "vertical", color: "#111111", lineHeight: 1.6, outline: "none",
                  }}
                />
                <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.5rem" }}>
                  <button type="button" onClick={() => void handleSaveCv()} disabled={saving} className="cta-btn" style={{ flex: 1, padding: "0.75rem", fontSize: "0.9rem" }}>
                    {saving ? "Sparar..." : "Spara CV"}
                  </button>
                  <button type="button" onClick={() => setEditingCv(false)} className="secondary-btn" style={{ flex: 1, padding: "0.75rem", fontSize: "0.9rem" }}>
                    Avbryt
                  </button>
                </div>
              </>
            ) : (
              <pre style={{ margin: 0, borderRadius: 8, background: "#f5f5f5", border: "1px solid #e8e8e8", padding: "0.75rem", fontSize: "0.8rem", whiteSpace: "pre-wrap", color: "#4a4a4a", lineHeight: 1.6, maxHeight: "18rem", overflowY: "auto" }}>
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
              style={{ width: "100%", padding: "0.875rem", fontSize: "0.9rem", marginBottom: "0.75rem" }}
              onClick={() => setEditingProfile(true)}
            >
              Redigera profilinformation
            </button>
          ) : (
            <>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", margin: "0.5rem 0" }}>
                <p style={{ fontSize: "0.72rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#a3a3a3", margin: 0 }}>
                  Profilinformation
                </p>
                <button type="button" onClick={() => setEditingProfile(false)} style={{ fontSize: "0.78rem", color: "#737373", background: "none", border: "none", cursor: "pointer", padding: 0 }}>
                  Avbryt
                </button>
              </div>
              <div className="space-y-3">
                {profileSections}
              </div>
              {savedNote && (
                <p style={{ borderRadius: 10, background: "#f0faf5", border: "1px solid #b9e5d7", padding: "0.65rem 0.85rem", fontSize: "0.85rem", color: "#226a54", margin: "0.75rem 0" }}>
                  {savedNote}
                </p>
              )}
              <button type="button" className="cta-btn" style={{ width: "100%", padding: "0.875rem", fontSize: "0.9rem", marginTop: "0.75rem" }} onClick={() => void handleSave()} disabled={saving}>
                {saving ? "Sparar..." : "Spara profilinformation"}
              </button>
            </>
          )}
        </>
      ) : (
        /* ── NO CV YET ─────────────────────────────── */
        <>
          <ProfileProgressCard
            completion={completion}
            statusText={completion >= 70 ? "Redo att ansöka" : "Bra start, fortsätt"}
            title="Bygg din jobbprofil"
            subtitle="Kompletta profiler får bättre matchningar."
          />

          <section className="card" style={{ padding: "1rem", marginTop: "0.75rem" }}>
            <p style={{ fontSize: "0.72rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#a3a3a3" }}>
              AI CV-byggare
            </p>
            <p style={{ marginTop: "0.3rem", fontSize: "0.85rem", color: "#737373" }}>
              Generera ditt CV automatiskt via en kort chattintervju.
            </p>
            <Link href="/cv-builder" className="cta-btn" style={{ marginTop: "0.75rem", display: "inline-block", padding: "0.65rem 1rem", fontSize: "0.88rem" }}>
              Starta AI-chatt
            </Link>
          </section>

          <div className="mt-4 space-y-3">
            {profileSections}
          </div>

          {savedNote && (
            <p style={{ borderRadius: 10, background: "#f0faf5", border: "1px solid #b9e5d7", padding: "0.65rem 0.85rem", fontSize: "0.85rem", color: "#226a54", marginTop: "0.75rem" }}>
              {savedNote}
            </p>
          )}

          <StickyProfileCta
            completion={completion}
            saving={saving}
            onSave={() => void handleSave()}
            primaryLabel="Spara och fortsätt"
            helperLabel="Dina val hjälper oss hitta bättre matchningar."
          />
        </>
      )}

      <button
        type="button"
        className="secondary-btn"
        style={{ marginTop: "1rem", width: "100%", padding: "0.875rem", fontSize: "0.88rem", marginBottom: "2rem" }}
        onClick={() => void handleLogout()}
        disabled={loggingOut}
      >
        {loggingOut ? "..." : "Logga ut"}
      </button>
    </main>
  );
}
