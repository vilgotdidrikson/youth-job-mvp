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

const VALUE_TIPS = ["Ansvar", "Gemenskap", "Utveckling", "Service", "Kvalitet", "Hållbarhet"];
const TRAIT_TIPS = ["Ansvarstagande", "Nyfiken", "Punktlig", "Serviceinriktad", "Samarbetsvillig", "Initiativrik"];

function splitList(value: string): string[] {
  return value.split(/[,\n]+/).map((item) => item.trim()).filter(Boolean).slice(0, 10);
}

function toggleListValue(value: string, item: string): string {
  const items = splitList(value);
  return items.includes(item) ? items.filter((entry) => entry !== item).join(", ") : [...items, item].join(", ");
}

export function CompanyMatchProfileForm({ userId, embedded = false }: { userId: string; embedded?: boolean }) {
  const [draft, setDraft] = useState<CompanyMatchProfileDraft>(EMPTY);
  const [valuesText, setValuesText] = useState("");
  const [traitsText, setTraitsText] = useState("");
  const [activeStep, setActiveStep] = useState<1 | 2 | 3>(1);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const completed = useMemo(() => [draft.culture_summary, valuesText, traitsText, draft.work_environment, draft.onboarding_support, draft.employee_offer].filter((value) => value.trim()).length, [draft, traitsText, valuesText]);
  const progress = Math.round((completed / 6) * 100);

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
      setMessage("Sparad. Profilen används automatiskt som grund för era annonser.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Kunde inte spara matchprofilen.");
    } finally { setSaving(false); }
  };

  if (loading) return <section className={`company-match-profile${embedded ? " is-embedded" : ""}`}><p className="company-match-loading">Laddar matchprofil...</p></section>;

  const steps = [
    { number: 1 as const, label: "Kultur" },
    { number: 2 as const, label: "Värderingar" },
    { number: 3 as const, label: "Erbjudande" },
  ];

  return <section className={`company-match-profile${embedded ? " is-embedded" : ""}`}>
    <header className="company-match-header">
      <div><p>Företagets grundprofil</p><h2>Så hittar vi rätt personer åt er</h2></div>
      <span>{completed === 6 ? "Komplett" : `${completed}/6 ifyllt`}</span>
    </header>
    <p className="company-match-intro">Fyll i detta en gång. Informationen kombineras sedan med kraven för varje enskild annons.</p>
    <div className="company-match-progress" aria-label={`${progress} procent av matchprofilen är ifylld`}><i style={{ width: `${progress}%` }} /></div>
    <nav className="company-match-steps" aria-label="Delar i företagets matchprofil">
      {steps.map((step) => <button key={step.number} type="button" className={activeStep === step.number ? "is-active" : ""} onClick={() => { setActiveStep(step.number); setMessage(""); }}><span>{step.number}</span>{step.label}</button>)}
    </nav>

    <div className="company-match-fields">
      {activeStep === 1 && <>
        <div className="company-match-step-copy"><strong>Kultur och arbetssätt</strong><p>Hjälp kandidaten förstå hur det faktiskt känns att arbeta hos er.</p></div>
        <label>Hur skulle ni beskriva kulturen?<textarea className="input-field" rows={3} placeholder="T.ex. prestigelöst, högt tempo och nära samarbete" value={draft.culture_summary} onChange={(event) => setDraft((current) => ({ ...current, culture_summary: event.target.value }))} /></label>
        <label>Hur ser arbetsmiljön ut?<textarea className="input-field" rows={3} placeholder="Tempo, teamstorlek och hur ni arbetar tillsammans" value={draft.work_environment} onChange={(event) => setDraft((current) => ({ ...current, work_environment: event.target.value }))} /></label>
      </>}

      {activeStep === 2 && <>
        <div className="company-match-step-copy"><strong>Vad uppskattar ni hos människor?</strong><p>Välj förslag eller skriv egna. Detta är inte samma sak som absoluta jobbkrav.</p></div>
        <label>Viktigaste värderingarna<input className="input-field" placeholder="Separera med kommatecken" value={valuesText} onChange={(event) => setValuesText(event.target.value)} /></label>
        <div className="company-match-chips">{VALUE_TIPS.map((tip) => { const selected = splitList(valuesText).includes(tip); return <button key={tip} type="button" aria-pressed={selected} className={selected ? "is-selected" : ""} onClick={() => setValuesText((current) => toggleListValue(current, tip))}>{tip}</button>; })}</div>
        <label>Egenskaper ni brukar uppskatta<input className="input-field" placeholder="Separera med kommatecken" value={traitsText} onChange={(event) => setTraitsText(event.target.value)} /></label>
        <div className="company-match-chips">{TRAIT_TIPS.map((tip) => { const selected = splitList(traitsText).includes(tip); return <button key={tip} type="button" aria-pressed={selected} className={selected ? "is-selected" : ""} onClick={() => setTraitsText((current) => toggleListValue(current, tip))}>{tip}</button>; })}</div>
      </>}

      {activeStep === 3 && <>
        <div className="company-match-step-copy"><strong>Vad får den som börjar hos er?</strong><p>Beskriv stödet i början och det som gör arbetsplatsen attraktiv.</p></div>
        <label>Introduktion och stöttning<textarea className="input-field" rows={3} placeholder="T.ex. introduktionspass, handledare och tydliga rutiner" value={draft.onboarding_support} onChange={(event) => setDraft((current) => ({ ...current, onboarding_support: event.target.value }))} /></label>
        <label>Vad erbjuder ni medarbetaren?<textarea className="input-field" rows={3} placeholder="T.ex. utveckling, flexibilitet, gemenskap eller förmåner" value={draft.employee_offer} onChange={(event) => setDraft((current) => ({ ...current, employee_offer: event.target.value }))} /></label>
      </>}
    </div>

    {error && <p className="company-match-error">{error}</p>}
    {message && <p role="status" className="company-match-success">✓ {message}</p>}
    <footer className="company-match-actions">
      {activeStep > 1 && <button type="button" className="secondary-btn" onClick={() => setActiveStep((activeStep - 1) as 1 | 2)}>Tillbaka</button>}
      {activeStep < 3 && <button type="button" className="secondary-btn" onClick={() => setActiveStep((activeStep + 1) as 2 | 3)}>Nästa</button>}
      <button type="button" className="cta-btn" disabled={saving} onClick={() => void save()}>{saving ? "Sparar..." : activeStep === 3 ? "Spara matchprofil" : "Spara"}</button>
    </footer>
  </section>;
}
