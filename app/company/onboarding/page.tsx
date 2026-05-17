"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "@/hooks/use-session";
import { getSupabaseClient } from "@/lib/supabase";
import { createJob } from "@/lib/jobs";

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

type Step = "profil" | "val" | "annons";

function toggleItem(arr: string[], item: string): string[] {
  return arr.includes(item) ? arr.filter((x) => x !== item) : [...arr, item];
}

export default function CompanyOnboardingPage() {
  const router = useRouter();
  const { user, profile, loading } = useSession();

  const [step, setStep] = useState<Step>("profil");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  // Company profile form
  const [companyName, setCompanyName] = useState("");
  const [city, setCity] = useState("");
  const [description, setDescription] = useState("");

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
    if (!loading && !user) router.replace("/auth");
    if (!loading && profile && profile.role !== "company") router.replace("/dashboard");
  }, [loading, user, profile, router]);

  const handleSaveProfile = async (e: FormEvent) => {
    e.preventDefault();
    if (!companyName.trim()) { setError("Ange företagets namn."); return; }
    setBusy(true);
    setError("");
    try {
      const supabase = getSupabaseClient();
      const { error: dbError } = await supabase
        .from("company_profiles")
        .update({
          company_name: companyName.trim(),
          city: city.trim(),
          description: description.trim(),
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
      router.replace("/company");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Kunde inte skapa annonsen.");
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

  return (
    <main className="mobile-shell">
      {/* ── STEP 1: Company profile ── */}
      {step === "profil" && (
        <form onSubmit={(e) => void handleSaveProfile(e)}>
          <div style={{ marginBottom: "1.75rem", paddingTop: "0.5rem" }}>
            <p style={{ fontSize: "0.7rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#a3a3a3", margin: 0 }}>
              WorkSpot
            </p>
            <h1 style={{ fontSize: "1.6rem", fontWeight: 800, letterSpacing: "-0.03em", color: "#111", margin: "0.2rem 0 0.4rem" }}>
              Välkommen!
            </h1>
            <p style={{ fontSize: "0.9rem", color: "#737373", margin: 0 }}>
              Berätta lite om ditt företag så vi kan komma igång.
            </p>
          </div>

          {error && (
            <div style={{ borderRadius: 10, background: "#fff1f0", border: "1px solid #ffd6d3", padding: "0.75rem 1rem", fontSize: "0.85rem", color: "#c0392b", marginBottom: "1rem" }}>
              {error}
            </div>
          )}

          <div className="card" style={{ padding: "1.25rem" }}>
            <label style={labelStyle}>Företagsnamn *</label>
            <input
              className="h-11 w-full rounded-xl border border-[#e8e8e8] px-3 text-sm"
              style={{ marginBottom: "0.85rem" }}
              placeholder="T.ex. Bergströms Bageri AB"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              required
              autoFocus
            />

            <label style={labelStyle}>Stad</label>
            <input
              className="h-11 w-full rounded-xl border border-[#e8e8e8] px-3 text-sm"
              style={{ marginBottom: "0.85rem" }}
              placeholder="T.ex. Göteborg"
              value={city}
              onChange={(e) => setCity(e.target.value)}
            />

            <label style={labelStyle}>Kort beskrivning (valfritt)</label>
            <textarea
              rows={3}
              className="w-full rounded-xl border border-[#e8e8e8] px-3 py-3 text-sm"
              style={{ marginBottom: "0.25rem" }}
              placeholder="Beskriv er verksamhet kort..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <button
            type="submit"
            className="cta-btn"
            style={{ width: "100%", padding: "0.9rem", fontSize: "0.95rem", marginTop: "1rem" }}
            disabled={busy}
          >
            {busy ? "Sparar..." : "Nästa →"}
          </button>
        </form>
      )}

      {/* ── STEP 2: Choice ── */}
      {step === "val" && (
        <div>
          <div style={{ marginBottom: "1.75rem", paddingTop: "0.5rem" }}>
            <p style={{ fontSize: "0.7rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#a3a3a3", margin: 0 }}>
              WorkSpot
            </p>
            <h1 style={{ fontSize: "1.6rem", fontWeight: 800, letterSpacing: "-0.03em", color: "#111", margin: "0.2rem 0 0.4rem" }}>
              Profil sparad! 🎉
            </h1>
            <p style={{ fontSize: "0.9rem", color: "#737373", margin: 0 }}>
              Vill du skapa din första jobbannons nu? Det tar bara någon minut.
            </p>
          </div>

          <div className="card" style={{ padding: "1.5rem" }}>
            <p style={{ fontSize: "0.9rem", color: "#555", lineHeight: 1.55, marginBottom: "1.25rem" }}>
              En jobbannons hjälper unga att hitta just ditt jobb. Du ställer in matchningskraven
              – stad, åldersintervall, jobtyp och arbetstider – så visas din annons för rätt
              kandidater.
            </p>
            <button
              type="button"
              className="cta-btn"
              style={{ width: "100%", padding: "0.9rem", fontSize: "0.95rem", marginBottom: "0.6rem" }}
              onClick={() => { setError(""); setStep("annons"); }}
            >
              Skapa annons nu
            </button>
            <button
              type="button"
              className="secondary-btn"
              style={{ width: "100%", padding: "0.875rem", fontSize: "0.9rem" }}
              onClick={() => router.replace("/company")}
            >
              Gör det senare
            </button>
          </div>
        </div>
      )}

      {/* ── STEP 3: Job form ── */}
      {step === "annons" && (
        <form onSubmit={(e) => void handleCreateJob(e)}>
          <div style={{ marginBottom: "1.25rem", paddingTop: "0.5rem" }}>
            <p style={{ fontSize: "0.7rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#a3a3a3", margin: 0 }}>
              WorkSpot
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
