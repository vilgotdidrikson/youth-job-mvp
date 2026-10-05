/** Conservative checks for explicit certificate and availability statements. */
export function fixedCriterionEvidence(label: string, source: string): { status: "fulfilled" | "unfulfilled" | "unknown"; evidence: string } | null {
  const normalized = label.trim().toLowerCase();
  const licence = /^(?:har |krav på )?(?:b[- ]körkort|körkort b)$/.test(normalized);
  const schedule = /^(?:kan |måste kunna )?(?:arbeta|jobba) (helger|kvällar)$/.exec(normalized);
  if (!licence && !schedule) return null;
  const sentences = source.split(/\n|[.!?](?:\s|$)/).map((item) => item.trim());
  const matches: { status: "fulfilled" | "unfulfilled"; evidence: string }[] = [];
  for (const sentence of sentences) {
    // Conditional wishes/plans cannot establish a qualification or availability.
    if (/\b(om|kanske|vill|planerar|tidigare|utgånget)\b/i.test(sentence)) continue;
    const text = sentence.replace(/^(?:cv_text|Ansökningssvar|Kompletteringssvar|Uppgift från profil\/CV):\s*/i, "").trim();
    if (licence) {
      if (/^(?:jag )?(?:har|saknar) (?:inte |inget )?b[- ]körkort$/i.test(text)) {
        matches.push({ status: /(?:saknar|inte|inget)/i.test(text) ? "unfulfilled" : "fulfilled", evidence: sentence });
      } else if (/^certificates:\s*b[- ]körkort$/i.test(text)) matches.push({ status: "fulfilled", evidence: sentence });
    } else if (schedule) {
      const expression = new RegExp(`^(?:jag )?kan (inte )?(?:arbeta|jobba) ${schedule[1]}$`, "i");
      const match = expression.exec(text);
      if (match) matches.push({ status: match[1] ? "unfulfilled" : "fulfilled", evidence: sentence });
    }
  }
  // Conflicting CV/supplement statements require human review.
  if (!matches.length || new Set(matches.map((item) => item.status)).size > 1) return { status: "unknown", evidence: "" };
  return matches[0];
}
