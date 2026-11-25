/** Repair the legacy automatic language template only while it is unanswered.
 * Original question/evidence stays unchanged in storage and answered history. */
export function supplementQuestionText(question: string, label: string | undefined, status: string, source?: string): string {
  if (source === "company" || status !== "pending" || !label || question !== `Hur beskriver du dina kunskaper i ${label}? Ange gärna din nivå och om du kan använda språket i tal och skrift.`) return question;
  const languages = [...label.matchAll(/(?<!\p{L})(svenska|engelska|spanska|franska|tyska|arabiska|polska|italienska|finska|danska|norska|persiska|turkiska|ukrainska|ryska|kinesiska|teckenspråk)(?!\p{L})/giu)].map(match => match[0].toLocaleLowerCase("sv-SE"));
  const unique = [...new Set(languages)];
  const names = unique.length > 1 ? `${unique.slice(0, -1).join(", ")} och ${unique.at(-1)}` : unique[0];
  if (!names && !/(?<!\p{L})språk(?!\p{L})/iu.test(label)) return question;
  const context = label.trim().toLocaleLowerCase("sv-SE") === names ? "" : ` Annonsens önskemål: ”${label}”.`;
  return (names ? `Hur beskriver du dina kunskaper i ${names}?` : "Vilka språk kan du använda i arbetet?") + " Ange gärna din nivå i tal och skrift." + context;
}
