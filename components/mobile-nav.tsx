"use client";

import Link from "next/link";
import { COMPANY_ROUTES, companyView } from "@/lib/company-navigation";
import { usePathname, useSearchParams } from "next/navigation";
import { useSession } from "@/hooks/use-session";
import { YouthNavigation } from "./youth-navigation";
import { UiIcon, type IconName } from "./ui-icon";
import styles from "./youth-navigation.module.css";

export function MobileNav() {
  const pathname = usePathname(), query = useSearchParams();
  const { profile } = useSession();
  if(!profile || ["/","/login","/signup","/auth","/forgot-password","/reset-password","/pricing","/features","/privacy","/velaris-preview"].includes(pathname) || pathname.startsWith("/admin") || pathname.includes("onboarding") || pathname.startsWith("/youth/cv") || pathname.startsWith("/youth/get-started")) return null;
  if(profile.role === "youth") return <YouthNavigation pathname={pathname}/>;
  const items: {href:string; label:string; icon:IconName; view?:string}[] = profile.role === "company" ? [
    {href:COMPANY_ROUTES.listings, label:"Annonser", icon:"briefcase",view:"annonser"},
    {href:COMPANY_ROUTES.candidates,label:"Kandidater",icon:"discover",view:"kandidater"},
    {href:"/chats",label:"Meddelanden",icon:"chat"},
    {href:"/notifications",label:"Notiser",icon:"bell"},
    {href:"/profile",label:"Profil",icon:"profile"},
  ] : [{href:"/private",label:"Uppdrag",icon:"briefcase"},{href:"/chats",label:"Chattar",icon:"chat"},{href:"/notifications",label:"Aktivitet",icon:"activity"},{href:"/profile",label:"Profil",icon:"profile"}];
  return <nav className={`${styles.nav} ${pathname==="/chats"?styles.compact:""}`} aria-label="Huvudnavigation"><Link className={styles.brand} href={items[0].href}>MatchnWork</Link><div className={styles.links}>{items.map(item => {
    const selectedCompanyView = companyView(query.get("view"));
    const active = pathname === item.href.split("?")[0] && (!item.view || selectedCompanyView === item.view || ((selectedCompanyView === "skapa" || selectedCompanyView === "redigera") && item.view === "annonser"));
    return <Link key={item.href} href={item.href} className={`${styles.item} ${active ? styles.active : ""}`} aria-current={active ? "page" : undefined}><UiIcon name={item.icon}/><span>{item.label}</span></Link>;
  })}</div><Link className={styles.account} href={profile.role === "company" ? COMPANY_ROUTES.account : "/profile"} aria-label="Mitt konto"><UiIcon name="profile"/></Link></nav>;
}
