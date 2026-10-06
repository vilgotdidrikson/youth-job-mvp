"use client";
import Link from "next/link";
import { UiIcon, type IconName } from "./ui-icon";
import styles from "./youth-navigation.module.css";
import {useNavigationIndicators} from "@/hooks/use-navigation-indicators";
import {NotificationLink} from "./notification-link";

const items: { href: string; label: string; icon: IconName; routes: string[] }[] = [
  { href: "/swipe", label: "Upptäck", icon: "discover", routes: ["/swipe", "/jobb/", "/kartan"] },
  { href: "/applications", label: "Ansökningar", icon: "briefcase", routes: ["/applications"] },
  { href: "/chats", label: "Meddelanden", icon: "chat", routes: ["/chats"] },
  { href: "/profile", label: "Profil", icon: "profile", routes: ["/profile", "/cv-builder"] },
];

export function YouthNavigation({ pathname }: { pathname: string }) {
  const indicators=useNavigationIndicators();
  return <nav className={styles.nav} aria-label="Huvudnavigation">
    <Link href="/swipe" className={styles.brand} aria-label="MatchnWork – upptäck jobb">MatchnWork</Link>
    <div className={styles.links}>{items.map(item => {
      const active = item.routes.some(route => route.endsWith("/") ? pathname.startsWith(route) : pathname === route);
      const attention=item.href==="/applications" ? indicators.questions : item.href==="/chats" ? indicators.messages : false;
      return <Link key={item.href} href={item.href} className={`${styles.item} ${active ? styles.active : ""}`} aria-current={active ? "page" : undefined} aria-label={attention ? `${item.label} – ${item.href==="/applications" ? "frivilliga frågor finns" : "nya händelser"}` : undefined}><span className={styles.icon}><UiIcon name={item.icon}/>{attention && <span className={styles.dot} aria-hidden="true"/>}</span><span>{item.label}</span></Link>;
    })}</div>
    <NotificationLink desktop/>
  </nav>;
}
