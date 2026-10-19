/** Local minimization before any matching-provider request; never edits the saved CV.
 * Heuristics cannot certify arbitrary free text. review_required means omissions,
 * not permission to infer the omitted information or generate new questions.
 */
export type MatchingInputStatus = "minimized" | "review_required";
export interface MinimizedMatchingText { text: string; status: MatchingInputStatus; removed: number }
const sensitive = /(?:\b(?:adhd|add|autis\w*|asperger\w*|dyslex\w*|diabet\w*|cancer|depress\w*|ångest\w*|diagnos\w*|sjukdom\w*|sjukskriv\w*|funktionsneds\w*|gravid\w*|medicinering|terapi|hiv|aids|bipol\w*|epilep\w*|hälsotillstånd|hälsa|hälsan|healthy|health condition|psykisk\w*|mental health|disabilit\w*|pregnan\w*|diagnos\w*|religio\w*|muslim\w*|kristen|kristna|judisk\w*|buddhis\w*|hindu\w*|ateist\w*|moské\w*|synagog\w*|kyrk\w*|församling\w*|politis\w*|socialdemokrat\w*|sverigedemokrat\w*|moderaterna|vänsterpart\w*|miljöpart\w*|kristdemokrat\w*|liberalerna|centerpart\w*|ung vänster|muf|ssu|facklig\w*|fackförbund\w*|facket|kommunal|unionen|homosex\w*|bisex\w*|heterosex\w*|sexuell\w*|sexliv|sexual\w*|transperson\w*|etnisk\w*|etnicitet|ursprung|nationalitet|medborgarskap|e-post|epost|telefonnummer|bostadsadress|genetisk\w*|biometri\w*|dna|fingeravtryck\w*|brott\w*|dömd\w*|dömts|belastningsregister|fängelse\w*|kriminal\w*|convict\w*|criminal\w*)\b)/iu;
const identityLine = /^(?:(?:cv_text|PDF-CV):\s*)?(?:namn|name|adress|address|bostad|personnummer|födelsedatum|född|ålder|kön|civilstånd|familj|nationalitet|medborgarskap|telefon|tel|mobil|e-?post|email|kontakt|contact)\s*:/iu;
const contact = /(?<![\w.+-])[\w.+-]{1,64}\s*(?:@|\[at\]|\(at\))\s*[\w.-]{1,253}\.[a-z]{2,63}|https?:\/\/\S+|\b(?:www\.)\S+|\b(?:19|20)\d{6}[-+ ]?\d{4}\b|\b\d{6}[-+]\d{4}\b|(?:\+\d[\d ()-]{6,}\d)|\b0\d[\d ()-]{6,}\d\b|\b\d{3}\s?\d{2}\b/giu;
const street = /\b[\p{L}]+(?:gatan|vägen|gränd|allén|torget|street|road)\s+\d+\w?\b/iu;
export function isExcludedMatchingText(text: string): boolean { return sensitive.test(text) || identityLine.test(text) || street.test(text) || /\b(?:jag heter|mitt namn är|my name is|i am named)\b/iu.test(text); }
export function minimizeMatchingText(input: string, identities: string[] = []): MinimizedMatchingText {
  if (input.length > 120000) throw new Error("Matchningsunderlaget är för långt och behöver granskas.");
  let removed = 0;
  // Split at source lines/sentence boundaries and explicit coordinating clauses.
  // Preserve retained source substrings verbatim for quote validation.
  const clauses = input.split(/\n|(?<=[.!?;])\s+|\s+(?:och|men|and|but)\s+/u);
  const kept: string[] = [];
  for (const clause of clauses) {
    const text = clause.trim();
    if (!text) continue;
    // Typical standalone CV name heading (never infer a name from experience prose).
    const nameHeading = /^(?:cv_text:\s*)?[\p{Lu}][\p{Ll}]+(?:[- ][\p{Lu}][\p{Ll}]+){1,3}$/u.test(text);
    if (isExcludedMatchingText(text) || nameHeading) { removed++; continue; }
    let clean = text.replace(contact, () => { removed++; return "[kontaktuppgift borttagen]"; });
    for (const identity of identities.filter(value => value.trim().length >= 3)) {
      const escaped = identity.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      clean = clean.replace(new RegExp(escaped, "giu"), () => { removed++; return "[identitetsuppgift borttagen]"; });
    }
    kept.push(clean);
  }
  const text = removed ? kept.join("\n") : input;
  // Fail visibly instead of silently truncating approved details.
  if (text.length > 120000) throw new Error("Matchningsunderlaget är för långt och behöver granskas.");
  return { text, removed, status: removed ? "review_required" : "minimized" };
}
export function matchingIdentities(profile: Record<string, unknown>): string[] {
  return ["full_name", "email", "phone", "address", "postal_code"].flatMap(key => typeof profile[key] === "string" ? [profile[key] as string] : []);
}
