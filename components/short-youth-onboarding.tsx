"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "@/hooks/use-session";
import { MISSING_FULL_NAME_MESSAGE, normalizeFullName, saveYouthAccountDetails } from "@/lib/onboarding";
import { getYouthFlowState } from "@/lib/youth-job-flow";
import Link from "next/link";
import { UiIcon } from "@/components/ui-icon";
import "@/app/onboarding-design.css";
import { getSupabaseClient } from "@/lib/supabase";

type Form = { fullName: string; dateOfBirth: string; city: string; postalCode: string };
const emptyForm: Form = { fullName: "", dateOfBirth: "", city: "", postalCode: "" };

export function ShortYouthOnboarding() {
  const { user, profile, loading } = useSession();
  const router = useRouter();
  const [form, setForm] = useState<Form>(emptyForm);
  const [step, setStep] = useState(0);
  const [ready, setReady] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (loading) return;
    if (!user) { router.replace("/login"); return; }
    if (profile?.role === "company") { router.replace("/company?view=swipe"); return; }
    if (profile?.role === "private") { router.replace("/private"); return; }
    if (profile?.role !== "youth") return;
    void (async () => {
      try {
        const [state, result] = await Promise.all([
          getYouthFlowState(user.id),
          getSupabaseClient().from("youth_profiles").select("full_name, date_of_birth, city, postal_code").eq("user_id", user.id).maybeSingle(),
        ]);
        if (state.shortOnboardingCompleted) { router.replace("/swipe"); return; }
        const data = result.data;
        setForm({ fullName: data?.full_name ?? "", dateOfBirth: data?.date_of_birth ?? "", city: data?.city ?? "", postalCode: data?.postal_code ?? "" });
      } catch (reason) { setError(reason instanceof Error ? reason.message : "Kunde inte ladda dina uppgifter."); }
      finally { setReady(true); }
    })();
  }, [loading, profile?.role, router, user]);

  const save = async () => {
    const name = normalizeFullName(form.fullName);
    if (!name) { setError(MISSING_FULL_NAME_MESSAGE); setStep(0); return; }
    if (!form.dateOfBirth || !form.city.trim() || !form.postalCode.trim()) { setError("Fyll i födelsedatum, ort och postnummer för att fortsätta."); setStep(1); return; }
    setSaving(true); setError("");
    try {
      await saveYouthAccountDetails({ full_name: name, date_of_birth: form.dateOfBirth, city: form.city, postal_code: form.postalCode, address: "", additional_addresses: [] });
      const { error: updateError } = await getSupabaseClient().from("youth_profiles").update({ short_onboarding_completed: true }).eq("user_id", user?.id);
      if (updateError) throw new Error(updateError.message);
      router.replace("/swipe?welcome=1");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Kunde inte spara dina uppgifter."); }
    finally { setSaving(false); }
  };

  if (!ready) return <main className="mnw-onboarding"><p role="status">Hämtar dina uppgifter…</p></main>;
  return <main className="mnw-onboarding"><Link href="/" className="mnw-onboarding-brand">MatchnWork</Link><div className="mnw-onboarding-layout"><aside className="mnw-onboarding-intro"><span className="mnw-onboarding-mark"><UiIcon name="discover" width="36" height="36"/></span><p>Ditt nästa steg börjar här</p><h1>Små steg.<br/>Nya möjligheter.</h1><p>Vi lär känna dig lite, så att du kan börja upptäcka jobb nära dig.</p><div className="mnw-onboarding-reassurance"><UiIcon name="info"/><span>Du kan utforska jobb först och göra klart ditt CV senare.</span></div></aside><section className="mnw-onboarding-card"><header><span>Steg {step + 1} av 2</span><p>{step === 0 ? "Om dig" : "Din plats"}</p></header><div className="mnw-onboarding-progress" role="progressbar" aria-label="Onboarding" aria-valuemin={0} aria-valuemax={2} aria-valuenow={step + 1}><span style={{width:`${(step + 1) * 50}%`}}/></div><h2>{step === 0 ? "Vad heter du?" : "Var vill du börja?"}</h2><p className="mnw-onboarding-lead">{step === 0 ? "Börja med ditt fullständiga namn och födelsedatum." : "Ort och postnummer hjälper oss att visa jobb som är relevanta för dig."}</p>
    <form onSubmit={event => {event.preventDefault();if(step === 0){if(normalizeFullName(form.fullName) && form.dateOfBirth){setError("");setStep(1);}else setError("Fyll i fullständigt namn och födelsedatum.");}else void save();}}>
    {step === 0 ? <><label>Fullständigt namn<input value={form.fullName} onChange={event => setForm({...form,fullName:event.target.value})} autoComplete="name" placeholder="Förnamn och efternamn" autoFocus required/></label><label>Födelsedatum<input type="date" value={form.dateOfBirth} onChange={event => setForm({...form,dateOfBirth:event.target.value})} autoComplete="bday" required/></label></> : <><label>Ort<input value={form.city} onChange={event => setForm({...form,city:event.target.value})} autoComplete="address-level2" placeholder="Till exempel Stockholm" autoFocus required/></label><label>Postnummer<input inputMode="numeric" value={form.postalCode} onChange={event => setForm({...form,postalCode:event.target.value})} autoComplete="postal-code" placeholder="123 45" required/></label></>}
    {error && <p className="mnw-onboarding-error" role="alert">{error}</p>}
    <footer>{step > 0 && <button className="secondary-btn" type="button" disabled={saving} onClick={() => {setError("");setStep(0);}}>Tillbaka</button>}<button className="cta-btn" type="submit" disabled={saving}>{saving ? "Sparar…" : step === 0 ? "Fortsätt" : "Upptäck jobb"}<UiIcon name="arrow" width="18"/></button></footer></form></section></div></main>;
}
