"use client";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { useSession } from "./use-session";
import { loadIndicatorPreferences } from "@/lib/notification-indicator-client";
import { DEFAULT_INDICATOR_PREFERENCES, type IndicatorPreferences } from "@/lib/notification-indicator-preferences";
import { subscribeVisibleRefresh } from "@/lib/visible-refresh";
const Context = createContext<Readonly<IndicatorPreferences>>(DEFAULT_INDICATOR_PREFERENCES);
export const useIndicatorPreferences = () => useContext(Context);
export const INDICATOR_PREFERENCES_CHANGED = "mnw-indicator-preferences-changed";
export function IndicatorPreferencesProvider({ children }: { children: ReactNode }) {
  const { user } = useSession(), owner = user?.id;
  const [state, setState] = useState<{ owner: string; preferences: IndicatorPreferences } | null>(null);
  useEffect(() => {
    if (!owner) return;
    let active = true, generation = 0;
    let controller: AbortController | undefined;
    const refresh = async () => {
      const id = ++generation; controller?.abort(); const task = new AbortController(); controller = task;
      try { const result = await loadIndicatorPreferences(owner, task.signal); if (active && id === generation) setState({ owner, preferences: result.preferences }); }
      catch { /* Keep the last confirmed own choices during a transient outage. */ }
    };
    const run = () => { void refresh(); };
    run(); const stop = subscribeVisibleRefresh(refresh);
    window.addEventListener(INDICATOR_PREFERENCES_CHANGED, run);
    return () => { active = false; controller?.abort(); stop(); window.removeEventListener(INDICATOR_PREFERENCES_CHANGED, run); };
  }, [owner]);
  return <Context.Provider value={state && state.owner === owner ? state.preferences : DEFAULT_INDICATOR_PREFERENCES}>{children}</Context.Provider>;
}
