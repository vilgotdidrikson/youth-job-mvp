"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { PasswordInput } from "@/components/password-input";
import { readPrivacyCaseHistory } from "@/lib/privacy-case-client";
import type { CaseCursor, PrivacyCase, PrivacyCaseEvent } from "@/lib/privacy-cases";
import styles from "@/app/account/privacy-requests/page.module.css";

export function PrivacyCaseMessages({ events, admin = false }: { events: PrivacyCaseEvent[]; admin?: boolean }) {
  return <>{events.filter(e => e.public_message).map(event => <blockquote key={event.id}>
    <p>{event.action === "user_reply" ? admin ? "Användarens komplettering" : "Din komplettering" : "Svar från MatchnWork"} · {new Date(event.created_at).toLocaleString("sv-SE", { timeZone: "Europe/Stockholm" })}</p>
    <p className={styles.message}>{event.public_message}</p>
  </blockquote>)}</>;
}
/** Mount with the case revision as key: old pages must never join a newer thread. */
export function PrivacyCaseHistory({ item, owner, admin = false }: { item: PrivacyCase; owner: string; admin?: boolean }) {
  const [events, setEvents] = useState<PrivacyCaseEvent[]>([]);
  const [cursor, setCursor] = useState<CaseCursor | null>(item.events_truncated ? item.events[0] ?? null : null);
  const [busy, setBusy] = useState(false), [note, setNote] = useState("");
  const active = useRef(false), lock = useRef(false), task = useRef<AbortController | null>(null);
  useEffect(() => { active.current = true; return () => { active.current = false; task.current?.abort(); }; }, []);
  const read = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); if (!cursor || lock.current || !active.current) return;
    const form = event.currentTarget, data = new FormData(form);
    const credentials = admin ? { password: String(data.get("password") ?? ""), totpCode: String(data.get("totpCode") ?? "") } : undefined;
    form.querySelectorAll<HTMLInputElement>('input[name="password"], input[name="totpCode"]').forEach(input => { input.value = ""; });
    lock.current = true; setBusy(true); setNote("");
    const controller = new AbortController(); task.current = controller;
    try {
      const page = await readPrivacyCaseHistory(owner, item, cursor, controller.signal, credentials);
      if (!active.current || controller.signal.aborted) return;
      setEvents(current => [...page.events, ...current]); setCursor(page.next);
      setNote(page.next ? "Äldre historik är läst. Det finns fler händelser." : "Hela den tillgängliga historiken är läst.");
    } catch (error) {
      if (active.current && !controller.signal.aborted) { setEvents([]); setCursor(item.events[0] ?? null); setNote(error instanceof Error ? error.message : "Historiken kunde inte läsas."); }
    } finally {
      lock.current = false; if (active.current) setBusy(false);
    }
  };
  return <>
    {cursor && <form className={styles.form} onSubmit={read} aria-label="Äldre ärendehistorik">
      {admin && <><label>Lösenord för historik<PasswordInput name="password" autoComplete="current-password" required disabled={busy}/></label><label>Tvåfaktorskod för historik<input name="totpCode" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} required disabled={busy}/></label></>}
      <button className="secondary-btn" disabled={busy}>{busy ? "Läser äldre historik…" : "Visa äldre historik"}</button>
    </form>}
    {note && <p role="status">{note}</p>}
    <PrivacyCaseMessages events={events} admin={admin}/>
  </>;
}
