"use client";

import { useRecruitmentProfile } from "@/hooks/use-recruitment-profile";
import { ProfileVideo } from "@/components/profile-video";
import { completedProfileSections } from "@/lib/recruitment-profile";
import { useCvCompletion } from "@/hooks/use-cv-completion";
import { ModalDialog } from "@/components/modal-dialog";
import { RecruitmentProfileEditor } from "@/components/recruitment-profile-editor";

import { BlockedContacts } from "@/components/blocked-contacts";
import { PasswordInput } from "@/components/password-input";

import { CvFactReview } from "@/components/cv-fact-review";
import { cvReviewSnapshot, hasApprovedCv } from "@/lib/cv-fact-review";
import { renderStructuredCv, structuredCvFromForm, type StructuredCvData } from "@/lib/structured-cv";
import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useRequireAuth } from "@/hooks/use-require-auth";
import { AuthGateMessage } from "@/components/auth-gate-message";
import { CompanyMatchProfileForm } from "@/components/company-match-profile-form";
import { createCvPdfFile, downloadPdfFile } from "@/lib/cv-pdf";
import { getYouthProfile, saveYouthContactDetails, saveReviewedCvToProfile } from "@/lib/onboarding";
import { getYouthDocumentSignedUrl, uploadYouthDocument } from "@/lib/storage";
import { authenticatedHeaders } from "@/lib/api-client";
import { changePassword } from "@/lib/auth";
import { UiIcon } from "@/components/ui-icon";
import { VerifiedJobBadge } from "@/components/verified-job-badge";
import { EmploymentExperiences } from "@/components/employment-experiences";
import { useVerifiedExperience } from "@/hooks/use-verified-experience";
import { withVerifiedExperience } from "@/lib/recruitment-types";
import "./profile.css";
import type { YouthDocument, YouthProfile } from "@/lib/types";

interface YouthProfileForm { name:string;dateOfBirth:string;address:string;postalCode:string;city:string }
const initialForm:YouthProfileForm={name:"",dateOfBirth:"",address:"",postalCode:"",city:""};
function mapProfileToForm(profile:YouthProfile|null,fallbackName:string):YouthProfileForm {
 return {name:profile?.full_name?.trim()||fallbackName,dateOfBirth:profile?.date_of_birth??"",address:profile?.address??"",postalCode:profile?.postal_code??"",city:profile?.city??""};
}


