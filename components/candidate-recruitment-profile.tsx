"use client";
import { useEffect, useRef, useState } from "react";
import { getSupabaseClient } from "@/lib/supabase";
import { subscribeVisibleRefresh } from "@/lib/visible-refresh";
import type { ApplicationDisclosure } from "@/lib/application-disclosure";
import { createLatestRead, type ReadState } from "@/lib/latest-read";
import { ApplicationDisclosureView } from "./application-disclosure-view";
import { DisclosureLoadState } from "./disclosure-load-state";

export function CandidateRecruitmentProfile({ jobId, youthId }: { jobId: string; youthId: string }) {
  return <CandidateDisclosure key={JSON.stringify([jobId, youthId])} jobId={jobId} youthId={youthId} />;
}

function CandidateDisclosure({ jobId, youthId }: { jobId: string; youthId: string }) {
  const [state, setState] = useState<ReadState<ApplicationDisclosure>>({ status: "loading" });
  const reader = useRef<ReturnType<typeof createLatestRead<ApplicationDisclosure>> | null>(null);
  useEffect(() => {
    const current = createLatestRead<ApplicationDisclosure>({
      read: async (_, signal) => {
        const { data, error } = await getSupabaseClient().rpc("get_application_disclosure", {
          p_job_id: jobId, p_youth_user_id: youthId,
        }).abortSignal(signal);
        if (error || !data || data.job_id !== jobId || data.youth_user_id !== youthId) throw new Error("Underlag saknas");
        return data as ApplicationDisclosure;
      },
      update: setState,
      errorMessage: "Ansökningsunderlaget kunde inte hämtas. Kontrollera anslutningen och försök igen.",
    });
    reader.current = current;
    void current.load();
    const unsubscribe = subscribeVisibleRefresh(() => current.load());
    return () => { unsubscribe(); current.stop(); reader.current = null; };
  }, [jobId, youthId]);
  return state.status === "ready" ? <ApplicationDisclosureView packet={state.value} />
    : <DisclosureLoadState error={state.status === "error" ? state.message : undefined} retry={() => void reader.current?.load()} />;
}
