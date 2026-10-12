"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useSession } from "@/hooks/use-session";
import { useRecruitmentProfile } from "@/hooks/use-recruitment-profile";
import { completedProfileSections, PROFILE_SECTIONS } from "@/lib/recruitment-profile";
import { UiIcon } from "./ui-icon";
import styles from "./recruitment-profile.module.css";

export function ProfileDevelopmentPrompt({ dismissible = false }: { dismissible?: boolean }) {
  const { user, profile: account } = useSession();
  const { profile, loading, error } = useRecruitmentProfile(account?.role === "youth" ? user?.id : undefined);
  const [dismissedOwner, setDismissedOwner] = useState("");
  useEffect(() => {
    if (!dismissible || !user?.id) return;
    try { if (Number(localStorage.getItem(`mnw-profile-prompt:${user.id}`)) > Date.now()) queueMicrotask(() => setDismissedOwner(user.id)); } catch { /* Dismiss still works for this visit. */ }
  }, [dismissible, user?.id]);
  if (!user || account?.role !== "youth" || loading || error || (dismissible && dismissedOwner === user.id)) return null;
  const complete = completedProfileSections(profile), next = PROFILE_SECTIONS.find(section => !complete.includes(section.key));
  if (dismissible && !next) return null;
  return <section className={styles.prompt} aria-label="Utveckla din profil"><UiIcon name={next ? "edit" : "check"}/><div><strong>{next ? next.title : "Mer om dig finns på din profil"}</strong><p>{next ? next.prompt : "Du kan uppdatera dina tider, kunskaper och exempel när du vill."} {next && "Helt valfritt – dina ansökningar fortsätter som vanligt."}</p></div><Link href="/profile/build">{next ? "Lägg till när du vill" : "Se uppgifterna"}<UiIcon name="arrow" width="16"/></Link>{dismissible && <button type="button" className={styles.later} onClick={() => { try { localStorage.setItem(`mnw-profile-prompt:${user.id}`, String(Date.now() + 7 * 86400000)); } catch {} setDismissedOwner(user.id); }}>Senare</button>}</section>;
}
