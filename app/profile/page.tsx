"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { MinimalProfileSection } from "@/components/profile/minimal-profile-section";
import { ExperienceCard, ProfileHeader, SkillList } from "@/components/profile/professional-profile";
import { useRequireAuth } from "@/hooks/use-require-auth";
import { AuthGateMessage } from "@/components/auth-gate-message";
import { CompanyMatchProfileForm } from "@/components/company-match-profile-form";
import { createCvPdfFile, downloadPdfFile } from "@/lib/cv-pdf";
import { getYouthProfile, saveYouthProfileDraft } from "@/lib/onboarding";
import { getYouthDocumentSignedUrl, uploadYouthDocument } from "@/lib/storage";
import { authenticatedHeaders } from "@/lib/api-client";
import { changePassword } from "@/lib/auth";
import { UiIcon } from "@/components/ui-icon";
import "./profile.css";
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
const { user, profile, loading, logout, status, error: sessionError } = useRequireAuth();

  const [form, setForm] = useState<YouthProfileForm>(initialForm);
  const [saving, setSaving] = useState(false);
  const [savedNote, setSavedNote] = useState("");
  const [loggingOut, setLoggingOut] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [generatedCv, setGeneratedCv] = useState("");
  const [cvDocuments, setCvDocuments] = useState<YouthDocument[]>([]);
  const [editingCv, setEditingCv] = useState(false);
  const [cvEditText, setCvEditText] = useState("");

  const [profileTab, setProfileTab] = useState<"overview" | "cv" | "details" | "settings">("overview");
  const [error, setError] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState("");
  const [passwordError, setPasswordError] = useState("");

  // ── company profile state ──────────────────────────────────
  const [companyName, setCompanyName] = useState("");
  const [companyCity, setCompanyCity] = useState("");
  const [companyDescription, setCompanyDescription] = useState("");
  const [companyOrganizationNumber, setCompanyOrganizationNumber] = useState("");
  const [companyVerificationStatus, setCompanyVerificationStatus] = useState<"pending" | "verified" | "rejected">("pending");
  const [companyVerificationReason, setCompanyVerificationReason] = useState("");
  const [companyJobCount, setCompanyJobCount] = useState(0);

  useEffect(() => {
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
            setCompanyOrganizationNumber((cpResult.data as Record<string, unknown>).organization_number as string ?? "");
            const verificationStatus = (cpResult.data as Record<string, unknown>).verification_status;
            if (verificationStatus === "verified" || verificationStatus === "rejected") setCompanyVerificationStatus(verificationStatus);
            setCompanyVerificationReason((cpResult.data as Record<string, unknown>).verification_rejection_reason as string ?? "");
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
      setProfileTab("overview");
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

  const openYouthDocument = async (path: string) => {
    try {
      window.open(await getYouthDocumentSignedUrl(path), "_blank", "noopener,noreferrer");
    } catch (openError) {
      setError(openError instanceof Error ? openError.message : "Kunde inte öppna dokumentet.");
    }
  };

  const handleSaveCompanyProfile = async () => {
    if (!user?.id) return;
    if (companyOrganizationNumber && !/^\d{6}-?\d{4}$/.test(companyOrganizationNumber.trim())) {
      setError("Ange ett giltigt organisationsnummer med 10 siffror.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const { getSupabaseClient } = await import("@/lib/supabase");
      const supabase = getSupabaseClient();
      const { error: dbError } = await supabase
        .from("company_profiles")
        .update({
          company_name: companyName.trim(),
          organization_number: companyOrganizationNumber.trim() || null,
          city: companyCity.trim(),
          description: companyDescription.trim(),
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", user.id);
      if (dbError) throw new Error(dbError.message);
      setSavedNote("Profil sparad.");
      if (companyVerificationStatus !== "verified") {
        setCompanyVerificationStatus("pending");
        setCompanyVerificationReason("");
      }
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Kunde inte spara.");
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = async () => {
    setLoggingOut(true);
    setError("");
    try {
      await logout();
      router.replace("/login");
    } catch (logoutError) {
      setError(logoutError instanceof Error ? logoutError.message : "Kunde inte logga ut.");
      setLoggingOut(false);
    }
  };

  const handleChangePassword = async () => {
    setPasswordError("");
    setPasswordMessage("");
    if (!currentPassword) { setPasswordError("Ange ditt nuvarande lösenord."); return; }
    if (newPassword.length < 8) { setPasswordError("Det nya lösenordet måste innehålla minst 8 tecken."); return; }
    if (newPassword !== confirmPassword) { setPasswordError("De nya lösenorden matchar inte."); return; }

    setChangingPassword(true);
    try {
      await changePassword(currentPassword, newPassword);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setPasswordMessage("Lösenordet har ändrats.");
    } catch (changeError) {
      setPasswordError(changeError instanceof Error ? changeError.message : "Kunde inte ändra lösenordet.");
    } finally {
      setChangingPassword(false);
    }
  };

  const handleDeleteAccount = async () => {
    const password = window.prompt("Skriv ditt lösenord för att permanent radera kontot och all tillhörande data.");
    const deletedData = profile?.role === "company"
      ? "Kontot, företagsprofilen, alla annonser och bilder samt kandidaternas ansökningar, matchningar och chattar för era annonser raderas permanent."
      : "Kontot, profilen, ansökningarna, matchningarna, chattarna och filerna raderas permanent.";
    if (!password || !window.confirm(`${deletedData} Personer du har chattat med får veta att chatten har stängts. Anmälningar du har gjort sparas anonymt för säkerhetsgranskning. Detta kan inte ångras. Vill du fortsätta?`)) return;
    setDeletingAccount(true); setError("");
    try {
      const response = await fetch("/api/account", { method: "DELETE", headers: { "Content-Type": "application/json", ...(await authenticatedHeaders()) }, body: JSON.stringify({ password }) });
      if (!response.ok) throw new Error(((await response.json()) as { error?: string }).error ?? "Kunde inte radera kontot.");
      await logout(); router.replace("/");
    } catch (deleteError) { setError(deleteError instanceof Error ? deleteError.message : "Kunde inte radera kontot."); }
    finally { setDeletingAccount(false); }
  };

  if (status !== "ready") return <AuthGateMessage status={status} error={sessionError} />;
  if (!user) return null;

  const accountSecurityCard = (
    <section className="card" style={{ padding: "1.25rem", marginTop: "0.75rem", marginBottom: "0.75rem" }} aria-labelledby="password-settings-title">
      <h2 id="password-settings-title" style={{ margin: 0, fontSize: "1rem", color: "#111" }}>Byt lösenord</h2>
      <p style={{ margin: ".35rem 0 1rem", color: "#737373", fontSize: ".85rem" }}>Bekräfta ditt nuvarande lösenord innan du väljer ett nytt.</p>
      <div style={{ display: "grid", gap: ".75rem" }}>
        <label style={{ display: "grid", gap: ".3rem", fontSize: ".82rem", fontWeight: 600 }}>
          Nuvarande lösenord
          <input type="password" autoComplete="current-password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} className="h-11 w-full rounded-xl border border-[#e8e8e8] px-3 text-sm" />
        </label>
        <label style={{ display: "grid", gap: ".3rem", fontSize: ".82rem", fontWeight: 600 }}>
          Nytt lösenord
          <input type="password" autoComplete="new-password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} className="h-11 w-full rounded-xl border border-[#e8e8e8] px-3 text-sm" />
        </label>
        <label style={{ display: "grid", gap: ".3rem", fontSize: ".82rem", fontWeight: 600 }}>
          Bekräfta nytt lösenord
          <input type="password" autoComplete="new-password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} className="h-11 w-full rounded-xl border border-[#e8e8e8] px-3 text-sm" />
        </label>
      </div>
      {passwordError && <p role="alert" style={{ margin: ".75rem 0 0", color: "#b42318", fontSize: ".84rem" }}>{passwordError}</p>}
      {passwordMessage && <p role="status" style={{ margin: ".75rem 0 0", color: "#226a54", fontSize: ".84rem" }}>{passwordMessage}</p>}
      <button type="button" className="secondary-btn" style={{ width: "100%", padding: ".8rem", marginTop: "1rem" }} disabled={changingPassword} onClick={() => void handleChangePassword()}>
        {changingPassword ? "Ändrar lösenord..." : "Ändra lösenord"}
      </button>
    </section>
  );

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

    return <main className="mobile-shell mnw-company-profile">
      <header className="company-profile-header"><div className="company-profile-cover" aria-hidden="true"/><div className="company-profile-identity"><span className="company-profile-avatar"><UiIcon name="briefcase" width="30" height="30" /></span><div><p>Företagsprofil</p><h1>{companyName || "Ert företag"}</h1><span>{companyCity || "Plats ej angiven"}</span></div><button type="button" className="secondary-btn" onClick={() => setProfileTab("details")}>Redigera profil</button></div></header>
      <nav className="company-profile-tabs" aria-label="Delar av företagsprofilen">{([{id:"overview",label:"Översikt"},{id:"details",label:"Företagsuppgifter"},{id:"cv",label:"Matchprofil"},{id:"settings",label:"Inställningar"}] as const).map((item) => <button key={item.id} type="button" aria-pressed={profileTab === item.id} onClick={() => setProfileTab(item.id)}>{item.label}</button>)}</nav>
      {error && <p role="alert" className="company-profile-message is-error">{error}</p>}
      {savedNote && <p role="status" className="company-profile-message">{savedNote}</p>}
      {profileTab === "overview" && <div className="company-profile-overview"><section className="card company-profile-about"><p className="company-profile-eyebrow">Om er</p><h2>Det här är {companyName || "ert företag"}</h2><p>{companyDescription || "Beskriv er verksamhet så att kandidater kan lära känna er. Lägg till en beskrivning under Företagsuppgifter."}</p><button type="button" className="company-profile-text-action" onClick={() => setProfileTab("details")}>Redigera företagsuppgifter <UiIcon name="arrow" width="16" /></button></section><aside><section className="card company-profile-status"><UiIcon name={companyVerificationStatus === "verified" ? "check" : "info"} width="24" /><h2>{companyVerificationStatus === "verified" ? "Verifierat företag" : companyVerificationStatus === "rejected" ? "Komplettera verifieringen" : "Verifiering pågår"}</h2><p>{companyVerificationStatus === "verified" ? "Era aktiva annonser kan publiceras för ungdomar." : companyVerificationStatus === "rejected" ? companyVerificationReason || "Kontrollera företagsuppgifterna och spara igen." : "Ni kan skapa annonser under tiden. De publiceras efter godkänd verifiering."}</p></section><Link className="card company-profile-job-count" href="/company?view=annonser"><strong>{companyJobCount}</strong><span>Aktiva annonser</span><UiIcon name="arrow" width="19" /></Link></aside><section className="card company-profile-culture"><UiIcon name="discover" width="25" /><div><h2>Vad gör er till en bra arbetsplats?</h2><p>Er matchprofil samlar kultur, värderingar och det ni erbjuder. Den återanvänds som grund för varje jobb.</p></div><button type="button" className="secondary-btn" onClick={() => setProfileTab("cv")}>Visa matchprofil</button></section></div>}
      {profileTab === "details" && <section className="company-profile-details"><header><h2>Företagsuppgifter</h2><p>Uppgifterna hjälper kandidater att lära känna er och används för företagsverifieringen.</p></header>
        {/* Edit form */}
        <div className="card company-profile-form">
          <p style={{ fontSize: "0.72rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#a3a3a3", marginBottom: "1rem" }}>Redigera profil</p>

          <label htmlFor="company-profile-name" style={labelStyle}>Företagsnamn</label>
          <input id="company-profile-name"
            className="h-11 w-full rounded-xl border border-[#e8e8e8] px-3 text-sm"
            style={{ marginBottom: "0.85rem" }}
            placeholder="T.ex. Bergströms Bageri AB"
            value={companyName}
            onChange={(e) => { setCompanyName(e.target.value); setSavedNote(""); }}
          />

          <label htmlFor="company-profile-city" style={labelStyle}>Stad</label>
          <input id="company-profile-city"
            className="h-11 w-full rounded-xl border border-[#e8e8e8] px-3 text-sm"
            style={{ marginBottom: "0.85rem" }}
            placeholder="T.ex. Stockholm"
            value={companyCity}
            onChange={(e) => { setCompanyCity(e.target.value); setSavedNote(""); }}
          />

          <label htmlFor="company-profile-organization" style={labelStyle}>Organisationsnummer</label>
          <input id="company-profile-organization"
            className="h-11 w-full rounded-xl border border-[#e8e8e8] px-3 text-sm"
            style={{ marginBottom: "0.85rem" }}
            placeholder="XXXXXX-XXXX"
            inputMode="numeric"
            value={companyOrganizationNumber}
            onChange={(e) => { setCompanyOrganizationNumber(e.target.value.replace(/[^0-9-]/g, "")); setSavedNote(""); }}
          />

          <label htmlFor="company-profile-description" style={labelStyle}>Beskrivning</label>
          <textarea id="company-profile-description"
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

      </section>}
      {profileTab === "cv" && <CompanyMatchProfileForm userId={user.id} />}
      {profileTab === "settings" && <div className="company-profile-settings"><section className="card company-profile-account"><h2>Ditt konto</h2><p>{user.email}</p><Link href="/privacy">Integritet och hur AI används <UiIcon name="arrow" width="16" /></Link></section>{accountSecurityCard}<section className="card company-profile-session"><h2>Kontoinställningar</h2><button type="button" className="secondary-btn" disabled={loggingOut} onClick={() => void handleLogout()}>{loggingOut ? "Loggar ut…" : "Logga ut"}</button><button type="button" className="company-profile-delete" disabled={deletingAccount} onClick={() => void handleDeleteAccount()}>{deletingAccount ? "Raderar konto…" : "Radera konto permanent"}</button></section></div>}
    </main>;
  }

  if (profile?.role === "private") {
    return <main className="mobile-shell mnw-private-account"><header className="private-account-heading"><span><UiIcon name="profile" width="28" height="28" /></span><div><p>Ditt konto</p><h1>Din profil</h1><p>Här hanterar du ditt konto och dina engångsjobb.</p></div></header>
      {error && <p role="alert" className="company-profile-message is-error">{error}</p>}{savedNote && <p role="status" className="company-profile-message">{savedNote}</p>}
      <div className="private-account-layout"><section className="card private-account-overview"><h2>Allt på ett ställe</h2><p>{user.email}</p><Link href="/private"><span><UiIcon name="briefcase" />Mina uppdrag</span><UiIcon name="arrow" width="18" /></Link><Link href="/chats"><span><UiIcon name="chat" />Mina chattar</span><UiIcon name="arrow" width="18" /></Link><Link href="/privacy"><span><UiIcon name="info" />Integritet och AI</span><UiIcon name="arrow" width="18" /></Link></section>
      <section className="private-account-security">{accountSecurityCard}<section className="card private-account-management"><h2>Kontohantering</h2><p>Logga ut när du är klar, eller avsluta ditt konto.</p><button type="button" className="secondary-btn" disabled={loggingOut} onClick={() => void handleLogout()}>{loggingOut ? "Loggar ut…" : "Logga ut"}</button><button type="button" className="company-profile-delete" disabled={deletingAccount} onClick={() => void handleDeleteAccount()}>{deletingAccount ? "Raderar konto…" : "Radera konto permanent"}</button></section></section></div></main>;
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

  return <main className="mobile-shell profile-page mnw-profile">
    <ProfileHeader name={form.name} location={form.city} completion={completion} onEdit={() => setProfileTab("details")} />
    <nav className="mnw-profile-tabs" aria-label="Profilens delar">{([ ["overview","Översikt"], ["cv","Mitt CV"], ["details","Mina uppgifter"], ["settings","Inställningar"] ] as const).map(([value,label]) => <button type="button" key={value} aria-pressed={profileTab === value} className={profileTab === value ? "is-active" : ""} onClick={() => setProfileTab(value)}>{label}</button>)}</nav>
    {error && <p role="alert" className="mnw-profile-alert">{error}</p>}{savedNote && <p role="status" className="mnw-profile-success">{savedNote}</p>}
    {profileTab === "overview" && <div className="mnw-profile-grid"><section className="mnw-profile-card mnw-profile-cv" aria-label="CV-status"><span className="mnw-profile-icon"><UiIcon name="briefcase"/></span><div className="mnw-profile-card-heading"><h2>Ditt CV</h2><span className={hasCv ? "mnw-status-ready" : "mnw-status-pending"}>{hasCv ? "Klart" : "Nästa steg"}</span></div><p>{hasCv ? "Ditt CV kan ses av arbetsgivare när du skickar en ansökan." : "Du kan upptäcka jobb redan nu. Gör klart ditt CV för att skicka dina ansökningar."}</p><Link className="cta-btn" href={hasCv ? "/youth/cv/create?edit=1" : "/youth/cv"}>{hasCv ? "Redigera mitt CV" : "Fortsätt med mitt CV"}<UiIcon name="arrow" width="18"/></Link>{hasCv && <button type="button" className="mnw-profile-textlink" onClick={() => setProfileTab("cv")}>Visa CV och PDF</button>}</section>
      <section className="mnw-profile-card"><h2>Dina genvägar</h2><Link className="mnw-profile-shortcut" href="/swipe?saved=1"><UiIcon name="bookmark"/><span><strong>Sparade jobb</strong><small>Hitta tillbaka till dina favoriter</small></span><UiIcon name="arrow" width="18"/></Link><Link className="mnw-profile-shortcut" href="/notifications"><UiIcon name="activity"/><span><strong>Din aktivitet</strong><small>Ansökningar, matchningar och notiser</small></span><UiIcon name="arrow" width="18"/></Link><Link className="mnw-profile-shortcut" href="/chats"><UiIcon name="chat"/><span><strong>Dina chattar</strong><small>Fortsätt samtalet</small></span><UiIcon name="arrow" width="18"/></Link></section>
      <section className="mnw-profile-card"><h2>Dina styrkor</h2><SkillList skills={form.skills}/><button className="mnw-profile-textlink" onClick={() => setProfileTab("details")}>Redigera mina uppgifter <UiIcon name="arrow" width="16"/></button></section><section className="mnw-profile-card mnw-profile-note"><UiIcon name="info"/><h2>Din profil, på dina villkor</h2><p>Håll dina uppgifter aktuella. Du väljer vilka jobb du visar intresse för.</p><button className="mnw-profile-textlink" onClick={() => setProfileTab("settings")}>Kontoinställningar <UiIcon name="arrow" width="16"/></button></section></div>}
    {profileTab === "cv" && <section className="mnw-profile-card mnw-profile-panel"><div className="mnw-profile-card-heading"><h2>Mitt CV</h2><Link href={hasCv ? "/youth/cv/create?edit=1" : "/youth/cv"} className="secondary-btn">{hasCv ? "Redigera i CV-byggaren" : "Skapa CV"}</Link></div>{hasGeneratedCv ? <><p className="mnw-profile-muted">Här är det CV du har sparat. Du kan redigera texten eller öppna en PDF.</p>{editingCv ? <><label className="mnw-profile-field">CV-text<textarea rows={14} value={cvEditText} onChange={event => setCvEditText(event.target.value)}/></label><div className="mnw-profile-buttons"><button className="cta-btn" disabled={saving} onClick={() => void handleSaveCv()}>{saving ? "Sparar…" : "Spara CV"}</button><button className="secondary-btn" onClick={() => setEditingCv(false)}>Avbryt</button></div></> : <><pre className="mnw-profile-preview">{generatedCv}</pre><button className="mnw-profile-textlink" onClick={() => {setCvEditText(generatedCv);setEditingCv(true);}}>Redigera CV-text</button></>}<div className="mnw-profile-buttons">{generatedCvDocument ? <button className="secondary-btn" onClick={() => void openYouthDocument(generatedCvDocument.url)}>Öppna CV som PDF</button> : <button className="secondary-btn" disabled={saving} onClick={() => void handleCreatePdfForExistingCv()}>{saving ? "Skapar PDF…" : "Spara CV som PDF"}</button>}</div></> : uploadedCvDocument ? <><p className="mnw-profile-muted">Ditt uppladdade CV finns sparat som PDF.</p><button className="cta-btn" onClick={() => void openYouthDocument(uploadedCvDocument.url)}>Öppna mitt PDF-CV</button></> : <p className="mnw-profile-muted">Svara på enkla frågor eller ladda upp en PDF för att komma igång.</p>}</section>}
    {profileTab === "details" && <section className="mnw-profile-panel"><section className="mnw-profile-card"><h2>Mina uppgifter</h2><p className="mnw-profile-muted">Uppdatera en del i taget. Spara när du är klar.</p><div className="mnw-profile-fields">{([ ["name","Fullständigt namn","text"], ["dateOfBirth","Födelsedatum","date"], ["address","Adress","text"], ["postalCode","Postnummer","text"], ["city","Ort","text"] ] as const).map(([field,label,type]) => <label className="mnw-profile-field" key={field}>{label}<input type={type} value={form[field]} onChange={event => {setForm(current => ({...current,[field]:event.target.value}));setSavedNote("");}}/></label>)}</div></section>{profileSections}<div className="mnw-profile-save"><p>Dina ändringar sparas när du trycker på Spara.</p><button className="cta-btn" disabled={saving} onClick={() => void handleSave()}>{saving ? "Sparar…" : "Spara mina uppgifter"}</button></div></section>}
    {profileTab === "settings" && <section className="mnw-profile-panel"><section className="mnw-profile-card"><h2>Ditt konto</h2><p className="mnw-profile-muted">{user.email}</p></section>{accountSecurityCard}<section className="mnw-profile-card"><h2>Kontohantering</h2><div className="mnw-profile-buttons"><button className="secondary-btn" disabled={loggingOut} onClick={() => void handleLogout()}>{loggingOut ? "Loggar ut…" : "Logga ut"}</button><button className="mnw-profile-danger secondary-btn" disabled={deletingAccount} onClick={() => void handleDeleteAccount()}>{deletingAccount ? "Raderar konto…" : "Radera konto permanent"}</button></div></section></section>}
  </main>;
}
