import styles from "./application-disclosure-view.module.css";

export function DisclosureLoadState({ error, retry, loadingText = "Hämtar ansökningsunderlag…" }: {
  error?: string;
  retry: () => void;
  loadingText?: string;
}) {
  return <div className={styles.root}><section className={styles.panel} aria-busy={!error}>
    {error ? <><p role="alert" className={styles.error}>{error}</p><button type="button" className={styles.cvButton} onClick={retry}>Försök igen</button></> : <p role="status">{loadingText}</p>}
  </section></div>;
}
