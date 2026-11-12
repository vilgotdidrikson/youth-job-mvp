import { PRIVACY_CASE_KINDS, PRIVACY_CASE_STATUSES, type PrivacyCase } from "@/lib/privacy-cases";
import { PrivacyCaseHistory, PrivacyCaseMessages } from "./privacy-case-history";
import { CONTACT_EMAIL } from "@/lib/product-copy";
import styles from "@/app/account/privacy-requests/page.module.css";
export function PrivacyCaseThread({ item, admin = false, owner }: { item: PrivacyCase; admin?: boolean; owner?: string }) {
  const date = (v: string) => new Date(v).toLocaleString("sv-SE", { timeZone: "Europe/Stockholm" });
  return <div>
    <h2>{PRIVACY_CASE_KINDS[item.kind]}</h2>
    <p><strong>{PRIVACY_CASE_STATUSES[item.status]}</strong> · {date(item.created_at)}</p>
    <p>Ärendenummer: <span>{item.id}</span></p>
    <p className={styles.message}>{item.body}</p>
    {admin && <p>Beräknat svarsdatum: {date(item.reply_due_at)}. Kontrollera tillämplig tidsfrist vid handläggningen; vänteläge och återöppning flyttar inte datumet.</p>}
    {!admin && <p>{item.status === "new" ? "Din begäran är mottagen. Du kan följa svaren här." : item.status === "in_progress" ? "Vi handlägger din begäran. Du kan komplettera den här." : item.status === "waiting_for_user" ? "Läs vår fråga nedan och komplettera ärendet när du kan." : "Läs vårt avslutande svar nedan. Kontakta oss om du behöver mer hjälp."}</p>}
    {!admin && item.status !== "closed" && <p>Beräknat svarsdatum: {date(item.reply_due_at)}. Behöver datumet ändras informerar vi dig i ärendet. Ett vänteläge flyttar inte datumet automatiskt.</p>}
    {!admin && <p>Följ svaren på den här sidan; inga automatiska mejlnotiser skickas ännu. <a href={`mailto:${CONTACT_EMAIL}`}>Kontakta oss</a> och ange ärendenumret om du behöver hjälp.</p>}
    {admin && item.status !== "closed" && item.review_after && <p>Följ upp senast: {date(item.review_after)}.</p>}
    {owner && <PrivacyCaseHistory key={item.id+":"+item.revision} item={item} owner={owner} admin={admin}/>}
    <PrivacyCaseMessages events={item.events} admin={admin}/>
    {item.events_truncated && !owner && <p>Här visas de senaste 20 händelserna. Kontakta oss med ärendenumret om du behöver äldre historik.</p>}
    {item.status === "closed" && <p>Avslutat {date(item.closed_at!)}. Ett avslutat ärende betyder att handläggningen avslutats; det är inte i sig ett bevis på att uppgifter har exporterats eller raderats.</p>}
  </div>;
}
