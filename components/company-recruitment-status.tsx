"use client";
import { useEffect, useState } from "react";
import { getSupabaseClient } from "@/lib/supabase";
import { subscribeVisibleRefresh } from "@/lib/visible-refresh";
import styles from "./recruitment.module.css";

export function CompanyRecruitmentStatus({ userId }: { userId: string }) {
  const [control, setControl] = useState<{ restriction: string; reason: string } | null>(null), [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    const refresh = async () => {
      const { data, error } = await getSupabaseClient().from("company_recruitment_controls").select("restriction,reason").eq("company_user_id", userId).maybeSingle();
      if (active) { setControl(data); setError(error ? "Kunde inte läsa företagets rekryteringsbehörighet." : ""); }
    };
    void refresh(); const unsubscribe = subscribeVisibleRefresh(refresh);
    return () => { active = false; unsubscribe(); };
  }, [userId]);
  if (error) return <p role="alert" className={styles.error}>{error}</p>;
  if (!control || control.restriction === "none") return null;
  return <section className={styles.restriction}><strong>{control.restriction === "suspended" ? "Rekrytering avstängd" : "Nya rekryteringar pausade"}</strong><p>Nya annonser och kandidatkontakter är pausade. Befintliga chattar och registrering av anställningar finns kvar.</p><p>Skäl: {control.reason}</p><p>Kontakta MatchnWork om du vill bemöta beslutet.</p></section>;
}
