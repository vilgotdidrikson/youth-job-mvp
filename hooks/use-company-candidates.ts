"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { getCandidatesForJob } from "@/lib/feeds";
import { getMyConversations } from "@/lib/chat";
import { createLatestRead, type ReadState } from "@/lib/latest-read";
import { subscribeVisibleRefresh } from "@/lib/visible-refresh";
import type { CandidateFeedItem, ConversationSummary } from "@/lib/types";

type ApplicationList = { candidates: CandidateFeedItem[]; conversations: ConversationSummary[] };
/** Owner + ad form a read scope; old responses are never carried into another ad. */
export function useCompanyCandidates(userId: string, jobId: string) {
  const scope = `${userId}:${jobId}`;
  const [snapshot, setSnapshot] = useState<{ scope: string; state: ReadState<ApplicationList> }>();
  const reader = useRef<ReturnType<typeof createLatestRead<ApplicationList>> | null>(null);
  useEffect(() => {
    const current = createLatestRead<ApplicationList>({
      read: async (_, signal) => {
        const [candidates, conversations] = await Promise.all([
          getCandidatesForJob(jobId, { includeReviewed: true, signal, ownerId: userId }), getMyConversations(),
        ]);
        if (candidates.some(row => row.job.id !== jobId || row.job.company_user_id !== userId)) throw new Error("Fel ansökningssammanhang.");
        return { candidates, conversations: conversations.filter(row => row.job_id === jobId && row.company_user_id === userId) };
      },
      update: state => setSnapshot({ scope, state }), errorMessage: "Ansökningarna kunde inte hämtas. Försök igen.",
    });
    reader.current = current; void current.load();
    const unsubscribe = subscribeVisibleRefresh(() => current.load());
    return () => { unsubscribe(); current.stop(); if (reader.current === current) reader.current = null; };
  }, [scope, userId, jobId]);
  const reload = useCallback(() => reader.current?.load(), []);
  return { state: snapshot?.scope === scope ? snapshot.state : { status: "loading" } as const, reload };
}
