"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRequireAuth } from "@/hooks/use-require-auth";
import { AuthGateMessage } from "@/components/auth-gate-message";
import { UiIcon } from "@/components/ui-icon";
import { getSupabaseClient } from "@/lib/supabase";
import { getYouthActivity, type ActivityStatus, type YouthActivity } from "@/lib/youth-activity";
import styles from "./activity.module.css";

type Notification = { id: string; title: string; body: string; href: string | null; read_at: string | null; created_at: string };
const stages: Record<ActivityStatus, { label: string; explanation: string; action: string; href: string; tone: string }> = {
  draft: { label: "Intresse sparat", explanation: "Gå vidare med ditt CV och slutför ansökan.", action: "Fortsätt ansökan", href: "/youth/cv", tone: "rose" },
  needs_completion: { label: "Komplettering behövs", explanation: "Svara på frågorna så kan din ansökan skickas vidare.", action: "Besvara frågor", href: "/applications", tone: "rose" },
  submitted: { label: "Intresse skickat", explanation: "Arbetsgivaren kan nu ta ställning till ditt intresse.", action: "Visa ansökan", href: "/applications", tone: "neutral" },
  unavailable: { label: "Annonsen är stängd", explanation: "Den här annonsen tar inte emot fler ansökningar.", action: "Visa annons", href: "job", tone: "neutral" },
  matched: { label: "Ni har matchat", explanation: "Ni är båda intresserade. Ta nästa steg i chatten.", action: "Öppna chattar", href: "/chats", tone: "green" },
  in_contact: { label: "Kontakt pågår", explanation: "Fortsätt samtalet med arbetsgivaren i chatten.", action: "Öppna chattar", href: "/chats", tone: "green" },
  interview: { label: "Intervju", explanation: "Håll kontakten med arbetsgivaren inför nästa steg.", action: "Öppna chattar", href: "/chats", tone: "green" },
  hired: { label: "Anställd", explanation: "Arbetsgivaren har markerat att du har fått jobbet.", action: "Öppna chattar", href: "/chats", tone: "green" },
  rejected: { label: "Avslutad", explanation: "Du gick inte vidare för det här jobbet. Fler möjligheter finns under Upptäck.", action: "Upptäck jobb", href: "/swipe", tone: "neutral" },
  cancelled: { label: "Avslutad", explanation: "Den här matchningen har avslutats.", action: "Upptäck jobb", href: "/swipe", tone: "neutral" },
};
const isOngoing = (item: YouthActivity) => !["unavailable", "hired", "rejected", "cancelled"].includes(item.status);
function dateLabel(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : new Intl.DateTimeFormat("sv-SE", { day: "numeric", month: "short" }).format(date);
}