function ProfilePageContent() {
  const query=useSearchParams();
  const router = useRouter();
const { user, profile, loading, logout, status, error: sessionError } = useRequireAuth();
  const {cvCompleted} = useCvCompletion(user?.id,profile?.role === "youth");
  const recruitment = useRecruitmentProfile(profile?.role === "youth" ? user?.id : undefined);
  const verified = useVerifiedExperience(profile?.role === "youth" ? user?.id : undefined);

  const [form, setForm] = useState<YouthProfileForm>(initialForm);
  const [saving, setSaving] = useState(false);
  const [savedNote, setSavedNote] = useState("");
  const [loggingOut, setLoggingOut] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [generatedCv, setGeneratedCv] = useState("");
  const [cvDocuments, setCvDocuments] = useState<YouthDocument[]>([]);
  const [editingCv, setEditingCv] = useState(false);
  const [cvEditText, setCvEditText] = useState("");
  const [cvStructured, setCvStructured] = useState<StructuredCvData | null>(null);
  const [storedCvStructured,setStoredCvStructured]=useState<StructuredCvData|null>(null);
  const [cvApproval, setCvApproval] = useState<string | null>(null);
  const cvApproved = cvStructured ? hasApprovedCv(cvApproval, cvEditText, cvStructured) : false;

  const [profileTab, setProfileTab] = useState<"overview" | "work" | "cv" | "details" | "settings">(query.get("tab")==="work"?"work":"overview");
  const [frame,setFrame]=useState<"cv"|"video"|"general"|null>(null);
  const [frameBusy,setFrameBusy]=useState(false),[frameDirty,setFrameDirty]=useState(false);
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
  const [loadedProfileKey, setLoadedProfileKey] = useState("");
  const [profileLoadError, setProfileLoadError] = useState("");
  const [profileLoadRetry, setProfileLoadRetry] = useState(0);
  const profileKey = `${user?.id ?? ""}:${profile?.role ?? ""}`;

  useEffect(() => {
    if (!user?.id || profile?.role !== "youth") return;
    let active = true;
    const refreshDocuments = () => { void getYouthProfile(user.id).then(data => { if (active) setCvDocuments(Array.isArray(data?.documents) ? data.documents : []); }).catch(() => {}); };
    window.addEventListener("mnw-recruitment-refresh", refreshDocuments);
    return () => { active = false; window.removeEventListener("mnw-recruitment-refresh", refreshDocuments); };
  }, [user?.id, profile?.role]);

  useEffect(() => {
    if (loading || !user || (profile?.role !== "company" && profile?.role !== "youth")) return;
    let active = true;
    const key = `${user.id}:${profile.role}`;
    setLoadedProfileKey("");
    setProfileLoadError("");
    void (async () => {
      try {
        if (profile.role === "company") {
          const { getSupabaseClient } = await import("@/lib/supabase");
          const supabase = getSupabaseClient();
          const [cpResult, jobsResult] = await Promise.all([
            supabase.from("company_profiles").select("*").eq("user_id", user.id).maybeSingle(),
            supabase.from("jobs").select("id").eq("company_user_id", user.id).eq("is_active", true),
          ]);
          if (cpResult.error) throw cpResult.error;
          if (jobsResult.error) throw jobsResult.error;
          if (!active) return;
          const cp = cpResult.data;
          setCompanyName(cp?.company_name ?? "");
          setCompanyCity(cp?.city ?? "");
          setCompanyDescription(cp?.description ?? "");
          setCompanyOrganizationNumber(cp?.organization_number ?? "");
          setCompanyVerificationStatus(cp?.verification_status === "verified" || cp?.verification_status === "rejected" ? cp.verification_status : "pending");
          setCompanyVerificationReason(cp?.verification_rejection_reason ?? "");
          setCompanyJobCount((jobsResult.data ?? []).length);
        } else {
          const youthProfile = await getYouthProfile(user.id);
          if (!active) return;
          setForm(mapProfileToForm(youthProfile, user.email?.split("@")[0] ?? ""));
          const cv = typeof youthProfile?.cv_text === "string" ? youthProfile.cv_text : "";
          setGeneratedCv(cv);
          setCvEditText(cv);
          setCvApproval(null);
          setCvStructured(youthProfile?.cv_structured ?? structuredCvFromForm({ full_name: youthProfile?.full_name ?? "", city: youthProfile?.city ?? "", work_experience: (youthProfile?.work_experience ?? []).join("\n"), education: (youthProfile?.education ?? []).join("\n"), languages: (youthProfile?.languages ?? []).join(", ") }));
          setStoredCvStructured(youthProfile?.cv_structured ?? structuredCvFromForm({ full_name: youthProfile?.full_name ?? "", city: youthProfile?.city ?? "", work_experience: (youthProfile?.work_experience ?? []).join("\n"), education: (youthProfile?.education ?? []).join("\n"), languages: (youthProfile?.languages ?? []).join(", ") }));
          setCvDocuments(Array.isArray(youthProfile?.documents) ? youthProfile.documents : []);
        }
        setError("");
        setLoadedProfileKey(key);
      } catch (loadError) {
        if (!active) return;
        setProfileLoadError(loadError instanceof Error ? loadError.message : "Kunde inte ladda profilen. Försök igen.");
      }
    })();
    return () => { active = false; };
  }, [loading, profile?.role, profileLoadRetry, user]);

  const completedSectionCount = completedProfileSections(recruitment.profile).length;

  const generatedCvDocument = cvDocuments.find((document) => document.type === "generated_cv");
  const uploadedCvDocument = cvDocuments.find((document) => document.type === "cv");
  const hasGeneratedCv = generatedCv.trim().length > 0;
  const hasCv = hasGeneratedCv || Boolean(uploadedCvDocument);

  const handleSave = async () => {
    setSaving(true);
    try {
      await saveYouthContactDetails(form);
      setSavedNote("Dina kontaktuppgifter är sparade.");
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
    if (!user?.id || !cvStructured) return;
    if (!cvApproved) { setError("Granska och godkänn CV-texten och profilfakta innan du sparar."); return; }
    setSaving(true);
    try {
      const pdfFile = await createCvPdfFile(cvEditText, form.name);
      const pdfUrl = await uploadYouthDocument(pdfFile);
      const savedCv = await saveReviewedCvToProfile(cvEditText, cvStructured, cvApproval, { name: pdfFile.name, url: pdfUrl, type: "generated_cv" });
      setGeneratedCv(cvEditText);
      setStoredCvStructured(cvStructured);
      setForm(mapProfileToForm(savedCv as YouthProfile, form.name));
      setSavedNote("CV och profilfakta sparade.");
      setCvDocuments(Array.isArray(savedCv.documents) ? savedCv.documents : []);
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
  if ((profile?.role === "youth" || profile?.role === "company") && loadedProfileKey !== profileKey) return <main className="mobile-shell profile-page mnw-profile"><section className="mnw-profile-card">{profileLoadError ? <><h1>Profilen kunde inte hämtas</h1><p role="alert">{profileLoadError}</p><button type="button" className="secondary-btn" onClick={() => setProfileLoadRetry((value) => value + 1)}>Försök igen</button></> : <p role="status">Hämtar din profil…</p>}</section></main>;

  const accountSecurityCard = (
    <section className="card" style={{ padding: "1.25rem", marginTop: "0.75rem", marginBottom: "0.75rem" }} aria-labelledby="password-settings-title">
      <h2 id="password-settings-title" style={{ margin: 0, fontSize: "1rem", color: "#111" }}>Byt lösenord</h2>
      <p style={{ margin: ".35rem 0 1rem", color: "#737373", fontSize: ".85rem" }}>Bekräfta ditt nuvarande lösenord innan du väljer ett nytt.</p>
      <div style={{ display: "grid", gap: ".75rem" }}>
        <label style={{ display: "grid", gap: ".3rem", fontSize: ".82rem", fontWeight: 600 }}>
          Nuvarande lösenord
          <PasswordInput autoComplete="current-password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} className="h-11 w-full rounded-xl border border-[#e8e8e8] px-3 text-sm" />
        </label>
        <label style={{ display: "grid", gap: ".3rem", fontSize: ".82rem", fontWeight: 600 }}>
          Nytt lösenord
          <PasswordInput autoComplete="new-password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} className="h-11 w-full rounded-xl border border-[#e8e8e8] px-3 text-sm" />
        </label>
        <label style={{ display: "grid", gap: ".3rem", fontSize: ".82rem", fontWeight: 600 }}>
          Bekräfta nytt lösenord
          <PasswordInput autoComplete="new-password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} className="h-11 w-full rounded-xl border border-[#e8e8e8] px-3 text-sm" />
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
      {profileTab === "settings" && <div className="company-profile-settings"><section className="card company-profile-account"><h2>Ditt konto</h2><p>{user.email}</p><Link href="/privacy">Integritet och hur AI används <UiIcon name="arrow" width="16" /></Link></section>{accountSecurityCard}<BlockedContacts key={user.id} userId={user.id} /><section className="card company-profile-session"><h2>Kontoinställningar</h2><button type="button" className="secondary-btn" disabled={loggingOut} onClick={() => void handleLogout()}>{loggingOut ? "Loggar ut…" : "Logga ut"}</button><button type="button" className="company-profile-delete" disabled={deletingAccount} onClick={() => void handleDeleteAccount()}>{deletingAccount ? "Raderar konto…" : "Radera konto permanent"}</button></section></div>}
    </main>;
  }

  if (profile?.role === "private") {
    return <main className="mobile-shell mnw-private-account"><header className="private-account-heading"><span><UiIcon name="profile" width="28" height="28" /></span><div><p>Ditt konto</p><h1>Din profil</h1><p>Här hanterar du ditt konto och dina engångsjobb.</p></div></header>
      {error && <p role="alert" className="company-profile-message is-error">{error}</p>}{savedNote && <p role="status" className="company-profile-message">{savedNote}</p>}
      <div className="private-account-layout"><section className="card private-account-overview"><h2>Allt på ett ställe</h2><p>{user.email}</p><Link href="/private"><span><UiIcon name="briefcase" />Mina uppdrag</span><UiIcon name="arrow" width="18" /></Link><Link href="/chats"><span><UiIcon name="chat" />Mina chattar</span><UiIcon name="arrow" width="18" /></Link><Link href="/privacy"><span><UiIcon name="info" />Integritet och AI</span><UiIcon name="arrow" width="18" /></Link></section>
      <section className="private-account-security">{accountSecurityCard}<BlockedContacts key={user.id} userId={user.id} /><section className="card private-account-management"><h2>Kontohantering</h2><p>Logga ut när du är klar, eller avsluta ditt konto.</p><button type="button" className="secondary-btn" disabled={loggingOut} onClick={() => void handleLogout()}>{loggingOut ? "Loggar ut…" : "Logga ut"}</button><button type="button" className="company-profile-delete" disabled={deletingAccount} onClick={() => void handleDeleteAccount()}>{deletingAccount ? "Raderar konto…" : "Radera konto permanent"}</button></section></section></div></main>;
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

  const closeFrame=()=>{
    if(saving||frameBusy)return;
    if((frameDirty||editingCv)&&!window.confirm("Stäng utan att spara dina ändringar?"))return;
    setFrame(null);setFrameDirty(false);setEditingCv(false);setCvEditText(generatedCv);setCvStructured(storedCvStructured);setCvApproval(null);
  };
  const openFrame=(next:"cv"|"video"|"general")=>{setFrame(next);setFrameDirty(false);setError("");setSavedNote("");};
  return <main className="mobile-shell profile-page mnw-profile">
    <header className="mnw-profile-compact-header"><span className="mnw-profile-small-avatar">{form.name.trim().charAt(0)||"?"}</span><div><p>Din profil</p><h1>{form.name||"Din profil"}</h1><span>{form.city||"Ort ej angiven"}</span></div><VerifiedJobBadge experiences={verified.items}/></header>
    <nav className="mnw-profile-tabs" aria-label="Profilens delar">{([["overview","Översikt"],["work","Din jobbprofil"],["settings","Inställningar"]] as const).map(([value,label])=><button type="button" key={value} aria-pressed={profileTab===value} className={profileTab===value?"is-active":""} onClick={()=>setProfileTab(value)}>{label}</button>)}</nav>
    {error&&!frame&&<p role="alert" className="mnw-profile-alert">{error}</p>}{savedNote&&!frame&&<p role="status" className="mnw-profile-success">{savedNote}</p>}
    {profileTab==="overview"&&<div className="mnw-profile-grid"><section className="mnw-profile-card"><span className="mnw-profile-icon"><UiIcon name="profile"/></span><h2>Din jobbprofil, på ett ställe</h2><p>{hasCv||cvCompleted?"Ditt CV finns sparat. Video och andra profildelar är frivilliga.":"Du kan upptäcka jobb nu och bygga din profil i din takt."}</p><div className="mnw-profile-buttons"><Link className="cta-btn" href="/profile/build">Bygg / fortsätt min profil</Link><button className="secondary-btn" type="button" onClick={()=>setProfileTab("work")}>Visa min jobbprofil</button></div></section><section className="mnw-profile-card"><h2>Dina genvägar</h2><Link className="mnw-profile-shortcut" href="/swipe?saved=1"><UiIcon name="bookmark"/><span><strong>Sparade jobb</strong></span><UiIcon name="arrow" width="18"/></Link><Link className="mnw-profile-shortcut" href="/applications"><UiIcon name="briefcase"/><span><strong>Dina ansökningar</strong></span><UiIcon name="arrow" width="18"/></Link><Link className="mnw-profile-shortcut" href="/chats"><UiIcon name="chat"/><span><strong>Dina samtal</strong></span><UiIcon name="arrow" width="18"/></Link></section></div>}
    {profileTab==="work"&&<section className="mnw-job-profile"><header><div><h2>Din jobbprofil</h2><p>Öppna en del för att se eller ändra den.</p></div><Link className="secondary-btn" href="/profile/build">Bygg steg för steg</Link></header><div className="mnw-job-profile-parts">{([{key:"cv",title:"Mitt CV",description:hasCv?"Visa CV, redigera och öppna PDF":"Skapa ett CV eller ladda upp PDF",icon:"file"},{key:"video",title:"Min profilvideo",description:"Visa, spela in, ersätt eller ta bort · frivilligt",icon:"camera"},{key:"general",title:"Min allmänna profil",description:`Vad jag söker, tillgänglighet och kunskaper · ${completedSectionCount} av 4 delar har uppgifter`,icon:"profile"}] as const).map(item=><button type="button" key={item.key} onClick={()=>openFrame(item.key)}><span className="mnw-profile-icon"><UiIcon name={item.icon}/></span><span><strong>{item.title}</strong><small>{item.description}</small></span><UiIcon name="arrow" width="19"/></button>)}</div><details className="mnw-profile-card mnw-profile-confirmed"><summary>Bekräftad erfarenhet</summary><EmploymentExperiences userId={user.id}/>{verified.error&&<p role="alert">{verified.error}</p>}</details></section>}
    {profileTab === "settings" && <section className="mnw-profile-panel"><section className="mnw-profile-card"><h2>Ditt konto</h2><p className="mnw-profile-muted">{user.email}</p></section><details className="mnw-profile-card"><summary>Kontaktuppgifter</summary><p className="mnw-profile-muted">Kontaktuppgifter sparas separat från CV och jobbönskemål. Ändrar du namn eller ort, kontrollera även ditt sparade CV.</p><div className="mnw-profile-fields">{([["name","Fullständigt namn","text"],["dateOfBirth","Födelsedatum","date"],["address","Adress","text"],["postalCode","Postnummer","text"],["city","Ort","text"]] as const).map(([field,label,type])=><label className="mnw-profile-field" key={field}>{label}<input type={type} disabled={saving} value={form[field]} onChange={event=>{setForm(current=>({...current,[field]:event.target.value}));setSavedNote("");}}/></label>)}</div><div className="mnw-profile-buttons"><button className="cta-btn" disabled={saving} onClick={()=>void handleSave()}>{saving?"Sparar…":"Spara kontaktuppgifter"}</button></div></details><details className="mnw-profile-card"><summary>Lösenord</summary>{accountSecurityCard}</details><details className="mnw-profile-card"><summary>Blockerade kontakter</summary><BlockedContacts key={user.id} userId={user.id}/></details><section className="mnw-profile-card"><h2>Kontohantering</h2><div className="mnw-profile-buttons"><button className="secondary-btn" disabled={loggingOut} onClick={() => void handleLogout()}>{loggingOut ? "Loggar ut…" : "Logga ut"}</button><button className="mnw-profile-danger secondary-btn" disabled={deletingAccount} onClick={() => void handleDeleteAccount()}>{deletingAccount ? "Raderar konto…" : "Radera konto permanent"}</button></div></section></section>}
    {frame&&<ModalDialog label={frame==="cv"?"Mitt CV":frame==="video"?"Min profilvideo":"Min allmänna profil"} busy={saving||frameBusy} onClose={closeFrame} className="mnw-profile-frame"><header className="mnw-profile-frame-heading"><h2>{frame==="cv"?"Mitt CV":frame==="video"?"Min profilvideo":"Min allmänna profil"}</h2><button type="button" className="secondary-btn" disabled={saving||frameBusy} aria-label="Stäng profildelen" onClick={closeFrame}><UiIcon name="close"/></button></header>{error&&<p role="alert" className="mnw-profile-alert">{error}</p>}{savedNote&&<p role="status" className="mnw-profile-success">{savedNote}</p>}{frame==="cv"?<section className="mnw-profile-card mnw-profile-panel"><div className="mnw-profile-card-heading"><h3>Ditt CV</h3><Link href={hasCv ? "/youth/cv/create?edit=1" : "/youth/cv"} className="secondary-btn">{hasCv ? "Redigera i CV-byggaren" : "Skapa CV"}</Link></div>{hasGeneratedCv ? <><p className="mnw-profile-muted">Här är det CV du har sparat. Du kan redigera texten eller öppna en PDF.</p>{editingCv ? <><label className="mnw-profile-field">CV-text<textarea rows={14} disabled={saving} value={cvEditText} onChange={event => { setCvApproval(null); setCvEditText(event.target.value); }}/></label>{cvStructured && <CvFactReview text={cvEditText} cv={cvStructured} sourceText={generatedCv} approved={cvApproved} disabled={saving}
      onApprove={(approved) => setCvApproval(approved ? cvReviewSnapshot(cvEditText, cvStructured) : null)}
      onSync={(cv) => { setCvApproval(null); setCvStructured(cv); }}
      onChange={(cv) => { setCvApproval(null); setCvStructured(cv); setCvEditText(renderStructuredCv(cv)); }} />}
      <div className="mnw-profile-buttons"><button className="cta-btn" disabled={saving || !cvApproved} onClick={() => void handleSaveCv()}>{saving ? "Sparar…" : "Spara CV"}</button><button className="secondary-btn" disabled={saving} onClick={() => {setEditingCv(false);setCvStructured(storedCvStructured);setCvEditText(generatedCv);setCvApproval(null);}}>Avbryt</button></div></> : <><pre className="mnw-profile-preview">{withVerifiedExperience(generatedCv, verified.items)}</pre><button className="mnw-profile-textlink" onClick={() => {setCvApproval(null);setCvEditText(generatedCv);setEditingCv(true);}}>Redigera CV-text</button></>}<div className="mnw-profile-buttons">{generatedCvDocument ? <button className="secondary-btn" onClick={() => void openYouthDocument(generatedCvDocument.url)}>Öppna CV som PDF</button> : <button className="secondary-btn" disabled={saving} onClick={() => void handleCreatePdfForExistingCv()}>{saving ? "Skapar PDF…" : "Spara CV som PDF"}</button>}</div></> : uploadedCvDocument ? <><p className="mnw-profile-muted">Ditt uppladdade CV finns sparat som PDF.</p><button className="cta-btn" onClick={() => void openYouthDocument(uploadedCvDocument.url)}>Öppna mitt PDF-CV</button></> : <p className="mnw-profile-muted">Svara på enkla frågor eller ladda upp en PDF för att komma igång.</p>}</section>:frame==="video"?<ProfileVideo userId={user.id} onBusyChange={setFrameBusy}/>:<RecruitmentProfileEditor embedded onBusyChange={setFrameBusy} onDirtyChange={setFrameDirty}/>}</ModalDialog>}
  </main>;
}
export default function ProfilePage(){return <Suspense fallback={<main className="mobile-shell"><p role="status">Hämtar din profil…</p></main>}><ProfilePageContent/></Suspense>;}
