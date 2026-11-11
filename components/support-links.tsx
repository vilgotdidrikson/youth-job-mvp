import Link from "next/link";
import styles from "./support-links.module.css";
/** Public destinations; no session, account data or redirect query is needed. */
export function SupportLinks(){return <nav className={styles.links} aria-label="Hjälp och information"><Link href="/help">Hjälp och kontakt</Link><Link href="/privacy">Integritet och AI</Link></nav>;}
