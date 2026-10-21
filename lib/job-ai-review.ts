/**
 * What an AI job-ad suggestion changes and which explicit facts it moves into
 * fields (F11). Framework-free: used by the generate route, the web builder and
 * later a mobile app. Facts are read from the employer's own text, never from
 * AI output, so nothing invented can reach the age or salary fields.
 */
import { draftSalary, EMPTY_JOB_FORM, type JobBuilderDraft } from "./job-copy";
import { JOB_AGE_MAX, JOB_AGE_MIN, jobFieldErrors, parseSalaryText } from "./job-fields";

type Salary = Pick<JobBuilderDraft, "salaryFrom" | "salaryTo" | "salaryType">;
interface Age { minAge: string; maxAge: string }
export interface JobTextFacts { age: Age | null; salary: Salary | null; review: string[] }

const normalize = (text: string) => text.toLocaleLowerCase("sv-SE").replace(/[ \s]+/g, " ").replace(/\s*[–—-]\s*/g, "–");
const AMOUNT = "(\\d{1,3}(?: \\d{3})+|\\d{1,7})";
// \b is ASCII-only and fails next to å, ä and ö; these bound on any letter or digit.
const B = "(?<![\\p{L}\\p{N}])", E = "(?![\\p{L}\\p{N}])";
const rx = (source: string) => new RegExp(source.replaceAll("<", B).replaceAll(">", E), "gu");
const salaryLabel = (salary: Salary) => draftSalary({ ...EMPTY_JOB_FORM, ...salary });
const unique = <T>(items: T[]) => [...new Map(items.map(item => [JSON.stringify(item), item])).values()];

export function ageLabel(age: Age): string {
  if (age.minAge && age.maxAge) return age.minAge === age.maxAge ? `${age.minAge} år` : `${age.minAge}–${age.maxAge} år`;
  return age.minAge ? `minst ${age.minAge} år` : `högst ${age.maxAge} år`;
}

/** Explicit age and salary statements in the employer's text; anything unclear is returned for review. */
export function extractJobFacts(text: string): JobTextFacts {
  const value = normalize(text);
  const review: string[] = [];
  const ages: Age[] = [];
  for (const match of value.matchAll(rx("<(\\d{2})–(\\d{2}) år>"))) ages.push({ minAge: match[1], maxAge: match[2] });
  for (const match of value.matchAll(rx("<(?:minst|lägst|från|fyllt|fyllda) (\\d{2}) år>"))) ages.push({ minAge: match[1], maxAge: "" });
  for (const match of value.matchAll(rx("<(\\d{2}) år (?:eller äldre|och uppåt)>"))) ages.push({ minAge: match[1], maxAge: "" });
  for (const match of value.matchAll(rx("<(?:högst|max|maximalt|upp till) (\\d{2}) år>"))) ages.push({ minAge: "", maxAge: match[1] });
  if (rx("<(?:över|under|äldre än|yngre än) \\d{2} år>").test(value)) review.push("Texten anger en ålder med över eller under. Fyll i åldersfälten så att gränsen blir exakt.");
  const validAges = unique(ages).filter(age => {
    if (Object.keys(jobFieldErrors({ ...age, salaryFrom: "", salaryTo: "", salaryType: "timlön" })).length === 0) return true;
    review.push(`Texten nämner ${ageLabel(age)}, som inte är ett giltigt spann mellan ${JOB_AGE_MIN} och ${JOB_AGE_MAX} år. Kontrollera texten.`);
    return false;
  });

  const salaries: Salary[] = [];
  const unit = "(tim|timme|timmen|h|mån|månad|månaden)";
  const pattern = rx(`(?:<(från|upp till) )?<${AMOUNT}(?:–${AMOUNT})? ?kr(?:onor)?(?: ?/ ?| per | i )${unit}>`);
  for (const match of value.matchAll(pattern)) {
    const [, prefix, first, second, rawUnit] = match;
    const canonicalUnit = /^(tim|timme|timmen|h)$/.test(rawUnit) ? "tim" : "mån";
    const parsed = parseSalaryText(`${prefix ? `${prefix} ` : ""}${first}${second ? `–${second}` : ""} kr/${canonicalUnit}`);
    if (parsed) salaries.push(parsed);
    else review.push("Texten nämner en lön som inte kan föras över, till exempel ett omvänt intervall eller ett ovanligt högt belopp. Kontrollera lönen.");
  }
  const validSalaries = unique(salaries);
  if (!validSalaries.length && rx("(?:<|tim|månads)lön(?:en|er)?>").test(value) && !review.some(item => item.includes("lön"))) review.push("Texten nämner lön utan tydligt belopp per timme eller månad. Fyll i lönefälten om ni vill visa beloppet.");

  if (validAges.length > 1) review.push(`Texten nämner flera åldrar (${validAges.map(ageLabel).join(", ")}). Fyll i det som gäller i åldersfälten.`);
  if (validSalaries.length > 1) review.push(`Texten nämner flera löner (${validSalaries.map(salaryLabel).join(", ")}). Fyll i det som gäller i lönefälten.`);
  return { age: validAges.length === 1 ? validAges[0] : null, salary: validSalaries.length === 1 ? validSalaries[0] : null, review };
}

