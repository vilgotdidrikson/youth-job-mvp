"use client";
import type { ApplicationRetention, ConversationRetention } from "@/lib/data-retention";
import type { ReadState } from "@/lib/latest-read";
import styles from "./data-retention-notice.module.css";
const date = (value: string) => new Date(value).toLocaleString("sv-SE");
export function ApplicationRetentionNotice({ record }: { record?: ApplicationRetention }) {
  if (!record || (!record.enforced && !record.purged_at)) return null;
  return <p className={styles.notice}>{record.purged_at ? "Ansökans underlag har raderats." : record.expired ? "Ansökans underlag är inte längre tillgängligt." : <>Underlaget raderas <time dateTime={record.delete_after}>{date(record.delete_after)}</time>.</>}</p>;
}
export function RetiredApplicationCard({ record, hidden = false }: { record: ApplicationRetention; hidden?: boolean }) {
  return <article hidden={hidden} className="card application-completion-card"><header><div><p>{record.company_name}</p><h2>{record.job_title}</h2></div><span className="application-status">{record.purged_at ? "Underlag raderat" : "Lagringstid uppnådd"}</span></header><ApplicationRetentionNotice record={record}/></article>;
}
export function ConversationRetentionNotice({ value, state, retry }: { value?: ConversationRetention; state: ReadState<ConversationRetention>; retry: () => void }) {
  if (state.status === "error") return <div className={styles.notice}><p role="alert">{state.message}</p><button type="button" className="secondary-btn" onClick={retry}>Försök igen</button></div>;
  if (!value) return <p className={styles.notice} role="status">Kontrollerar chattens status…</p>;
  if ((!value.enforced && !value.purged_at) || value.expired) return null;
  return <p className={styles.notice} role="status">{value.purged_at ? "Chattens meddelanden har raderats." : value.expired ? "Chattens meddelanden är inte längre tillgängliga." : value.read_only ? <>Chatten är skrivskyddad efter sex månaders inaktivitet. Meddelandena raderas <time dateTime={value.delete_after}>{date(value.delete_after)}</time>.</> : <>Vid fortsatt inaktivitet blir chatten skrivskyddad <time dateTime={value.read_only_at}>{date(value.read_only_at)}</time>.</>}</p>;
}
