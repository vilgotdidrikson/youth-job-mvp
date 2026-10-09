"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { getRecruitmentRecords } from "@/lib/recruitment";
import type { RecruitmentRecord } from "@/lib/recruitment-types";
import { subscribeVisibleRefresh } from "@/lib/visible-refresh";
import styles from "./recruitment.module.css";

export function RecruitmentSummary({ company = false }: { company?: boolean }) {
  const [items, setItems] = useState<RecruitmentRecord[]>([]), [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    const refresh = async () => {
      try { const data = await getRecruitmentRecords(); if (active) { setItems(data); setError(""); } }
      catch (reason) { if (active) setError(reason instanceof Error ? reason.message : "Kunde inte hämta anställningar."); }
    };
    void refresh(); const unsubscribe = subscribeVisibleRefresh(refresh);
    window.addEventListener("mnw-recruitment-refresh", refresh);
    return () => { active = false; unsubscribe(); window.removeEventListener("mnw-recruitment-refresh", refresh); };
  }, []);
  const pending = items.filter(item => item.employment?.response === "pending" || item.employment?.response === "disputed" || (company && (item.requested_at || item.reminder_sent_at) && !["resolved","dismissed"].includes(item.review_state ?? "") && !item.employment));
  return <>{error && <p role="alert" className={styles.error}>{error}</p>}{pending.length > 0 && <section className={styles.panel}><h3>{company ? "Följ upp anställningar" : "Dina anställningar"}</h3>{pending.map(item => <p key={item.match_id}><Link href={`/chats?job=${item.job_id}`}>{item.job_title} · {company ? item.youth_name : item.company_name} →</Link><br/>{item.employment?.response === "pending" ? company ? "Inväntar kandidatens granskning" : "Granska arbetsgivarens uppgifter" : item.employment?.response === "disputed" ? "Uppgifterna behöver rättas" : "Kandidaten har bett om registrering"}</p>)}</section>}</>;
}
