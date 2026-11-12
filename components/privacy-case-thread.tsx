import { PRIVACY_CASE_KINDS, PRIVACY_CASE_STATUSES, type PrivacyCase } from "@/lib/privacy-cases";
export function PrivacyCaseThread({ item, admin = false }: { item: PrivacyCase; admin?: boolean }) {
  const date = (v: string) => new Date(v).toLocaleString("sv-SE");
  return <div>
    <h2>{PRIVACY_CASE_KINDS[item.kind]}</h2>
    <p><strong>{PRIVACY_CASE_STATUSES[item.status]}</strong> · {date(item.created_at)}</p>
    <p>Ärendenummer: <span>{item.id}</span></p>
    <p style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{item.body}</p>
    {admin && <p>Beräknat svarsdatum: {date(item.reply_due_at)}. Kontrollera tillämplig tidsfrist vid handläggningen; vänteläge och återöppning flyttar inte datumet.</p>}
    {item.events.filter(e => e.public_message).map(event => <blockquote key={event.id}><p>{event.action === "user_reply" ? admin ? "Användarens komplettering" : "Din komplettering" : "Svar från MatchnWork"} · {date(event.created_at)}</p><p style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{event.public_message}</p></blockquote>)}
    {item.events_truncated && <p>Här visas de senaste 20 händelserna. Kontakta oss med ärendenumret om du behöver äldre historik.</p>}
    {item.status === "closed" && <p>Avslutat {date(item.closed_at!)}. Ett avslutat ärende betyder att handläggningen avslutats; det är inte i sig ett bevis på att uppgifter har exporterats eller raderats.</p>}
  </div>;
}
