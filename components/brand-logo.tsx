import Image from "next/image";
import styles from "./brand-logo.module.css";

/** The supplied artwork is shared by navigation, onboarding and icon assets. */
export function BrandLogo({ variant = "full", tone = "inherit" }: { variant?: "full" | "mark"; tone?: "inherit" | "light" | "dark" }) {
  return <span className={`${styles.logo} ${styles[tone]}`} data-brand-logo={variant}>
    <Image className={styles.mark} src="/brand/matchnwork-logo.png" width={500} height={500} alt={variant === "mark" ? "MatchnWork" : ""} unoptimized/>
    {variant === "full" && <span className={styles.name}>MatchnWork</span>}
  </span>;
}
