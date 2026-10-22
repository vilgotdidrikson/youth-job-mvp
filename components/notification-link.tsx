"use client";
import Link from "next/link";
import {UiIcon} from "./ui-icon";
import {useNavigationIndicators} from "@/hooks/use-navigation-indicators";
import styles from "./youth-navigation.module.css";
export function NotificationLink({desktop=false}:{desktop?:boolean}) {
  const {notifications}=useNavigationIndicators();
  return <Link href="/notifications" className={`${styles.notificationLink} ${desktop ? styles.desktopNotifications : styles.headerNotifications}`} aria-label={notifications ? "Notiser – olästa händelser" : "Notiser"}><UiIcon name="bell"/>{notifications && <span className={styles.dot} aria-hidden="true"/>}</Link>;
}
