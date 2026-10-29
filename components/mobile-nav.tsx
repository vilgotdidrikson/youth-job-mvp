"use client";

import { BrandLogo } from "@/components/brand-logo";

import Link from "next/link";
import { COMPANY_ROUTES, companyView } from "@/lib/company-navigation";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useSyncExternalStore } from "react";
import { useSession } from "@/hooks/use-session";
import { YouthNavigation } from "./youth-navigation";
import { UiIcon, type IconName } from "./ui-icon";
import styles from "./youth-navigation.module.css";

// Right after signup the profile build overview stays headerless, also when the user comes back
// to it from a step, until they leave the build flow (e.g. with "Bygg senare").
// Stored per account so it survives reloads and new tabs.
const WELCOME_EVENT = "mnw-profile-welcome-change";
const welcomeKey = (userId: string) => `mnw-profile-welcome:${userId}`;
const inBuildFlow = (path: string) => path === "/profile/build" || path === "/profile/develop" || path.startsWith("/youth/cv");
function readWelcome(userId: string | undefined) { if (!userId) return false; try { return localStorage.getItem(welcomeKey(userId)) === "1"; } catch { return false; } }
function subscribeWelcome(listener: () => void) {
  window.addEventListener(WELCOME_EVENT, listener); window.addEventListener("storage", listener);
  return () => { window.removeEventListener(WELCOME_EVENT, listener); window.removeEventListener("storage", listener); };
}

export function MobileNav() {
  const pathname = usePathname(), query = useSearchParams();
  const { user, profile } = useSession();
  const userId = user?.id;
  const welcomeParam = pathname === "/profile/build" && query.get("welcome") === "1";
  const welcomeFlow = useSyncExternalStore(subscribeWelcome, () => readWelcome(userId), () => false);
  useEffect(() => {
    if (!userId) return;
    const next = welcomeParam ? true : inBuildFlow(pathname) ? null : false;
    if (next === null || next === readWelcome(userId)) return;
    try { if (next) localStorage.setItem(welcomeKey(userId), "1"); else localStorage.removeItem(welcomeKey(userId)); } catch { return; }
    window.dispatchEvent(new Event(WELCOME_EVENT));
  }, [pathname, userId, welcomeParam]);
  const welcome = pathname === "/profile/build" && (welcomeParam || welcomeFlow);
  const journeyStep = pathname === "/profile/develop" && query.get("return") === "build";
  // The whole CV flow and every step of the profile journey are headerless.
  if(!profile || welcome || ["/","/login","/signup","/auth","/forgot-password","/reset-password","/resend-confirmation","/pricing","/features","/privacy","/velaris-preview"].includes(pathname) || pathname.startsWith("/admin") || pathname.includes("onboarding") || pathname.startsWith("/youth/cv") || journeyStep || pathname.startsWith("/youth/get-started")) return null;
  if(profile.role === "youth") return <YouthNavigation pathname={pathname}/>;
  const items: {href:string; label:string; icon:IconName; view?:string}[] = profile.role === "company" ? [
    {href:COMPANY_ROUTES.listings, label:"Annonser", icon:"briefcase",view:"annonser"},
    {href:COMPANY_ROUTES.candidates,label:"Kandidater",icon:"discover",view:"kandidater"},
    {href:"/chats",label:"Meddelanden",icon:"chat"},
    {href:"/notifications",label:"Notiser",icon:"bell"},
    {href:"/profile",label:"Profil",icon:"profile"},
  ] : [{href:"/private",label:"Uppdrag",icon:"briefcase"},{href:"/chats",label:"Chattar",icon:"chat"},{href:"/notifications",label:"Aktivitet",icon:"activity"},{href:"/profile",label:"Profil",icon:"profile"}];
  return <nav className={styles.nav} aria-label="Huvudnavigation"><Link className={styles.brand} href={items[0].href}><BrandLogo/></Link><div className={styles.links}>{items.map(item => {
    const selectedCompanyView = companyView(query.get("view"));
    const active = pathname === item.href.split("?")[0] && (!item.view || selectedCompanyView === item.view || ((selectedCompanyView === "skapa" || selectedCompanyView === "redigera") && item.view === "annonser"));
    return <Link key={item.href} href={item.href} className={`${styles.item} ${active ? styles.active : ""}`} aria-current={active ? "page" : undefined}><UiIcon name={item.icon}/><span>{item.label}</span></Link>;
  })}</div><Link className={styles.account} href={profile.role === "company" ? COMPANY_ROUTES.account : "/profile"} aria-label="Mitt konto"><UiIcon name="profile"/></Link></nav>;
}
