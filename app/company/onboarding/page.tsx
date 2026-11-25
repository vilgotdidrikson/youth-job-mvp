"use client";

import { BrandLogo } from "@/components/brand-logo";

import Link from "next/link";
import { organizationNumberForSave, parseOrganizationNumber } from "@/lib/company-verification";
import type { CompanyProfile } from "@/lib/types";
import { COMPANY_ROUTES } from "@/lib/company-navigation";
import { CompanyMatchProfileForm } from "@/components/company-match-profile-form";
import { UiIcon } from "@/components/ui-icon";
import "./company-onboarding-design.css";
import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useRequireAuth } from "@/hooks/use-require-auth";
import { AuthGateMessage } from "@/components/auth-gate-message";
import { getSupabaseClient } from "@/lib/supabase";

const INDUSTRY_TIPS = ["IT", "Bygg", "Restaurang", "Vård", "E-handel", "Butik", "Transport", "Ekonomi"];

type Step = "profil" | "val" | "matchprofil";

export default function CompanyOnboardingPage() {
  const router = useRouter();
  const { user, profile, loading, status, error: sessionError } = useRequireAuth();

  const [step, setStep] = useState<Step>("profil");
  const [profileQuestion, setProfileQuestion] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [verificationStatus, setVerificationStatus] = useState<CompanyProfile["verification_status"]>();

  // Company profile form
  const [companyName, setCompanyName] = useState("");
  const [administrator, setAdministrator] = useState("");
  const [organizationNumber, setOrganizationNumber] = useState("");
  const [storedOrganizationNumber, setStoredOrganizationNumber] = useState("");
  const [industry, setIndustry] = useState("");

  useEffect(() => {
    if (!loading && profile && profile.role !== "company") {
      router.replace("/swipe");
      return;
    }
    // Once saved, keep the completion choices visible. A refreshed session or
    // a late initial profile read must not redirect away from the next step.
    if (step !== "profil") return;
    if (!loading && user && profile?.role === "company") {
      let active = true;
      void getSupabaseClient()
        .from("company_profiles")
        .select("company_name, industry, administrator, organization_number, verification_status")
        .eq("user_id", user.id)
        .maybeSingle()
        .then(({ data }) => {
          if (!active || !data) return;
          setVerificationStatus(data.verification_status);
          if (data.company_name?.trim() && data.industry?.trim() && data.administrator?.trim() && (data.organization_number?.trim() || data.verification_status === "verified")) {
            router.replace("/company?view=swipe");
            return;
          }
          // The read repeats when the session refreshes; never overwrite what has already been typed.
          setCompanyName(current => current || (data.company_name ?? ""));
          setIndustry(current => current || (data.industry ?? ""));
          setAdministrator(current => current || (data.administrator ?? ""));
          setOrganizationNumber(current => current || (data.organization_number ?? ""));
          setStoredOrganizationNumber(data.organization_number ?? "");
        });
      return () => { active = false; };
    }
  }, [loading, user, profile, router, step]);

  const handleSaveProfile = async (e: FormEvent) => {
    e.preventDefault();
    if (!companyName.trim()) { setError("Ange företagets namn."); return; }
    if (!industry.trim()) { setError("Ange företagets bransch."); return; }
    const parsedOrganizationNumber = parseOrganizationNumber(organizationNumber);
    if (!parsedOrganizationNumber.ok) { setError(parsedOrganizationNumber.error); return; }
    if (!administrator.trim()) { setError("Ange administratörens namn."); return; }
    setBusy(true);
    setError("");
    try {
      const supabase = getSupabaseClient();
      const { data: savedCompany, error: dbError } = await supabase
        .from("company_profiles")
        .update({
          company_name: companyName.trim(),
          industry: industry.trim(),
          organization_number: organizationNumberForSave(storedOrganizationNumber, parsedOrganizationNumber.value),
          administrator: administrator.trim(),
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", user!.id).select("verification_status").single();
      if (dbError || !savedCompany) throw new Error(dbError?.message || "Företagsuppgifterna kunde inte sparas.");
      setVerificationStatus(savedCompany.verification_status);
      setStep("val");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Kunde inte spara. Försök igen.");
    } finally {
      setBusy(false);
    }
  };

  if (status !== "ready") return <AuthGateMessage status={status} error={sessionError} />;

  const chipBtn = (label: string, selected: boolean, onClick: () => void) => (
    <button
      key={label}
      type="button"
      onClick={onClick}
      className="company-onboarding-chip"
      aria-pressed={selected}
    >
      {label}
    </button>
  );

  const profileQuestions = [
    "Vad heter ditt företag?",
    "Vilken bransch verkar ni inom?",
    "Vad är ert organisationsnummer?",
    "Vem är administratör?",
  ];

  return (
    <main className={`mobile-shell company-onboarding ${step === "profil" ? "company-profile-onboarding" : ""}`}>
      <header className="company-onboarding-brand"><Link href="/"><BrandLogo/></Link><span>För företag</span></header>
      {step === "profil" && <aside className="company-onboarding-intro"><span className="company-onboarding-mark"><UiIcon name="briefcase" width="29" height="29" /></span><p>Er nästa kollega börjar här</p><h2>Berätta lite om ert företag.</h2><span>Fyra korta frågor gör ert konto redo. Sedan kan ni skapa en annons i lugn och ro.</span></aside>}
      {/* ── STEP 1: Company profile ── */}
      {step === "profil" && (
        <form className="company-onboarding-form" onSubmit={(e) => {
          e.preventDefault();
          if (profileQuestion < 3) {
            if (profileQuestion === 0 && !companyName.trim()) { setError("Ange företagets namn."); return; }
            if (profileQuestion === 1 && !industry.trim()) { setError("Ange företagets bransch."); return; }
            if (profileQuestion === 2) {
              const parsed = parseOrganizationNumber(organizationNumber);
              if (!parsed.ok) { setError(parsed.error); return; }
            }
            setError("");
            setProfileQuestion((current) => current + 1);
            return;
          }
          void handleSaveProfile(e);
        }}>
          <div className="company-onboarding-question-head">
            <h1>
              {profileQuestions[profileQuestion]}
            </h1>
            <p className="company-onboarding-count">{profileQuestion + 1} / 4</p>
            <div className="company-onboarding-progress" role="progressbar" aria-label="Företagets onboarding" aria-valuemin={0} aria-valuemax={4} aria-valuenow={profileQuestion + 1}>
              <div style={{ width: `${((profileQuestion + 1) / 4) * 100}%` }} />
            </div>
          </div>

          {error && (
            <div role="alert" className="company-onboarding-error">
              {error}
            </div>
          )}

          <div className="card profile-question-card">
            {profileQuestion === 0 && <><label htmlFor="company-onboarding-companyName" className="company-onboarding-label">Företagsnamn *</label><input id="company-onboarding-companyName"
              className="company-onboarding-input"
              placeholder="Företagets registrerade namn"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              required
              autoFocus
            /></>}

            {profileQuestion === 1 && <><label htmlFor="company-onboarding-industry" className="company-onboarding-label">Bransch *</label><input id="company-onboarding-industry"
              className="company-onboarding-input"
              placeholder="T.ex. IT, Bygg eller Restaurang"
              value={industry}
              onChange={(e) => setIndustry(e.target.value)}
              required
              autoFocus
            /><div className="company-onboarding-chips">{INDUSTRY_TIPS.map((item) => chipBtn(item, industry === item, () => setIndustry(item)))}</div></>}

            {profileQuestion === 2 && <><label htmlFor="company-onboarding-organizationNumber" className="company-onboarding-label">Organisationsnummer *</label><input id="company-onboarding-organizationNumber"
              className="company-onboarding-input"
              placeholder="XXXXXX-XXXX"
              inputMode="numeric"
              value={organizationNumber}
              onChange={(e) => setOrganizationNumber(e.target.value.replace(/[^0-9-]/g, ""))}
              required
              autoFocus
            /><p className="company-onboarding-help">Vi använder organisationsnumret för att verifiera företaget innan annonserna publiceras. Driver ni ett UF-företag anger ni UF-företagets eget organisationsnummer; utan ett eget nummer kan företaget inte verifieras ännu.</p></>}

            {profileQuestion === 3 && <><label htmlFor="company-onboarding-administrator" className="company-onboarding-label">Administratör *</label><input id="company-onboarding-administrator"
              className="company-onboarding-input"
              placeholder="För- och efternamn"
              value={administrator}
              onChange={(e) => setAdministrator(e.target.value)}
              required
              autoFocus
            /></>}
          </div>

          <div className="profile-actions">
            {profileQuestion > 0 && <button type="button" className="secondary-btn" onClick={() => setProfileQuestion((current) => current - 1)}>← Tillbaka</button>}
            <button type="submit" className="cta-btn" disabled={busy}>{busy ? "Sparar..." : profileQuestion === 3 ? "Spara och fortsätt →" : "Nästa →"}</button>
          </div>
        </form>
      )}

      {/* ── STEP 2: Choice ── */}
      {step === "val" && (
        <div className="company-onboarding-complete">
          <p>Välkommen till MatchnWork</p>
          <h1>Er nästa rekrytering börjar nu.</h1>
          <p>Bygg först er gemensamma matchprofil: kultur, värderingar och vad ni erbjuder. Den återanvänds i era annonser. Ni kan också börja med en annons och fylla i profilen senare.</p>
          <p>{verificationStatus === "verified" ? "Företaget är godkänt. Aktiva annonser blir synliga för ungdomar när du publicerar dem." : "Företagsuppgifterna är inskickade för granskning. MatchnWork granskar dem manuellt i den ordning de kommer in. Du kan skapa annonser direkt; aktiva annonser blir synliga för ungdomar när företaget har godkänts. Pausade och stängda annonser förblir dolda."}</p>
          <button type="button" className="cta-btn" onClick={() => setStep("matchprofil")}>Bygg företagets matchprofil</button>
          <Link className="secondary-btn" href={COMPANY_ROUTES.create} replace>Fortsätt skapa min jobbannons</Link>
          <Link className="secondary-btn" href={COMPANY_ROUTES.account} replace>Gå till mitt konto</Link>
        </div>
      )}

      {step === "matchprofil" && user && <section><h1>Er matchprofil</h1><p>Valfritt. Välj förslag eller skriv egna uppgifter. Jobbkrav bestämmer ni sedan per annons.</p><CompanyMatchProfileForm userId={user.id}/><button type="button" className="secondary-btn" onClick={() => setStep("val")}>Till nästa steg</button></section>}
    </main>
  );
}