/** Fills empty age and salary fields from explicit text. Never overwrites; disagreements are returned for review. */
export function transferJobFacts<T extends JobBuilderDraft>(form: T, facts: JobTextFacts): { form: T; transferred: string[]; review: string[] } {
  const transferred: string[] = [], review = [...facts.review];
  let next = form;
  if (facts.age) {
    const current = { minAge: form.minAge.trim(), maxAge: form.maxAge.trim() };
    if (!current.minAge && !current.maxAge) { next = { ...next, ...facts.age }; transferred.push(`Ålder: ${ageLabel(facts.age)}`); }
    else if (current.minAge !== facts.age.minAge || current.maxAge !== facts.age.maxAge) review.push(`Texten anger ${ageLabel(facts.age)} men åldersfälten anger ${ageLabel(current)}. Kontrollera vilket som gäller.`);
  }
  if (facts.salary) {
    const label = draftSalary({ ...form, ...facts.salary, salaryText: "" });
    const filled = form.salaryFrom.trim() || form.salaryTo.trim() || form.salaryText.trim();
    if (!filled) { next = { ...next, ...facts.salary }; transferred.push(`Lön: ${label}`); }
    else if (draftSalary(form) !== label) review.push(`Texten anger ${label} men lönefälten anger ${draftSalary(form)}. Kontrollera vilket som gäller.`);
  }
  return { form: next, transferred, review };
}

const key = (text: string) => text.toLocaleLowerCase("sv-SE").replace(/[^\p{L}\p{N} ]/gu, " ").replace(/\s+/g, " ").trim();
const same = (a: string, b: string) => { const x = key(a), y = key(b); return !!x && !!y && (x === y || (x.length >= 4 && y.includes(x)) || (y.length >= 4 && x.includes(y))); };

/**
 * Only requirements the employer stated in the requirement field may become
 * absolute match requirements (in the employer's wording). Other AI requirements
 * are returned as suggestions for the employer to accept or ignore.
 */
export function splitGroundedMustHaves(aiMustHaves: string[], explicitRequirements: string[]): { mustHaves: string[]; suggestedMustHaves: string[] } {
  const mustHaves = explicitRequirements.filter(explicit => aiMustHaves.some(item => same(item, explicit)));
  const suggestedMustHaves = aiMustHaves.filter(item => !explicitRequirements.some(explicit => same(item, explicit)));
  return { mustHaves: [...new Set(mustHaves)], suggestedMustHaves: [...new Set(suggestedMustHaves)] };
}

export interface AiChange { label: string; value: string }
export interface AiJobReview { listing: AiChange[]; matching: AiChange[]; transferred: string[]; review: string[]; suggestedMustHaves: string[] }

const list = (text: string) => text.split(/[\n,]+/).map(item => item.trim()).filter(Boolean);

