"use client";
import { useEffect, useRef, useState } from "react";
import { IndicatorPreferencesError, loadIndicatorPreferences, saveIndicatorPreferences } from "@/lib/notification-indicator-client";
import { DEFAULT_INDICATOR_PREFERENCES, equalIndicatorPreferences, type IndicatorPreferences } from "@/lib/notification-indicator-preferences";
import { INDICATOR_PREFERENCES_CHANGED } from "@/hooks/use-indicator-preferences";
import { useSession } from "@/hooks/use-session";
import styles from "./indicator-preferences-settings.module.css";
export function IndicatorPreferencesSettings({ userId }: { userId: string }) {
  const { profile } = useSession();
  return <Settings key={userId} userId={userId} showQuestions={profile?.role === "youth"} />;
}
function Settings({ userId, showQuestions }: { userId: string; showQuestions: boolean }) {
  const [draft, setDraft] = useState<IndicatorPreferences>({ ...DEFAULT_INDICATOR_PREFERENCES });
  const [saved, setSaved] = useState<IndicatorPreferences | null>(null);
  const [phase, setPhase] = useState<"loading" | "ready" | "saving" | "check">("loading");
  const [message, setMessage] = useState("");
  const active = useRef(false), lock = useRef(false), edited = useRef(false), controller = useRef<AbortController | null>(null);
  const read = async (initial = false) => {
    if (!active.current || lock.current) return;
    lock.current = true; setPhase("loading"); setMessage("");
    const task = new AbortController(); controller.current = task;
    try {
      const result = await loadIndicatorPreferences(userId, task.signal);
      if (!active.current || controller.current !== task || task.signal.aborted) return;
      setSaved(result.preferences); if (initial || !edited.current) setDraft(result.preferences);
      setPhase("ready"); setMessage(initial ? "" : "Sparade val är kontrollerade. Dina val i formuläret finns kvar.");
      window.dispatchEvent(new Event(INDICATOR_PREFERENCES_CHANGED));
    } catch {
      if (active.current && controller.current === task && !task.signal.aborted) { setPhase("check"); setMessage("Inställningarna kunde inte läsas. Läs sparade val innan du sparar."); }
    } finally { if (controller.current === task) { controller.current = null; lock.current = false; } }
  };
  useEffect(() => {
    active.current = true; void read(true);
    return () => { active.current = false; controller.current?.abort(); controller.current = null; lock.current = false; };
    // The account-keyed workspace owns these requests and its initial read.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);
  const save = async () => {
    if (!active.current || lock.current || phase !== "ready" || !saved) return;
    lock.current = true; setPhase("saving"); setMessage("");
    const task = new AbortController(); controller.current = task;
    try {
      const result = await saveIndicatorPreferences(userId, draft, task.signal);
      if (!active.current || controller.current !== task || task.signal.aborted) return;
      edited.current = false; setSaved(result.preferences); setPhase("ready"); setMessage("Dina val är sparade på kontot.");
      window.dispatchEvent(new Event(INDICATOR_PREFERENCES_CHANGED));
    } catch (error) {
      if (active.current && controller.current === task && !task.signal.aborted) { setPhase("check"); setMessage(error instanceof IndicatorPreferencesError ? error.message : "Sparningen kunde inte bekräftas. Kontrollera sparningen."); }
    } finally { if (controller.current === task) { controller.current = null; lock.current = false; } }
  };
  const disabled = phase === "loading" || phase === "saving";
  return <section className={`card ${styles.section}`} aria-labelledby="indicator-preferences-title">
    <h2 id="indicator-preferences-title">Markeringar i appen</h2>
    <p>Välj vilka olästmarkeringar som visas i navigationen. Meddelanden, frågor och notishistorik finns kvar i sina vyer.</p>
    <fieldset className={styles.options} disabled={disabled}><legend className="sr-only">Visa markeringar för</legend>
      {([["messages", "Nya meddelanden"], ["questions", "Frivilliga frågor i ansökningar"], ["notifications", "Olästa notiser"]] as const).filter(([key]) => key !== "questions" || showQuestions).map(([key, label]) => <label key={key}><input type="checkbox" checked={draft[key]} onChange={event => { edited.current = true; setDraft(current => ({ ...current, [key]: event.target.checked })); }} />{label}</label>)}
    </fieldset>
    <div className={styles.actions}>
      <button type="button" className="primary-btn" disabled={phase !== "ready" || !saved || equalIndicatorPreferences(draft, saved)} onClick={() => void save()}>{phase === "saving" ? "Sparar…" : "Spara markeringar"}</button>
      <button type="button" className="secondary-btn" disabled={disabled} onClick={() => void read()}>{phase === "check" ? "Kontrollera sparningen" : "Läs sparade val"}</button>
      {saved && <button type="button" className="secondary-btn" disabled={disabled} onClick={() => { edited.current = false; setDraft({ ...saved }); setMessage(""); }}>Använd sparade val</button>}
    </div>
    {phase === "loading" && <p role="status">Läser sparade val…</p>}
    {message && <p role={phase === "check" ? "alert" : "status"}>{message}</p>}
  </section>;
}
