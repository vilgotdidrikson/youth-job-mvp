"use client";

import { useEffect, useRef, useState } from "react";
import { getSupabaseClient } from "@/lib/supabase";
import { createLatestRead, type ReadState } from "@/lib/latest-read";
import { readAssessmentHistory, type AssessmentHistoryEntry } from "@/lib/assessment-history";
import styles from "./candidate-assessment-history.module.css";

const STATUS = { fulfilled: "Stöd i underlaget", unfulfilled: "Uttrycklig motsägelse", unknown: "Uppgift saknas" };

export function CandidateAssessmentHistory({ jobId, youthId, revision }: { jobId: string; youthId: string; revision: string | null }) {
  const [open, setOpen] = useState(false);
  return <details className={styles.root} onToggle={event => setOpen(event.currentTarget.open)}>
    <summary>Tidigare bedömningar</summary>
    {open && <HistoryContent key={JSON.stringify([jobId, youthId, revision])} jobId={jobId} youthId={youthId} />}
  </details>;
}

function HistoryContent({ jobId, youthId }: { jobId: string; youthId: string }) {
  const [state, setState] = useState<ReadState<AssessmentHistoryEntry[]>>({ status: "loading" });
  const reader = useRef<ReturnType<typeof createLatestRead<AssessmentHistoryEntry[]>> | null>(null);
  const loading = useRef(false);
  useEffect(() => {
    const current = createLatestRead<AssessmentHistoryEntry[]>({
      read: (_, signal) => readAssessmentHistory(getSupabaseClient(), jobId, youthId, signal),
      update: next => { loading.current = next.status === "loading"; setState(next); },
      errorMessage: "Tidigare bedömningar kunde inte hämtas. Kontrollera anslutningen och försök igen.",
    });
    reader.current = current;
    void current.load();
    return () => { current.stop(); reader.current = null; loading.current = false; };
  }, [jobId, youthId]);
  return <div className={styles.content} aria-busy={state.status === "loading"}>
    {state.status === "loading" && <p role="status">Hämtar tidigare bedömningar…</p>}
    {state.status === "error" && <><p className={styles.error} role="alert">{state.message}</p><button type="button" className="secondary-btn" onClick={() => { if (!loading.current) void reader.current?.load(); }}>Försök igen</button></>}
    {state.status === "ready" && (state.value.length ? state.value.map(item => <details key={item.id} className={styles.entry}>
      <summary>Kriterieversion {item.version} · <time dateTime={item.createdAt}>{new Date(item.createdAt).toLocaleString("sv-SE")}</time></summary>
      <p>{item.explanation}</p>
      <ul>{item.criteria.map(criterion => <li key={criterion.id} data-status={criterion.status}><strong>{criterion.label}</strong><span>{STATUS[criterion.status]}</span>{criterion.evidence && <blockquote>{criterion.evidence}</blockquote>}</li>)}</ul>
    </details>) : <p>Inga sparade bedömningar ännu.</p>)}
  </div>;
}
