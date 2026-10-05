"use client";

import { useEffect, useMemo, useState } from "react";
import { getCompanyMatchProfile, saveCompanyMatchProfile, type CompanyMatchProfileDraft } from "@/lib/match-profiles";

const EMPTY: CompanyMatchProfileDraft = {
  culture_summary: "",
  company_values: [],
  valued_traits: [],
  work_environment: "",
  onboarding_support: "",
  employee_offer: "",
};

function splitList(value: string): string[] {
  return value.split(/[,\n]+/).map((item) => item.trim()).filter(Boolean).slice(0, 10);
}

export function CompanyMatchProfileForm({ userId }: { userId: string }) {
  const [draft, setDraft] = useState<CompanyMatchProfileDraft>(EMPTY);
  const [valuesText, setValuesText] = useState("");
  const [traitsText, setTraitsText] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const completed = useMemo(() => [draft.culture_summary, valuesText, traitsText, draft.work_environment, draft.onboarding_support, draft.employee_offer].filter((value) => value.trim()).length, [draft, traitsText, valuesText]);

  useEffect(() => {
    let active = true;
    void getCompanyMatchProfile(userId)
      .then((profile) => {
        if (!active || !profile) return;
        setDraft({
          culture_summary: profile.culture_summary,
          company_values: profile.company_values,
          valued_traits: profile.valued_traits,
          work_environment: profile.work_environment,
          onboarding_support: profile.onboarding_support,
          employee_offer: profile.employee_offer,
        });
        setValuesText(profile.company_values.join(", "));
        setTraitsText(profile.valued_traits.join(", "));
      })
      .catch((reason) => { if (active) setError(reason instanceof Error ? reason.message : "Kunde inte läsa matchprofilen."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [userId]);

  const save = async () => {
    setSaving(true); setError(""); setMessage("");
    try {
      await saveCompanyMatchProfile(userId, {
        ...draft,
        company_values: splitList(valuesText),
        valued_traits: splitList(traitsText),
      });
      setMessage("Matchprofilen är sparad och används som grund för era annonser.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Kunde inte spara matchprofilen.");
    } finally { setSaving(false); }
  };

  if (loading) return <section className="card" style={{ padding: "1.25rem", marginBottom: ".75rem" }}><p>Laddar matchprofil...</p></section>;

  return <section className="card" style={{ padding: "1.25rem", marginBottom: ".75rem" }}>
    <p style={{ fontSize: ".72rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: ".08em", color: "#a3a3a3", marginBottom: ".45rem" }}>Matchning · {completed}/6 delar</p>
    <h2 style={{ margin: 0, fontSize: "1.2rem" }}>Er allmänna matchprofil</h2>
    <p style={{ color: "#737373", fontSize: ".86rem", lineHeight: 1.5 }}>Fyll i detta en gång. Employo återanvänder svaren när en matchprofil skapas för varje annons.</p>
    <div style={{ display: "grid", gap: ".9rem" }}>
      <label>Hur skulle ni beskriva kulturen?<textarea className="input-field" rows={3} placeholder="T.ex. prestigelöst, högt tempo och nära samarbete" value={draft.culture_summary} onChange={(event) => setDraft((current) => ({ ...current, culture_summary: event.target.value }))} /></label>
      <label>Viktigaste värderingarna<input className="input-field" placeholder="Separera med kommatecken" value={valuesText} onChange={(event) => setValuesText(event.target.value)} /></label>
      <label>Egenskaper ni brukar uppskatta<input className="input-field" placeholder="T.ex. ansvarstagande, nyfiken, serviceinriktad" value={traitsText} onChange={(event) => setTraitsText(event.target.value)} /></label>
      <label>Hur ser arbetsmiljön ut?<textarea className="input-field" rows={2} placeholder="Tempo, teamstorlek och arbetssätt" value={draft.work_environment} onChange={(event) => setDraft((current) => ({ ...current, work_environment: event.target.value }))} /></label>
      <label>Vilken introduktion och stöttning får en ny person?<textarea className="input-field" rows={2} value={draft.onboarding_support} onChange={(event) => setDraft((current) => ({ ...current, onboarding_support: event.target.value }))} /></label>
      <label>Vad erbjuder ni medarbetaren?<textarea className="input-field" rows={2} placeholder="Utveckling, flexibilitet, gemenskap eller förmåner" value={draft.employee_offer} onChange={(event) => setDraft((current) => ({ ...current, employee_offer: event.target.value }))} /></label>
    </div>
    {error && <p style={{ color: "#b42318", fontSize: ".84rem" }}>{error}</p>}
    {message && <p role="status" style={{ color: "#1a7f4b", fontSize: ".84rem" }}>{message}</p>}
    <button type="button" className="cta-btn" style={{ width: "100%", marginTop: "1rem" }} disabled={saving} onClick={() => void save()}>{saving ? "Sparar..." : "Spara matchprofil"}</button>
  </section>;
}
