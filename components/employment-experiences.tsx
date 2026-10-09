"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { getRecruitmentRecords, recruitmentAction } from "@/lib/recruitment";
import { experiencePeriod, type EmploymentRecord, type RecruitmentRecord } from "@/lib/recruitment-types";
import { subscribeVisibleRefresh } from "@/lib/visible-refresh";
import styles from "./recruitment.module.css";

function Experience({ employment }: { employment: EmploymentRecord }) {
  const [busy, setBusy] = useState(false), [error, setError] = useState("");
  const update = async (show: boolean, cv: boolean) => {
    setBusy(true); setError("");
    try { await recruitmentAction("respond", employment.match_id, { response: "approved", show_on_profile: show, include_in_cv: cv }); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Kunde inte ändra synlighet."); }
    finally { setBusy(false); }
  };
  return <article className={styles.experience}><h3>{employment.role_name} · {employment.company_name}</h3><p>{experiencePeriod(employment.start_date)}</p><p className={styles.experienceLabel}>✓ Anställning bekräftad av arbetsgivaren via MatchnWork</p><div className={styles.preferences}>
    <label><input type="checkbox" disabled={busy} checked={employment.show_on_profile} onChange={event => void update(event.target.checked, employment.include_in_cv)}/> Visa på profil och visa bocken</label>
    <label><input type="checkbox" disabled={busy} checked={employment.include_in_cv} onChange={event => void update(employment.show_on_profile, event.target.checked)}/> Ta med i CV</label>
  </div>{busy && <p role="status">Sparar…</p>}{error && <p role="alert" className={styles.error}>{error}</p>}</article>;
}
export function EmploymentExperiences({ userId }: { userId: string }) {
  const [items, setItems] = useState<RecruitmentRecord[]>([]), [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    const refresh = async () => {
      try { const data = await getRecruitmentRecords(); if (active) { setItems(data.filter(item => item.youth_user_id === userId && item.employment)); setError(""); } }
      catch (reason) { if (active) setError(reason instanceof Error ? reason.message : "Kunde inte läsa anställningar."); }
    };
    void refresh(); const unsubscribe = subscribeVisibleRefresh(refresh);
    window.addEventListener("mnw-recruitment-refresh", refresh);
    return () => { active = false; unsubscribe(); window.removeEventListener("mnw-recruitment-refresh", refresh); };
  }, [userId]);
  if (!items.length && !error) return null;
  return <section className="mnw-profile-card" style={{marginBottom:"1rem"}}><h2>Jobb via MatchnWork</h2><p className="mnw-profile-muted">Arbetsgivaren registrerar anställningen. Du granskar uppgifterna och väljer vad som ska visas. Bekräftad erfarenhet är oberoende av företagets betalning.</p>
    {error && <p role="alert" className={styles.error}>{error}</p>}
    {!items.length && !error && <p className="mnw-profile-muted">Här visas dina anställningar när arbetsgivaren registrerat dem.</p>}
    {items.map(item => item.employment?.response === "approved" ? <Experience key={item.match_id} employment={item.employment}/> : <article className={styles.experience} key={item.match_id}><h3>{item.employment?.role_name} · {item.company_name}</h3><p>{item.employment?.response === "disputed" ? "Uppgifterna behöver rättas tillsammans med arbetsgivaren." : "Arbetsgivaren har registrerat anställningen. Granska uppgifterna innan de visas."}</p><Link href={`/chats?job=${item.job_id}`}>Granska anställning →</Link></article>)}
  </section>;
}