export default function NotificationsPage() {
  const { user, profile, status, error: sessionError } = useRequireAuth();
  const [items, setItems] = useState<Notification[]>([]), [activity, setActivity] = useState<YouthActivity[]>([]);
  const [error, setError] = useState(""), [loading, setLoading] = useState(true), [tab, setTab] = useState<"ongoing" | "notifications">("ongoing");
  const youth = profile?.role === "youth", activeTab = youth ? tab : "notifications";
  useEffect(() => {
    if (!user || !profile) return;
    let active = true;
    void Promise.allSettled([
      getSupabaseClient().from("notifications").select("*").order("created_at", { ascending: false }).limit(50),
      youth ? getYouthActivity(user.id) : Promise.resolve([] as YouthActivity[]),
    ]).then(([notifications, applications]) => {
      if (!active) return;
      const errors: string[] = [];
      if (notifications.status === "rejected" || notifications.value.error) errors.push("Kunde inte läsa notiser.");
      else setItems((notifications.value.data ?? []) as Notification[]);
      if (applications.status === "rejected") errors.push("Kunde inte läsa dina ansökningar. Försök igen om en stund.");
      else setActivity(applications.value);
      setError(errors.join(" "));
    })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [user, profile, youth]);
  const read = async (item: Notification) => {
    if (item.read_at) return;
    const readAt = new Date().toISOString();
    const { error: readError } = await getSupabaseClient().from("notifications").update({ read_at: readAt }).eq("id", item.id);
    if (!readError) setItems(current => current.map(entry => entry.id === item.id ? { ...entry, read_at: readAt } : entry));
  };
  if (status !== "ready") return <AuthGateMessage status={status} error={sessionError}/>;
  const ongoingCount = activity.filter(isOngoing).length, unread = items.filter(item => !item.read_at).length;
  const orderedActivity = [...activity.filter(isOngoing), ...activity.filter(item => !isOngoing(item))];
  return <main className={styles.page}>
    <header className={styles.heading}><p className={styles.eyebrow}>Dina nästa steg</p><h1>Aktivitet</h1><p>{youth ? "Här följer du dina ansökningar och håller koll på vad som händer." : "Här håller du koll på rekryteringar, kompletterade ansökningar och nya händelser."}</p></header>
    <div className={styles.layout}><section className={styles.content} aria-label="Din aktivitet">
      {youth && <div className={styles.tabs} aria-label="Välj aktivitet"><button type="button" aria-pressed={tab === "ongoing"} className={tab === "ongoing" ? styles.selected : ""} onClick={() => setTab("ongoing")}>Pågående{!loading && <span>{ongoingCount}</span>}</button><button type="button" aria-pressed={tab === "notifications"} className={tab === "notifications" ? styles.selected : ""} onClick={() => setTab("notifications")}>Notiser{unread > 0 && <span>{unread}</span>}</button></div>}
      {error && <p className={styles.error} role="alert">{error}</p>}
      {loading ? <div className={styles.empty} role="status">Hämtar din aktivitet…</div> : activeTab === "ongoing" ? <>
        {!error && activity.length === 0 && <section className={styles.empty}><span className={styles.emptyIcon}><UiIcon name="activity"/></span><h2>Ditt nästa steg börjar här</h2><p>När du visar intresse för ett jobb samlas din aktivitet här.</p><Link className={styles.primary} href="/swipe">Upptäck jobb <UiIcon name="arrow"/></Link></section>}
        <div className={styles.cards}>{orderedActivity.map((item, index) => { const stage = item.pendingQuestions && !["hired", "rejected", "cancelled", "unavailable"].includes(item.status) ? { ...stages[item.status], explanation: `${item.pendingQuestions} ${item.pendingQuestions === 1 ? "ny fråga" : "nya frågor"} kan komplettera din skickade ansökan.`, action: "Besvara frågor", href: "/applications" } : stages[item.status]; return <div key={item.jobId}>{!isOngoing(item) && (index === 0 || isOngoing(orderedActivity[index - 1])) && <h2 className={styles.historyTitle}>Avslutade</h2>}<article className={styles.card}><div className={styles.cardTop}><span className={styles.avatar}>{item.company.slice(0, 2).toUpperCase()}</span><div className={styles.cardTitle}><p>{item.company}</p><h2><Link href={`/jobb/${item.jobId}`}>{item.title}</Link></h2><time dateTime={item.createdAt}>{dateLabel(item.createdAt)}</time></div><span className={`${styles.badge} ${styles[stage.tone]}`}>{stage.label}</span></div><footer className={styles.cardFooter}><p>{stage.explanation}</p><Link href={stage.href === "job" ? `/jobb/${item.jobId}` : stage.href} className={styles.cardAction}>{stage.action}<UiIcon name="arrow" width="16" height="16"/></Link></footer></article></div>; })}</div>
        <p className={styles.hint}><UiIcon name="info"/>Chatten öppnas när både du och arbetsgivaren är intresserade.</p>
      </> : <div className={styles.cards}>{!error && items.length === 0 ? <section className={styles.empty}><span className={styles.emptyIcon}><UiIcon name="check"/></span><h2>Du är uppdaterad</h2><p>Du har inga notiser ännu. Nya händelser dyker upp här.</p></section> : items.map(item => <Link key={item.id} href={item.href || "/notifications"} onClick={() => void read(item)} className={`${styles.notification} ${item.read_at ? styles.read : ""}`}><span className={styles.notificationIcon}><UiIcon name="activity"/></span><div><div className={styles.notificationTitle}><h2>{item.title}</h2>{!item.read_at && <span aria-label="Oläst" className={styles.dot}/>}</div><p>{item.body}</p><time dateTime={item.created_at}>{dateLabel(item.created_at)}</time></div><UiIcon name="arrow" width="18" height="18"/></Link>)}</div>}
    </section><aside className={styles.aside}><section className={styles.shortcuts}><h2>Allt på ett ställe</h2><Link href="/chats"><span><UiIcon name="chat"/>Dina chattar</span><UiIcon name="arrow" width="17"/></Link>{profile?.role === "company" && <Link href="/company?view=kandidater"><span><UiIcon name="briefcase"/>Dina kandidater</span><UiIcon name="arrow" width="17"/></Link>}{youth && <><Link href="/applications"><span><UiIcon name="briefcase"/>Dina ansökningar</span><UiIcon name="arrow" width="17"/></Link><Link href="/youth/cv"><span><UiIcon name="profile"/>Ditt CV</span><UiIcon name="arrow" width="17"/></Link></>}</section>{youth && <section className={styles.tip}><UiIcon name="discover"/><h2>Redo för nästa möjlighet?</h2><p>Det kan finnas ett jobb som passar just dig.</p><Link href="/swipe">Till Upptäck <UiIcon name="arrow" width="17"/></Link></section>}</aside></div>
  </main>;
}
