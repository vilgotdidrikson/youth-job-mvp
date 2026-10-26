import { UiIcon } from "@/components/ui-icon";
import styles from "./marketing-product-preview.module.css";

/**
 * Static, clearly fictional product views for the marketing pages (DA-15).
 * Presentation only: no data, links or app logic. The figure carries the accessible
 * description and the drawing itself is hidden from assistive technology.
 */

export function SwipeCardPreview() {
  return (
    <figure className={styles.figure} role="img" aria-label="Exempel på ett jobbkort i appen: Kafébiträde helger hos Kaféet på hörnet, med knapparna Inte nu och Intresserad.">
      <div className={styles.phone} aria-hidden="true">
        <div className={styles.card}>
          <div className={styles.cardTop}>
            <span className={styles.badge}>Exempel</span>
            <span className={styles.bookmark}><UiIcon name="bookmark" width="18" height="18" /></span>
          </div>
          <div className={styles.cardContent}>
            <p className={styles.company}>Kaféet på hörnet</p>
            <p className={styles.title}>Kafébiträde helger</p>
            <div className={styles.chips}>
              <span>Södermalm</span>
              <span>Deltid</span>
              <span>Helger</span>
            </div>
          </div>
        </div>
        <div className={styles.actions}>
          <span className={styles.action}><span className={styles.actionIcon}><UiIcon name="close" width="20" height="20" /></span>Inte nu</span>
          <span className={`${styles.action} ${styles.actionPrimary}`}><span className={styles.actionIcon}><UiIcon name="heart" width="22" height="22" /></span>Intresserad</span>
        </div>
      </div>
    </figure>
  );
}

const candidates = [
  { initials: "AS", name: "Alex S.", detail: "Kan jobba helger", status: "Ny", tone: "new" },
  { initials: "MK", name: "Mira K.", detail: "Har jobbat i kassa", status: "Intervju", tone: "interview" },
  { initials: "JL", name: "Jonas L.", detail: "Bor nära Södermalm", status: "Kontaktad", tone: "contacted" },
] as const;

export function CandidatePreview() {
  return (
    <figure className={styles.figure} role="img" aria-label="Exempel på företagets kandidatvy: tre ansökningar till Kafébiträde helger med status Ny, Intervju och Kontaktad.">
      <div className={styles.panel} aria-hidden="true">
        <div className={styles.panelHeader}>
          <div>
            <p className={styles.panelTitle}>Kafébiträde helger</p>
            <p className={styles.panelMeta}>3 ansökningar</p>
          </div>
          <span className={styles.badgeQuiet}>Exempel</span>
        </div>
        <ul className={styles.candidates}>
          {candidates.map((candidate, index) => (
            <li key={candidate.name} className={index === 0 ? styles.candidateSelected : undefined}>
              <span className={styles.avatar}>{candidate.initials}</span>
              <span className={styles.candidateText}>
                <span className={styles.candidateName}>{candidate.name}</span>
                <span className={styles.candidateDetail}>{candidate.detail}</span>
              </span>
              <span className={`${styles.status} ${styles[candidate.tone]}`}>{candidate.status}</span>
            </li>
          ))}
        </ul>
        <span className={styles.panelAction}>Visa ansökan</span>
      </div>
    </figure>
  );
}