/** What the company should check before publishing: listing text, internal matching, moved facts and open questions. */
export function summarizeAiChanges(before: JobBuilderDraft, after: JobBuilderDraft, extra: Pick<AiJobReview, "transferred" | "review" | "suggestedMustHaves">): AiJobReview {
  const listing: AiChange[] = [], matching: AiChange[] = [];
  if (after.description !== before.description) listing.push({ label: "Beskrivning", value: before.description.trim() ? "Omskriven av AI. Läs igenom att allt stämmer." : "Skriven av AI. Läs igenom att allt stämmer." });
  if (after.employmentType !== before.employmentType) listing.push({ label: "Anställningsform", value: `${after.employmentType} (förslag, ändra om det inte stämmer)` });
  if (after.benefits !== before.benefits && after.benefits.trim()) listing.push({ label: "Förmåner", value: list(after.benefits).join(", ") });
  if (after.requirements !== before.requirements) matching.push({ label: "Absoluta krav", value: list(after.requirements).join(", ") || "Inga" });
  if (after.trainableRequirements !== before.trainableRequirements && after.trainableRequirements.trim()) matching.push({ label: "Kan läras på plats", value: list(after.trainableRequirements).join(", ") });
  if (after.topTraits !== before.topTraits && after.topTraits.trim()) matching.push({ label: "Viktiga egenskaper", value: list(after.topTraits).join(", ") });
  if (JSON.stringify(after.candidateQuestions) !== JSON.stringify(before.candidateQuestions) && after.candidateQuestions.length) matching.push({ label: "Frågor till sökande", value: after.candidateQuestions.join(" · ") });
  return { listing, matching, ...extra };
}

export interface AiJobSuggestion {
  employmentType?: string; description?: string; benefits?: string[]; source?: "ai" | "fallback"; suggestedMustHaves?: string[];
  matchProfile?: { mustHaves?: string[]; trainableRequirements?: string[]; topTraits?: string[]; candidateQuestions?: string[] };
}
type AiFields = "employmentType" | "description" | "matchRoleSummary" | "benefits" | "requirements" | "trainableRequirements" | "topTraits" | "candidateQuestions" | "aiGenerated" | "minAge" | "maxAge" | "salaryFrom" | "salaryTo" | "salaryType";

/**
 * The fields an AI suggestion changes (only those, so edits made while it ran
 * survive), and the summary to show. An employment type
 * the employer chose is never replaced, and age or salary only come from the
 * employer's own description and requirement text.
 */
export function applyAiJobSuggestion(form: JobBuilderDraft, data: AiJobSuggestion): { patch: Partial<Pick<JobBuilderDraft, AiFields>>; review: AiJobReview } {
  const suggested: JobBuilderDraft = {
    ...form,
    employmentType: form.employmentType.trim() ? form.employmentType : data.employmentType || form.employmentType,
    description: data.description || form.description,
    matchRoleSummary: data.description || form.matchRoleSummary,
    benefits: data.benefits?.join(", ") || form.benefits,
    requirements: data.matchProfile?.mustHaves?.join(", ") || form.requirements,
    trainableRequirements: data.matchProfile?.trainableRequirements?.join(", ") || form.trainableRequirements,
    topTraits: data.matchProfile?.topTraits?.join(", ") || form.topTraits,
    candidateQuestions: data.matchProfile?.candidateQuestions?.slice(0, 3) || form.candidateQuestions,
    aiGenerated: data.source === "ai",
  };
  const facts = transferJobFacts(suggested, extractJobFacts([form.description, form.listingRequirements ?? form.requirements].join("\n")));
  const next = facts.form;
  const current = list(next.requirements);
  const suggestedMustHaves = (data.suggestedMustHaves ?? []).filter(item => !current.some(existing => same(existing, item)));
  const patch = Object.fromEntries((["employmentType", "description", "matchRoleSummary", "benefits", "requirements", "trainableRequirements", "topTraits", "candidateQuestions", "aiGenerated", "minAge", "maxAge", "salaryFrom", "salaryTo", "salaryType"] as const)
    .filter(field => field === "aiGenerated" || JSON.stringify(next[field]) !== JSON.stringify(form[field])).map(field => [field, next[field]])) as Partial<Pick<JobBuilderDraft, AiFields>>;
  return { patch, review: summarizeAiChanges(form, next, { transferred: facts.transferred, review: facts.review, suggestedMustHaves }) };
}

/** Accepting a suggested requirement adds it to the absolute match requirements. */
export function addMustHave(requirements: string, item: string): string {
  const current = list(requirements);
  return current.some(existing => same(existing, item)) ? requirements : [...current, item].join(", ");
}
