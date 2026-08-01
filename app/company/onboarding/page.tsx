"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "@/hooks/use-session";
import { getSupabaseClient } from "@/lib/supabase";
import { createJob } from "@/lib/jobs";
import { uploadJobImage } from "@/lib/storage";
import { ADDRESS_SUGGESTIONS, CITY_SUGGESTIONS, COMPANY_NAME_SUGGESTIONS, JOB_TITLE_SUGGESTIONS } from "@/lib/form-suggestions";

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
const COMMON_ROLES = ["Utvecklare", "Säljare", "Marknadsförare", "Kundservice"];
const HIRING_PRIORITIES = ["Erfarenhet", "Personlighet", "Tekniska kunskaper", "Kulturpassning", "Ledarskap"];
const INDUSTRY_TIPS = ["IT", "Bygg", "Restaurang", "Vård", "E-handel", "Butik", "Transport", "Ekonomi"];

type Step = "profil" | "val" | "annons";

function toggleItem(arr: string[], item: string): string[] {
  return arr.includes(item) ? arr.filter((x) => x !== item) : [...arr, item];
}

export default function CompanyOnboardingPage() {
  const router = useRouter();
  const { user, profile, loading } = useSession();

  const [step, setStep] = useState<Step>("profil");
  const [profileQuestion, setProfileQuestion] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  // Company profile form
  const [companyName, setCompanyName] = useState("");
  const [administrator, setAdministrator] = useState("");
  const [city, setCity] = useState("");
  const [address, setAddress] = useState("");
  const [description, setDescription] = useState("");
  const [industry, setIndustry] = useState("");
  const [commonRoles, setCommonRoles] = useState<string[]>([]);
  const [customRole, setCustomRole] = useState("");
  const [hiringPriorities, setHiringPriorities] = useState<string[]>([]);
  const [customPriority, setCustomPriority] = useState("");
  const [logoName, setLogoName] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [linkedinUrl, setLinkedinUrl] = useState("");
  const [instagramUrl, setInstagramUrl] = useState("");
  const [facebookUrl, setFacebookUrl] = useState("");
  const [tiktokUrl, setTiktokUrl] = useState("");
  const [xUrl, setXUrl] = useState("");

  // Job form
  const [jobTitle, setJobTitle] = useState("");
  const [jobCity, setJobCity] = useState("");
  const [jobCategory, setJobCategory] = useState("");
  const [jobTimePrefs, setJobTimePrefs] = useState<string[]>([]);
  const [jobMinAge, setJobMinAge] = useState("");
  const [jobMaxAge, setJobMaxAge] = useState("");
  const [jobPay, setJobPay] = useState("");
  const [jobDescription, setJobDescription] = useState("");

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/login");
      return;
    }
    if (!loading && profile && profile.role !== "company") {
      router.replace("/swipe");
      return;
    }
    if (!loading && user && profile?.role === "company") {
      let active = true;
      void getSupabaseClient()
        .from("company_profiles")
        .select("company_name, industry, administrator")
        .eq("user_id", user.id)
        .maybeSingle()
        .then(({ data }) => {
          if (!active || !data) return;
          if (data.company_name?.trim() && data.industry?.trim() && data.administrator?.trim()) {
            router.replace("/company?view=swipe");
            return;
          }
          setCompanyName(data.company_name ?? "");
          setIndustry(data.industry ?? "");
          setAdministrator(data.administrator ?? "");
        });
      return () => { active = false; };
    }
  }, [loading, user, profile, router]);

  const handleSaveProfile = async (e: FormEvent) => {
    e.preventDefault();
    if (!companyName.trim()) { setError("Ange företagets namn."); return; }
    if (!industry.trim()) { setError("Ange företagets bransch."); return; }
    if (!administrator.trim()) { setError("Ange administratörens namn."); return; }
    setBusy(true);
    setError("");
    try {
      const supabase = getSupabaseClient();
      const { error: dbError } = await supabase
        .from("company_profiles")
        .update({
          company_name: companyName.trim(),
          industry: industry.trim(),
          administrator: administrator.trim(),
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", user!.id);
      if (dbError) throw new Error(dbError.message);
      setStep("val");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Kunde inte spara. Försök igen.");
    } finally {
      setBusy(false);
    }
  };

  const handleCreateJob = async (e: FormEvent) => {
    e.preventDefault();
    if (!jobCategory) { setError("Välj typ av jobb."); return; }
    if (!jobTimePrefs.length) { setError("Välj minst en arbetstid."); return; }
    setBusy(true);
    setError("");
    try {
      await createJob({
        title: jobTitle,
        city: jobCity || city,
        category: jobCategory,
        employment_type: jobTimePrefs.join(","),
        description: jobDescription,
        salary_per_hour: jobPay,
        requirements: "",
        benefits: "",
        company_name: companyName,
        image_url: "",
        min_age: jobMinAge ? parseInt(jobMinAge, 10) : null,
        max_age: jobMaxAge ? parseInt(jobMaxAge, 10) : null,
      });
      router.replace("/company?view=swipe");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Kunde inte skapa annonsen.");
      setBusy(false);
    }
  };

  if (loading || !user) {
    return (
      <main className="mobile-shell company-onboarding" style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
        <p style={{ color: "#737373", fontSize: "0.9rem" }}>Laddar...</p>
      </main>
    );
  }

  const chipBtn = (label: string, selected: boolean, onClick: () => void) => (
    <button
      key={label}
      type="button"
      onClick={onClick}
      style={{
        padding: "0.35rem 0.75rem",
        borderRadius: 999,
        fontSize: "0.82rem",
        fontWeight: 500,
        border: "1.5px solid",
        borderColor: selected ? "#111" : "#e8e8e8",
        background: selected ? "#111" : "#f5f5f5",
        color: selected ? "#fff" : "#555",
        cursor: "pointer",
      }}
    >
      {label}
    </button>
  );

  const labelStyle: React.CSSProperties = {
    fontSize: "0.78rem",
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: "0.06em",
    color: "#737373",
    display: "block",
    marginBottom: "0.35rem",
  };
  const profileQuestions = [
    "Vad heter ditt företag?",
    "Vilken bransch verkar ni inom?",
    "Vem är administratör?",
  ];

  return (
    <main className={`mobile-shell company-onboarding ${step === "profil" ? "company-profile-onboarding" : ""}`}>
      <datalist id="company-name-suggestions">{COMPANY_NAME_SUGGESTIONS.map((suggestion) => <option key={suggestion} value={suggestion} />)}</datalist>
      <datalist id="job-title-suggestions">{JOB_TITLE_SUGGESTIONS.map((suggestion) => <option key={suggestion} value={suggestion} />)}</datalist>
      <datalist id="city-suggestions">{CITY_SUGGESTIONS.map((suggestion) => <option key={suggestion} value={suggestion} />)}</datalist>
      <datalist id="address-suggestions">{ADDRESS_SUGGESTIONS.map((suggestion) => <option key={suggestion} value={suggestion} />)}</datalist>
      {/* ── STEP 1: Company profile ── */}
      {step === "profil" && (
        <form onSubmit={(e) => {
          e.preventDefault();
          if (profileQuestion < 2) {
            if (profileQuestion === 0 && !companyName.trim()) { setError("Ange företagets namn."); return; }
            if (profileQuestion === 1 && !industry.trim()) { setError("Ange företagets bransch."); return; }
            setError("");
            setProfileQuestion((current) => current + 1);
            return;
          }
          void handleSaveProfile(e);
        }}>
          <div style={{ marginBottom: "1.75rem", paddingTop: "0.5rem" }}>
            <h1 style={{ fontSize: "1.9rem", fontWeight: 800, letterSpacing: "-0.04em", color: "#111", margin: 0 }}>
              {profileQuestions[profileQuestion]}
            </h1>
            <p style={{ fontSize: "0.75rem", color: "#a3a3a3", fontWeight: 700, margin: "0.9rem 0 0" }}>{profileQuestion + 1} / 3</p>
            <div style={{ height: 4, marginTop: "0.55rem", overflow: "hidden", borderRadius: 999, background: "#e8e8e8" }}>
              <div style={{ width: `${((profileQuestion + 1) / 3) * 100}%`, height: "100%", borderRadius: 999, background: "#111111", transition: "width 0.25s ease" }} />
            </div>
          </div>

          {error && (
            <div style={{ borderRadius: 10, background: "#fff1f0", border: "1px solid #ffd6d3", padding: "0.75rem 1rem", fontSize: "0.85rem", color: "#c0392b", marginBottom: "1rem" }}>
              {error}
            </div>
          )}

          <div className="card profile-question-card" style={{ padding: "1.25rem" }}>
            {profileQuestion === 0 && <><label style={labelStyle}>Företagsnamn *</label><input
              className="h-14 w-full rounded-xl border border-[#e8e8e8] px-4 text-base"
              style={{ marginBottom: "0.85rem" }}
              placeholder="T.ex. Bergströms Bageri AB"
              list="company-name-suggestions"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              required
              autoFocus
            /></>}

            {profileQuestion === 1 && <><label style={labelStyle}>Bransch</label><input
              className="h-11 w-full rounded-xl border border-[#e8e8e8] px-3 text-sm"
              style={{ marginBottom: "0.85rem" }}
              placeholder="T.ex. IT, Bygg eller Restaurang"
              value={industry}
              onChange={(e) => setIndustry(e.target.value)}
              autoFocus
            /><div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", marginTop: "0.85rem" }}>{INDUSTRY_TIPS.map((item) => chipBtn(item, industry === item, () => setIndustry(item)))}</div></>}

            {profileQuestion === 2 && <><label style={labelStyle}>Administratör *</label><input
              className="h-11 w-full rounded-xl border border-[#e8e8e8] px-3 text-sm"
              style={{ marginBottom: "0.85rem" }}
              placeholder="För- och efternamn"
              value={administrator}
              onChange={(e) => setAdministrator(e.target.value)}
              required
              autoFocus
            /></>}
            {profileQuestion === 3 && <div><div style={{ display: "flex", gap: "0.5rem" }}><input className="input-field" placeholder="Skriv en roll" value={customRole} onChange={(e) => setCustomRole(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); const value = customRole.trim(); if (value) { setCommonRoles((items) => items.includes(value) ? items : [...items, value]); setCustomRole(""); } } }} /><button type="button" className="secondary-btn" style={{ padding: "0 .9rem" }} onClick={() => { const value = customRole.trim(); if (value) { setCommonRoles((items) => items.includes(value) ? items : [...items, value]); setCustomRole(""); } }}>Lägg till</button></div><div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", marginTop: "0.85rem" }}>{[...new Set([...COMMON_ROLES, ...commonRoles])].map((role) => chipBtn(role, commonRoles.includes(role), () => setCommonRoles((items) => toggleItem(items, role))))}</div></div>}
            {profileQuestion === 4 && <div><label style={labelStyle}>Stad</label><input className="input-field" placeholder="Stad" list="city-suggestions" value={city} onChange={(e) => setCity(e.target.value)} autoFocus /><label style={{ ...labelStyle, marginTop: "1rem" }}>Adress</label><input className="input-field" placeholder="T.ex. Storgatan 12" list="address-suggestions" value={address} onChange={(e) => setAddress(e.target.value)} /></div>}
            {profileQuestion === 5 && <div><div style={{ display: "flex", gap: "0.5rem" }}><input className="input-field" placeholder="Skriv en egen prioritering" value={customPriority} onChange={(e) => setCustomPriority(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); const value = customPriority.trim(); if (value) { setHiringPriorities((items) => items.includes(value) ? items : [...items, value]); setCustomPriority(""); } } }} autoFocus /><button type="button" className="secondary-btn" style={{ padding: "0 .9rem" }} onClick={() => { const value = customPriority.trim(); if (value) { setHiringPriorities((items) => items.includes(value) ? items : [...items, value]); setCustomPriority(""); } }}>Lägg till</button></div><div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", marginTop: "0.85rem" }}>{[...new Set([...HIRING_PRIORITIES, ...hiringPriorities])].map((priority) => chipBtn(priority, hiringPriorities.includes(priority), () => setHiringPriorities((items) => toggleItem(items, priority))))}</div></div>}
            {profileQuestion === 6 && <><label style={labelStyle}>Beskrivning</label><textarea
              rows={3}
              className="w-full rounded-xl border border-[#e8e8e8] px-3 py-3 text-sm"
              style={{ marginBottom: "0.25rem" }}
              placeholder="Beskriv er verksamhet kort..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              autoFocus
            /></>}
            {profileQuestion === 7 && <div><p style={{ margin: "0 0 1rem", color: "#63777b", fontSize: "0.9rem", lineHeight: 1.5 }}>En komplett profil hjälper kandidater att lära känna ert företag.</p><label style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "0.6rem", padding: "1.5rem", border: "1.5px dashed #d7dfd6", borderRadius: 12, cursor: uploadingLogo ? "wait" : "pointer", color: "#63777b", background: "rgba(255,255,255,.55)" }}><input type="file" accept="image/png,image/jpeg" style={{ display: "none" }} disabled={uploadingLogo} onChange={(e) => { const file = e.target.files?.[0]; if (!file) return; setLogoName(file.name); setUploadingLogo(true); setError(""); void uploadJobImage(file).then(setLogoUrl).catch((uploadError) => setError(uploadError instanceof Error ? uploadError.message : "Kunde inte ladda upp logotypen.")).finally(() => setUploadingLogo(false)); }} />{logoUrl ? <img src={logoUrl} alt="Företagslogotyp" style={{ width: 56, height: 56, objectFit: "contain", borderRadius: 10 }} /> : <span style={{ fontSize: "1.7rem" }}>↑</span>}<strong>{uploadingLogo ? "Laddar upp..." : logoName || "Lägg till logotyp"}</strong><span style={{ fontSize: "0.78rem" }}>PNG eller JPG · valfritt</span></label><div style={{ display: "grid", gap: "0.7rem", marginTop: "1rem" }}><input className="input-field" type="url" placeholder="Webbplats" value={websiteUrl} onChange={(e) => setWebsiteUrl(e.target.value)} /><input className="input-field" type="url" placeholder="LinkedIn" value={linkedinUrl} onChange={(e) => setLinkedinUrl(e.target.value)} /><input className="input-field" type="url" placeholder="Instagram" value={instagramUrl} onChange={(e) => setInstagramUrl(e.target.value)} /><input className="input-field" type="url" placeholder="Facebook" value={facebookUrl} onChange={(e) => setFacebookUrl(e.target.value)} /><input className="input-field" type="url" placeholder="TikTok" value={tiktokUrl} onChange={(e) => setTiktokUrl(e.target.value)} /><input className="input-field" type="url" placeholder="X" value={xUrl} onChange={(e) => setXUrl(e.target.value)} /></div></div>}
          </div>

          <div className="profile-actions" style={{ display: "flex", gap: "0.6rem", paddingTop: "1rem" }}>
            {profileQuestion > 0 && <button type="button" className="secondary-btn" style={{ padding: "0.9rem" }} onClick={() => setProfileQuestion((current) => current - 1)}>← Tillbaka</button>}
            <button type="submit" className="cta-btn" style={{ flex: 1, padding: "0.9rem", fontSize: "0.95rem" }} disabled={busy || uploadingLogo}>{busy ? "Sparar..." : profileQuestion === 2 ? "Spara och fortsätt →" : "Nästa →"}</button>
          </div>
        </form>
      )}

      {/* ── STEP 2: Choice ── */}
      {step === "val" && (
        <div style={{ display: "flex", minHeight: "calc(100svh - 6.25rem)", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center" }}>
          <p style={{ margin: 0, color: "#737373", fontSize: "1.05rem", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase" }}>Välkommen till Employo</p>
          <h1 style={{ margin: "0.75rem 0", color: "#111", fontSize: "clamp(3.2rem, 10vw, 4.5rem)", letterSpacing: "-0.06em", lineHeight: 0.95 }}>Kontot är skapat! 🎉</h1>
          <p style={{ maxWidth: "31rem", margin: "0 0 2.25rem", color: "#555", fontSize: "1.3rem", lineHeight: 1.55 }}>Vill du skapa din första jobbannons nu eller gå in på ditt konto?</p>
          <button type="button" className="cta-btn" onClick={() => { setError(""); setStep("annons"); }} style={{ width: "min(100%, 31rem)", padding: "1.3rem", fontSize: "1.2rem" }}>Fortsätt skapa min jobbannons</button>
          <button type="button" className="secondary-btn" onClick={() => router.replace("/company?view=swipe")} style={{ width: "min(100%, 31rem)", marginTop: "0.85rem", padding: "1.3rem", fontSize: "1.15rem" }}>Gå till mitt konto</button>
        </div>
      )}

      {/* ── STEP 3: Job form ── */}
      {step === "annons" && (
        <form onSubmit={(e) => void handleCreateJob(e)}>
          <div style={{ marginBottom: "1.25rem", paddingTop: "0.5rem" }}>
            <p style={{ fontSize: "0.7rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#a3a3a3", margin: 0 }}>
              Employo
            </p>
            <h1 style={{ fontSize: "1.6rem", fontWeight: 800, letterSpacing: "-0.03em", color: "#111", margin: "0.2rem 0 0.4rem" }}>
              Skapa jobbannons
            </h1>
            <p style={{ fontSize: "0.85rem", color: "#737373", margin: 0 }}>
              Fyll i kriterierna – de används för att matcha rätt ungdomar till ditt jobb.
            </p>
          </div>

          {error && (
            <div style={{ borderRadius: 10, background: "#fff1f0", border: "1px solid #ffd6d3", padding: "0.75rem 1rem", fontSize: "0.85rem", color: "#c0392b", marginBottom: "1rem" }}>
              {error}
            </div>
          )}

          <div className="card" style={{ padding: "1.25rem" }}>
            <label style={labelStyle}>Annonstitel *</label>
            <input
              className="h-11 w-full rounded-xl border border-[#e8e8e8] px-3 text-sm"
              style={{ marginBottom: "0.85rem" }}
              placeholder="T.ex. Butikssäljare, Sommarjobbare på café"
              list="job-title-suggestions"
              value={jobTitle}
              onChange={(e) => setJobTitle(e.target.value)}
              required
              autoFocus
            />

            <label style={labelStyle}>Stad *</label>
            <input
              className="h-11 w-full rounded-xl border border-[#e8e8e8] px-3 text-sm"
              style={{ marginBottom: "0.85rem" }}
              placeholder="T.ex. Stockholm"
              list="city-suggestions"
              value={jobCity}
              onChange={(e) => setJobCity(e.target.value)}
              required
            />

            <label style={{ ...labelStyle, marginBottom: "0.5rem" }}>Typ av jobb *</label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem", marginBottom: "0.85rem" }}>
              {JOB_CATEGORIES.map((cat) =>
                chipBtn(cat, jobCategory === cat, () => setJobCategory((c) => (c === cat ? "" : cat)))
              )}
            </div>

            <label style={{ ...labelStyle, marginBottom: "0.5rem" }}>
              Arbetstider *{" "}
              <span style={{ fontWeight: 400, textTransform: "none", letterSpacing: 0 }}>(välj en eller flera)</span>
            </label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem", marginBottom: "0.85rem" }}>
              {TIME_OPTIONS.map((opt) =>
                chipBtn(opt, jobTimePrefs.includes(opt), () =>
                  setJobTimePrefs((prev) => toggleItem(prev, opt))
                )
              )}
            </div>

            <label style={labelStyle}>Ålderskrav (valfritt)</label>
            <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", marginBottom: "0.85rem" }}>
              <input
                type="number"
                min={13}
                max={30}
                className="h-11 rounded-xl border border-[#e8e8e8] px-3 text-sm"
                style={{ flex: 1 }}
                placeholder="Min ålder"
                value={jobMinAge}
                onChange={(e) => setJobMinAge(e.target.value)}
              />
              <span style={{ color: "#a3a3a3", fontWeight: 600 }}>–</span>
              <input
                type="number"
                min={13}
                max={30}
                className="h-11 rounded-xl border border-[#e8e8e8] px-3 text-sm"
                style={{ flex: 1 }}
                placeholder="Max ålder"
                value={jobMaxAge}
                onChange={(e) => setJobMaxAge(e.target.value)}
              />
            </div>

            <label style={labelStyle}>Timlön (valfritt)</label>
            <input
              className="h-11 w-full rounded-xl border border-[#e8e8e8] px-3 text-sm"
              style={{ marginBottom: "0.85rem" }}
              placeholder="T.ex. 130 kr/h"
              value={jobPay}
              onChange={(e) => setJobPay(e.target.value)}
            />

            <label style={labelStyle}>Beskrivning *</label>
            <textarea
              rows={4}
              className="w-full rounded-xl border border-[#e8e8e8] px-3 py-3 text-sm"
              style={{ marginBottom: "0.25rem" }}
              placeholder="Beskriv jobbet, arbetsuppgifter och vad ni erbjuder..."
              value={jobDescription}
              onChange={(e) => setJobDescription(e.target.value)}
              required
            />
          </div>

          <div style={{ display: "flex", gap: "0.6rem", marginTop: "1rem" }}>
            <button
              type="button"
              className="secondary-btn"
              style={{ padding: "0.875rem", fontSize: "0.9rem", flexShrink: 0 }}
              onClick={() => { setError(""); setStep("val"); }}
            >
              ← Tillbaka
            </button>
            <button
              type="submit"
              className="cta-btn"
              style={{ flex: 1, padding: "0.9rem", fontSize: "0.95rem" }}
              disabled={busy}
            >
              {busy ? "Publicerar..." : "Publicera annons"}
            </button>
          </div>
        </form>
      )}
    </main>
  );
}
