"use client";
import { useEffect, useState } from "react";
import { getVerifiedExperience } from "@/lib/recruitment";
import type { VerifiedExperience } from "@/lib/recruitment-types";
import styles from "./recruitment.module.css";

export function VerifiedJobBadge({ experiences }: { experiences: VerifiedExperience[] }) {
  if (!experiences.some(item => item.show_on_profile)) return null;
  return <details className={styles.badge}><summary aria-label="Jobb via MatchnWork – visa vad verifieringen betyder"><span aria-hidden="true">✓</span> Jobb via MatchnWork</summary><p>Har fått jobb via MatchnWork. Anställningen är bekräftad av arbetsgivaren och uppgifterna är godkända av ungdomen. Bocken verifierar denna anställning, inte hela profilen eller kompetensen.</p></details>;
}
export function CandidateVerifiedJobBadge({ youthUserId, jobId }: { youthUserId: string; jobId: string }) {
  const [items, setItems] = useState<VerifiedExperience[]>([]);
  useEffect(() => {
    let active = true;
    void getVerifiedExperience(youthUserId, jobId).then(data => { if (active) setItems(data); }).catch(() => { if (active) setItems([]); });
    return () => { active = false; };
  }, [youthUserId, jobId]);
  return <VerifiedJobBadge experiences={items}/>;
}
