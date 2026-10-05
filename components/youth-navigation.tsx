import Link from "next/link";
import { UiIcon, type IconName } from "./ui-icon";
import styles from "./youth-navigation.module.css";

const items: { href: string; label: string; icon: IconName; routes: string[] }[] = [
  { href: "/swipe", label: "Upptäck", icon: "discover", routes: ["/swipe", "/jobb/"] },
  { href: "/kartan", label: "Karta", icon: "map", routes: ["/kartan"] },
  { href: "/notifications", label: "Aktivitet", icon: "activity", routes: ["/notifications", "/applications", "/chats"] },
  { href: "/profile", label: "Profil", icon: "profile", routes: ["/profile", "/cv-builder"] },
];

export function YouthNavigation({ pathname }: { pathname: string }) {
  return <nav className={styles.nav} aria-label="Huvudnavigation">
    <Link href="/swipe" className={styles.brand} aria-label="MatchnWork – upptäck jobb">MatchnWork</Link>
    <div className={styles.links}>{items.map(item => {
      const active = item.routes.some(route => route.endsWith("/") ? pathname.startsWith(route) : pathname === route);
      return <Link key={item.href} href={item.href} className={`${styles.item} ${active ? styles.active : ""}`} aria-current={active ? "page" : undefined}><UiIcon name={item.icon}/><span>{item.label}</span></Link>;
    })}</div>
    <Link href="/profile" className={styles.account} aria-label="Mitt konto"><UiIcon name="profile"/></Link>
  </nav>;
}
