"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { createLatestRead, type ReadState } from "@/lib/latest-read";
import { subscribeVisibleRefresh } from "@/lib/visible-refresh";
import { getApplicationRetention, getConversationRetention, nextRetentionBoundary, retentionPhase,
  type ApplicationRetention, type ConversationRetention, type RetentionClock } from "@/lib/data-retention";

const applicationRows = (value: ApplicationRetention[]) => value;
const conversationRows = (value: ConversationRetention) => [value];
function useRetentionRead<T>(scope: string, read: (signal: AbortSignal) => Promise<T>, rows: (value: T) => RetentionClock[]) {
  const [snapshot, setSnapshot] = useState<{ scope: string; state: ReadState<T>; value?: T; at: number; now: number }>({ scope: "", state: { status: "loading" }, at: 0, now: 0 });
  const reader = useRef<ReturnType<typeof createLatestRead<T>> | null>(null);
  useEffect(() => {
    if (!scope) return;
    let requestedAt = performance.now();
    const current = createLatestRead<T>({ read: (_, signal) => { requestedAt = performance.now(); return read(signal); },
      update: state => { const now = performance.now(); setSnapshot(previous => ({ scope, state, now,
        value: state.status === "ready" ? state.value : previous.scope === scope ? previous.value : undefined,
        at: state.status === "ready" ? requestedAt : previous.scope === scope ? previous.at : 0 })); },
      errorMessage: "Lagringsstatus kunde inte hämtas. Försök igen.",
    });
    reader.current = current; void current.load();
    const unsubscribe = subscribeVisibleRefresh(() => current.load());
    return () => { unsubscribe(); current.stop(); if (reader.current === current) reader.current = null; };
  }, [scope, read]);
  const value = snapshot.scope === scope ? snapshot.value : undefined;
  const elapsed = Math.max(0, snapshot.now - snapshot.at);
  useEffect(() => {
    if (!value) return;
    const wait = nextRetentionBoundary(rows(value), Math.max(0, performance.now() - snapshot.at));
    if (wait === null) return;
    const timer = setTimeout(() => { const now = performance.now(); setSnapshot(previous => ({ ...previous, now })); void reader.current?.load(); }, wait);
    return () => clearTimeout(timer);
  }, [scope, value, snapshot.at, snapshot.now, rows]);
  const state = snapshot.scope === scope ? snapshot.state : { status: "loading" } as const;
  return { value, elapsed, state, retry: () => void reader.current?.load() };
}
export function useApplicationRetention(userId?: string) {
  const result = useRetentionRead(userId ?? "", getApplicationRetention, applicationRows);
  return { ...result, value: (result.value ?? []).map(row => retentionPhase(row, result.elapsed)) };
}
export function useConversationRetention(id: string | null, userId?: string) {
  const read = useCallback((signal: AbortSignal) => getConversationRetention(id!, signal), [id]);
  const result = useRetentionRead(userId && id ? `${userId}:${id}` : "", read, conversationRows);
  const value = result.value ? retentionPhase(result.value, result.elapsed) : undefined;
  return { ...result, value, writeBlocked: !value || value.read_only || result.state.status === "error" };
}
