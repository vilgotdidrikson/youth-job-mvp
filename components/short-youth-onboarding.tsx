"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "@/hooks/use-session";
import { MISSING_FULL_NAME_MESSAGE, normalizeFullName, saveYouthAccountDetails } from "@/lib/onboarding";
import { getYouthFlowState } from "@/lib/youth-job-flow";
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

  if (!ready) return <main className="mobile-shell" style={{ display: "grid", placeItems: "center", minHeight: "100vh" }}><p>Laddar...</p></main>;
  return <main className="youth-onboarding" style={{ minHeight: "100vh", maxWidth: 430, margin: "0 auto", padding: "2rem 1.25rem", background: "#fff" }}>
    <p style={{ color: "#737373", fontSize: ".8rem", fontWeight: 700 }}>STEG {step + 1} AV 2</p>
    <div style={{ height: 7, background: "#eee", borderRadius: 99, marginBottom: "2rem" }}><div style={{ width: `${(step + 1) * 50}%`, height: "100%", borderRadius: 99, background: "var(--color-brand)" }} /></div>
    <h1 style={{ fontSize: "2rem", margin: 0 }}>{step === 0 ? "Berätta vad du heter" : "Var kan du jobba?"}</h1>
    <p style={{ color: "#666", lineHeight: 1.5 }}>{step === 0 ? "Vi behöver ditt fullständiga namn och födelsedatum." : "Ort och postnummer hjälper oss att visa relevanta jobb."}</p>
    {step === 0 ? <><label style={{ display: "grid", gap: ".4rem", marginTop: "1.5rem" }}>Fullständigt namn<input className="input-field" value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} autoFocus /></label><label style={{ display: "grid", gap: ".4rem", marginTop: "1rem" }}>Födelsedatum<input className="input-field" type="date" value={form.dateOfBirth} onChange={(e) => setForm({ ...form, dateOfBirth: e.target.value })} /></label></> : <><label style={{ display: "grid", gap: ".4rem", marginTop: "1.5rem" }}>Ort<input className="input-field" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} autoFocus /></label><label style={{ display: "grid", gap: ".4rem", marginTop: "1rem" }}>Postnummer<input className="input-field" inputMode="numeric" value={form.postalCode} onChange={(e) => setForm({ ...form, postalCode: e.target.value })} /></label></>}
    {error && <p style={{ color: "#b42318", fontSize: ".9rem" }}>{error}</p>}
    <div style={{ display: "flex", gap: ".75rem", marginTop: "2rem" }}>{step > 0 && <button className="secondary-btn" type="button" onClick={() => { setError(""); setStep(0); }}>Tillbaka</button>}<button className="cta-btn" type="button" style={{ flex: 1 }} disabled={saving} onClick={() => step === 0 ? (normalizeFullName(form.fullName) && form.dateOfBirth ? (setError(""), setStep(1)) : setError("Fyll i fullständigt namn och födelsedatum.")) : void save()}>{saving ? "Sparar..." : step === 0 ? "Nästa" : "Klart"}</button></div>
  </main>;
}
