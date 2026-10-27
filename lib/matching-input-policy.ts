/** Local minimization before any matching-provider request; never edits the saved CV.
 * Heuristics cannot certify arbitrary free text. review_required means omissions,
 * not permission to infer the omitted information or generate new questions.
 */
export type MatchingInputStatus = "minimized" | "review_required";
export interface MinimizedMatchingText { text: string; status: MatchingInputStatus; removed: number }
const sensitive = /(?<![\p{L}\p{M}\p{N}_])(?:adhd|add|autis[\p{L}\p{M}\p{N}_]*|asperger[\p{L}\p{M}\p{N}_]*|dyslex[\p{L}\p{M}\p{N}_]*|diabet[\p{L}\p{M}\p{N}_]*|cancer|depress[\p{L}\p{M}\p{N}_]*|ångest[\p{L}\p{M}\p{N}_]*|diagnos[\p{L}\p{M}\p{N}_]*|sjukdom[\p{L}\p{M}\p{N}_]*|sjukskriv[\p{L}\p{M}\p{N}_]*|funktionsneds[\p{L}\p{M}\p{N}_]*|gravid[\p{L}\p{M}\p{N}_]*|medicinering|terapi|hiv|aids|bipol[\p{L}\p{M}\p{N}_]*|epilep[\p{L}\p{M}\p{N}_]*|hälsotillstånd|hälsa|hälsan|healthy|health condition|psykisk[\p{L}\p{M}\p{N}_]*|mental health|disabilit[\p{L}\p{M}\p{N}_]*|pregnan[\p{L}\p{M}\p{N}_]*|diagnos[\p{L}\p{M}\p{N}_]*|religio[\p{L}\p{M}\p{N}_]*|muslim[\p{L}\p{M}\p{N}_]*|kristen|kristna|judisk[\p{L}\p{M}\p{N}_]*|buddhis[\p{L}\p{M}\p{N}_]*|hindu[\p{L}\p{M}\p{N}_]*|ateist[\p{L}\p{M}\p{N}_]*|moské[\p{L}\p{M}\p{N}_]*|synagog[\p{L}\p{M}\p{N}_]*|kyrk[\p{L}\p{M}\p{N}_]*|församling[\p{L}\p{M}\p{N}_]*|politis[\p{L}\p{M}\p{N}_]*|socialdemokrat[\p{L}\p{M}\p{N}_]*|sverigedemokrat[\p{L}\p{M}\p{N}_]*|moderaterna|vänsterpart[\p{L}\p{M}\p{N}_]*|miljöpart[\p{L}\p{M}\p{N}_]*|kristdemokrat[\p{L}\p{M}\p{N}_]*|liberalerna|centerpart[\p{L}\p{M}\p{N}_]*|ung vänster|muf|ssu|facklig[\p{L}\p{M}\p{N}_]*|fackförbund[\p{L}\p{M}\p{N}_]*|facket|kommunal|unionen|homosex[\p{L}\p{M}\p{N}_]*|bisex[\p{L}\p{M}\p{N}_]*|heterosex[\p{L}\p{M}\p{N}_]*|sexuell[\p{L}\p{M}\p{N}_]*|sexliv|sexual[\p{L}\p{M}\p{N}_]*|transperson[\p{L}\p{M}\p{N}_]*|etnisk[\p{L}\p{M}\p{N}_]*|etnicitet|ursprung|nationalitet|medborgarskap|e-post|epost|telefonnummer|bostadsadress|genetisk[\p{L}\p{M}\p{N}_]*|biometri[\p{L}\p{M}\p{N}_]*|dna|fingeravtryck[\p{L}\p{M}\p{N}_]*|brott[\p{L}\p{M}\p{N}_]*|dömd[\p{L}\p{M}\p{N}_]*|dömts|belastningsregister|fängelse[\p{L}\p{M}\p{N}_]*|kriminal[\p{L}\p{M}\p{N}_]*|convict[\p{L}\p{M}\p{N}_]*|criminal[\p{L}\p{M}\p{N}_]*)(?![\p{L}\p{M}\p{N}_])/iu;
const identityLine = /(?:^|[\s:])(?:namn|name|adress|address|bostad|personnummer|födelsedatum|född|ålder|kön|civilstånd|familj|nationalitet|medborgarskap|telefon|tel|mobil|e-?post|email|kontakt|contact)\s*:/iu;
const contact = /(?<![\p{L}\p{M}\p{N}_.+-])[\p{L}\p{M}\p{N}_.+-]{1,64}\s*(?:@|\[at\]|\(at\))\s*[\p{L}\p{M}\p{N}_.-]{1,253}\.[\p{L}]{2,63}|https?:\/\/\S+|\b(?:www\.)\S+|\b(?:19|20)\d{6}[-+ ]?\d{4}\b|\b\d{6}[-+]\d{4}\b|(?:\+\d[\d ()-]{6,}\d)|\b0\d[\d ()-]{6,}\d\b|\b\d{3}\s?\d{2}\b/giu;
const containsContact = new RegExp(contact.source, "iu");
/** Detection only: never normalize retained source passages or saved documents. */
function detectionText(text: string): string {
  return text.replace(/\p{Cf}/gu, "").normalize("NFKC");
}
const street = /(?<![\p{L}\p{M}\p{N}_])[\p{L}]+(?:gatan|vägen|gränd|allén|torget|street|road)\s+\d+[\p{L}]?(?![\p{L}\p{M}\p{N}_])/iu;
function excludedText(text: string, excludeContacts: boolean): boolean {
  const detected = detectionText(text);
  return sensitive.test(detected) || identityLine.test(detected) || street.test(detected) || (excludeContacts && containsContact.test(detected))
    || /(?<![\p{L}\p{M}\p{N}_])(?:jag heter|mitt namn är|my name is|i am named)(?![\p{L}\p{M}\p{N}_])/iu.test(detected);
}
export function isExcludedMatchingText(text: string): boolean { return excludedText(text, true); }
export function minimizeMatchingText(input: string, identities: string[] = []): MinimizedMatchingText {
  if (input.length > 120000) throw new Error("Matchningsunderlaget är för långt och behöver granskas.");
  let removed = 0;
  const identityPatterns = identities.filter(value => value.trim().length >= 3).map(value => {
    const escaped = detectionText(value.trim()).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return escaped.length >= 3 ? new RegExp(escaped, "giu") : null;
  }).filter((pattern): pattern is RegExp => pattern !== null);
  // Split at source lines/sentence boundaries and explicit coordinating clauses.
  // Preserve retained source substrings verbatim for quote validation.
  const clauses = input.split(/(\r\n|[\r\n\u2028\u2029]|(?<=[.!?;])\s+|\s+(?:och|men|and|but)\s+)/u);
  const kept: string[] = [];
  let separator = "";
  let omitted = false;
  for (let index = 0; index < clauses.length; index += 2) {
    if (index > 0) separator += clauses[index - 1];
    const text = clauses[index].trim();
    if (!text) { separator += clauses[index]; continue; }
    // Typical standalone CV name heading (never infer a name from experience prose).
    const detected = detectionText(text);
    const nameHeading = /^(?:(?:cv_text|PDF-CV):\s*)?(?:[-•*]\s*)?[\p{Lu}][\p{Ll}\p{M}]+(?:[- ][\p{Lu}][\p{Ll}\p{M}]+){1,3}$/u.test(detected);
    // Normalization can change string offsets. Drop the original clause when a
    // normalized contact/known identity is found, rather than redacting wrong bytes.
    const normalizedIdentity = detected !== text && identityPatterns.some(pattern => {
      pattern.lastIndex = 0;
      return pattern.test(detected);
    });
    if (excludedText(text, false) || nameHeading || (detected !== text && containsContact.test(detected)) || normalizedIdentity) { removed++; omitted = true; separator = ""; continue; }
    let clean = clauses[index].replace(contact, () => { removed++; return "[kontaktuppgift borttagen]"; });
    for (const pattern of identityPatterns) {
      pattern.lastIndex = 0;
      clean = clean.replace(pattern, () => { removed++; return "[identitetsuppgift borttagen]"; });
    }
    kept.push((kept.length ? omitted ? "\n" : separator : "") + clean);
    omitted = false;
    separator = "";
  }
  const text = removed ? kept.join("") : input;
  // Fail visibly instead of silently truncating approved details.
  if (text.length > 120000) throw new Error("Matchningsunderlaget är för långt och behöver granskas.");
  return { text, removed, status: removed ? "review_required" : "minimized" };
}
export function matchingIdentities(profile: Record<string, unknown>): string[] {
  return ["full_name", "email", "phone", "address", "postal_code"].flatMap(key => typeof profile[key] === "string" ? [profile[key] as string] : []);
}
