/** Conservative checks for explicit certificate and availability statements. */
export function fixedCriterionEvidence(label: string, source: string, today = new Date().toISOString().slice(0,10)): { status: "fulfilled" | "unfulfilled" | "unknown"; evidence: string } | null {
  const normalized = label.trim().toLowerCase();
  // A supplied earliest start date is evidence, even when it misses the deadline.
  // A relative start preference has no invented grace period. A future date needs employer review.
  const startRequirement = /(?:börja|start|tillträde|omgående)/i.test(normalized) && !/(?:helg|kväll|arbetstid|tider|skift)/i.test(normalized);
  if (startRequirement) {
    const dates = [...source.matchAll(/^Kan börja arbeta: (\d{4}-\d{2}-\d{2})$/gm)];
    if (!dates.length) return {status:"unknown",evidence:""};
    if (new Set(dates.map(match=>match[1])).size > 1) return {status:"unknown",evidence:""};
    const date=dates[0][1], explicit=/\b(\d{4}-\d{2}-\d{2})\b/.exec(normalized)?.[1];
    const immediate=/(?:omgående|omedelbart|snarast|direkt)/i.test(normalized);
    if (immediate && !explicit && date > today) return {status:"unknown",evidence:dates[0][0]};
    const deadline=explicit ?? (immediate ? today : null);
    if (!deadline) return {status:"unknown",evidence:dates[0][0]};
    return {status:date <= deadline ? "fulfilled":"unfulfilled",evidence:dates[0][0]};
  }
  // Language names alone never establish a level. Explicit self-reported levels do.
  const language=/^(?:kan |goda kunskaper i |flytande |behärskar )?(svenska|engelska|spanska)(?: (?:i tal och skrift|flytande))?$/.exec(normalized);
  if (language) {
    const lines=source.split("\n").filter(line=>new RegExp(`^Språk: ${language[1]}, självuppgiven nivå `,"i").test(line));
    if (!lines.length) return null;
    const requiredFluent=/flytande/.test(normalized);
    const levels=lines.map(line=>line.split("självuppgiven nivå ")[1]);
    const status=levels.map(level=>requiredFluent ? ["Flytande","Modersmål"].includes(level) ? "fulfilled" : ["Grundläggande","God","Mycket god"].includes(level) ? "unfulfilled" : "unknown" : ["God","Mycket god","Flytande","Modersmål"].includes(level) ? "fulfilled" : level === "Grundläggande" ? "unfulfilled" : "unknown");
    return new Set(status).size === 1 && status[0] !== "unknown" ? {status:status[0] as "fulfilled"|"unfulfilled",evidence:lines[0]} : {status:"unknown",evidence:""};
  }
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
