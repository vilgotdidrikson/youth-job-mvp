/** Explicit first-person descriptions only. No trait inference from a job title. */
const groups = [
  { labels: /^(?:punktlig|punktlighet|bra på att passa tider|passar tider)$/i, positive: /(?:jag är punktlig|jag (?:är )?bra på att passa tider|jag passar tider|jag kommer i tid)/i, negative: /(?:jag är inte punktlig|jag (?:är )?inte bra på att passa tider|jag passar inte tider|jag kommer inte i tid)/i },
  { labels: /^(?:ansvarstagande|ansvarsfull|ansvar)$/i, positive: /(?:jag är ansvarstagande|jag är ansvarsfull)/i, negative: /(?:jag är inte ansvarstagande|jag är inte ansvarsfull)/i },
  { labels: /^(?:samarbete|samarbetsförmåga|samarbetsvillig|bra på att samarbeta)$/i, positive: /(?:jag är bra på att samarbeta|jag samarbetar bra)/i, negative: /(?:jag är inte bra på att samarbeta|jag samarbetar inte bra)/i },
];
export function isPersonalTrait(label: string): boolean { return groups.some(group => group.labels.test(label.trim())) || /^(?:ledarskap|ledaregenskaper|social|utåtriktad|noggrann|initiativtagande|stresstålig|flexibel|självständig)$/i.test(label.trim()); }
export function selfReportedTraitEvidence(label: string, source: string): {status:"fulfilled"|"unfulfilled"|"unknown"; evidence:string} | null {
  const group = groups.find(item => item.labels.test(label.trim()));
  if (!group) return null;
  const found: {status:"fulfilled"|"unfulfilled";evidence:string}[] = [];
  for (const line of source.split(/\n|(?<=[.!?])\s+/)) {
    if (/\b(?:kanske|vill|hoppas|önskar|om|tidigare|förut|förra året|inte längre|min kompis|min bror|min syster)\b/i.test(line)) continue;
    const negative = group.negative.exec(line), positive = group.positive.exec(line);
    const match = negative ?? positive;
    if (!match || /\b(?:kanske|ibland|inte|aldrig|sällan|när|om)\b/i.test(line.slice(match.index + match[0].length))) continue;
    // A reported quotation or hypothetical statement is not the candidate's own claim.
    const prefix = line.slice(0,match.index);
    if (!/^(?:(?:cv_text|Ansökningssvar|Kompletteringssvar|profile|Vad jag gjorde):\s*)?$/i.test(prefix.trim())) continue;
    found.push({status:negative ? "unfulfilled":"fulfilled",evidence:line.trim()});
  }
  if (!found.length || new Set(found.map(item => item.status)).size > 1) return null;
  return found[0];
}
