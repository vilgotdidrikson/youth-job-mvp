"use client";
import { useEffect, useState } from "react";
import { getSupabaseClient } from "@/lib/supabase";
import { readRecruitmentProfile, recruitmentProfileSource, completedProfileSections, DAYS, PERIODS, STRENGTHS, type RecruitmentProfile } from "@/lib/recruitment-profile";
import { subscribeVisibleRefresh } from "@/lib/visible-refresh";
import styles from "./recruitment-profile.module.css";

export function CandidateRecruitmentProfile({ jobId, youthId }: { jobId: string; youthId: string }) {
  const [profile, setProfile] = useState<RecruitmentProfile | null>(null), [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    const refresh = async () => {
      const { data, error } = await getSupabaseClient().rpc("get_candidate_assessment_input", { p_job_id: jobId, p_youth_user_id: youthId });
      if (active) { setProfile(error ? null : readRecruitmentProfile(data?.recruitment_profile)); setError(error ? "Ytterligare profiluppgifter kunde inte hämtas." : ""); }
    };
    void refresh(); const stop = subscribeVisibleRefresh(refresh);
    return () => { active = false; stop(); };
  }, [jobId, youthId]);
  if (error) return <p role="alert" className={styles.error}>{error}</p>;
  if (!profile || !completedProfileSections(profile).length) return null;
  return <details className={styles.candidate}><summary>Mer om kandidaten <span>Tillgänglighet, kunskaper och egna exempel</span></summary><p>Uppgifterna är lämnade av kandidaten och är inte verifierade intyg eller en personlighetsbedömning.</p>{(profile.availability.days.length > 0 || profile.availability.periods.length > 0 || profile.availability.startDate || profile.availability.hours) && <section><h3>När jag kan jobba</h3><p>{[profile.availability.days.map(day => DAYS[day as keyof typeof DAYS]).join(", "), profile.availability.periods.map(period => PERIODS[period as keyof typeof PERIODS]).join(", "), profile.availability.startDate && `Tidigaste start: ${profile.availability.startDate}`, profile.availability.hours && `Önskar cirka ${profile.availability.hours} tim/vecka`].filter(Boolean).join(" · ")}</p></section>}{profile.preferences.motivation && <section><h3>Vad jag vill lära mig</h3><p>{profile.preferences.motivation}</p></section>}{(profile.preferences.roles.length > 0 || profile.preferences.locations.length > 0) && <section><h3>Jobb och plats</h3><p>{[profile.preferences.roles.join(", "),profile.preferences.locations.join(", ")].filter(Boolean).join(" · ")}</p></section>}{(profile.qualifications.licences.length > 0 || profile.qualifications.tools.length > 0 || profile.qualifications.languages.length > 0) && <section><h3>Kunskaper och språk</h3><p>{recruitmentProfileSource({...profile, availability:{days:[],periods:[],startDate:"",hours:""},preferences:{roles:[],locations:[],travelMinutes:"",motivation:""},examples:[]})}</p></section>}{profile.examples.map((example,index) => <section key={index}><h3>{STRENGTHS[example.strength as keyof typeof STRENGTHS] ?? example.strength} – eget exempel</h3><p><strong>{example.context}</strong><br/>{example.action}</p></section>)}</details>;
}
