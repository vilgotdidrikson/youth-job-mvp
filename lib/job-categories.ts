/** Stable work categories; industry, skill requirements and free titles stay separate. */
export const JOB_CATEGORIES = [
  { id: "cafe", label: "Caféarbete", aliases: ["café", "cafe", "caféarbete", "caféjobb", "cafépersonal", "cafémedarbetare", "cafebiträde", "barista"], role: /\b(barista|cafe(?:medarbetare|personal|jobb|bitrade|arbete))\b/ },
  { id: "restaurant", label: "Restaurang och kök", aliases: ["restaurang", "restaurangarbete", "restaurang och kök", "servitör", "köksbiträde", "diskare"], role: /\b(servitor|servitris|koksbitrade|kock|diskare|restaurang(?:personal|bitrade|medarbetare|arbete|jobb))\b/ },
  { id: "retail", label: "Butiksarbete", aliases: ["butik", "butiksarbete", "butiksjobb", "butikspersonal", "butiksmedarbetare", "butikssäljare"], role: /\b(butiks(?:medarbetare|saljare|personal|arbete|jobb)|kassapersonal)\b/ },
  { id: "childcare", label: "Barnomsorg", aliases: ["barnomsorg", "barnpassning", "barnvakt", "förskola"], role: /\b(barnvakt|barnpassning|barnskotare|forskoleassistent)\b/ },
  { id: "sports", label: "Idrott och träning", aliases: ["idrott", "idrott och träning", "tränare", "fotbollstränare", "sport"], role: /\b(?:fotbolls|idrotts|sim|gymnastik)?tranare\b|\bidrottsledare\b/ },
  { id: "events", label: "Eventarbete", aliases: ["event", "eventarbete", "eventpersonal", "festivaljobb", "eventvärd"], role: /\b(event(?:arbete|personal|vard|jobb)|festival(?:jobb|personal)|massvard)\b/ },
  { id: "warehouse", label: "Lagerarbete", aliases: ["lager", "lagerarbete", "lagerjobb", "lagerarbetare", "orderplockare"], role: /\b(lager(?:arbete|arbetare|medarbetare|personal|jobb)|orderplockare)\b/ },
  { id: "delivery", label: "Leverans och bud", aliases: ["leverans", "leverans och bud", "bud", "chaufför", "budjobb"], role: /\b(bud(?:bil|chauffor|jobb)?|chauffor|leverans(?:forare|personal))\b/ },
  { id: "customer-service", label: "Kundtjänst", aliases: ["kundtjänst", "kundservice", "kundtjänstmedarbetare", "supportmedarbetare"], role: /\b(kundtjanst(?:medarbetare)?|kundservice|supportmedarbetare)\b/ },
  { id: "administration", label: "Administration", aliases: ["administration", "administratör", "kontorsassistent", "receptionist"], role: /\b(administrator|kontorsassistent|receptionist|administrativ(?:a)? assistent)\b/ },
  { id: "finance", label: "Ekonomiarbete", aliases: ["ekonomi", "ekonomiarbete", "ekonom", "ekonomiassistent", "redovisning"], role: /\b(ekonom|ekonomiassistent|redovisningsekonom|bokforare)\b/ },
  { id: "supervision", label: "Handledning", aliases: ["handledare", "handledning", "läxhjälp", "läxhjälpare"], role: /\b(handledare|laxhjalp(?:are)?)\b/ },
  { id: "social-media", label: "Sociala medier", aliases: ["sociala medier", "innehållsskapare", "content creator"], role: /\b(innehallsskapare|content creator|sociala medier)\b/ },
  { id: "cleaning", label: "Städarbete", aliases: ["städ", "städarbete", "städare", "lokalvårdare"], role: /\b(stadare|stadpersonal|lokalvardare)\b/ },
  { id: "gardening", label: "Trädgårdsarbete", aliases: ["trädgård", "trädgårdsarbete", "trädgårdsarbetare", "parkarbete"], role: /\b(tradgards(?:arbetare|arbete)|parkarbetare)\b/ },
] as const;
export type JobCategoryId = (typeof JOB_CATEGORIES)[number]["id"];
const normalize = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("sv-SE").trim();
const ids = new Set<string>(JOB_CATEGORIES.map(category => category.id));
export function validJobCategoryIds(value: unknown, max = 3): JobCategoryId[] {
  if (!Array.isArray(value) || value.length > max || value.some(id => typeof id !== "string" || !ids.has(id)) || new Set(value).size !== value.length) throw new Error(`Välj högst ${max} giltiga jobbtyper.`);
  return value as JobCategoryId[];
}
export function categoryLabel(id: string): string { return JOB_CATEGORIES.find(category => category.id === id)?.label ?? (id === "unclassified" ? "Övriga jobb" : id); }
export function roleCategoryIds(text: string): JobCategoryId[] {
  const value = normalize(text);
  const exact = JOB_CATEGORIES.filter(c => c.id === value || c.aliases.some(alias => normalize(alias) === value));
  if (exact.length) return exact.map(c => c.id);
  // Strong role terms win over venue words: an economist at a café is finance.
  const strong = JOB_CATEGORIES.filter(c => c.role.test(value));
  if (strong.length) return strong.map(c => c.id);
  const generic = /^(?:vi soker |soker |soker jobb (?:inom|som) |jobb (?:inom|som) |medarbetare (?:pa|till) |personal (?:pa|till) )/;
  const stripped = value.replace(generic, "").trim();
  return JOB_CATEGORIES.filter(c => c.aliases.some(alias => normalize(alias) === stripped)).map(c => c.id);
}
export function suggestJobCategories(title: string, description = "", legacyCategory = ""): { ids: JobCategoryId[]; candidates: JobCategoryId[] } {
  const titleRoles = roleCategoryIds(title);
  // Description is only a fallback when the title gives no identifiable role.
  // Never infer from a company's industry, benefits or venue alone.
  const candidates = titleRoles.length ? titleRoles : roleCategoryIds(description);
  if (candidates.length) return { ids: candidates.length === 1 ? candidates : [], candidates };
  const legacy = roleCategoryIds(legacyCategory);
  return { ids: legacy.length === 1 ? legacy : [], candidates: legacy };
}
export interface CategorizedJob { title: string; description?: string; category?: string; job_category_ids?: string[]; job_category_manual?: boolean }
export function effectiveJobCategories(job: CategorizedJob): JobCategoryId[] {
  if (job.job_category_manual || job.job_category_ids?.length) {
    try { return validJobCategoryIds(job.job_category_ids ?? []); } catch { return []; }
  }
  return suggestJobCategories(job.title, job.description, job.category).ids;
}
export function jobMatchesCategory(job: CategorizedJob, filter: string): boolean {
  if (!filter.trim()) return true;
  const actual = effectiveJobCategories(job);
  if (filter === "unclassified") return actual.length === 0;
  const desired = roleCategoryIds(filter);
  return desired.length ? desired.some(id => actual.includes(id)) : normalize(job.category ?? "") === normalize(filter);
}
export function jobCategoryFilterValues(jobs: CategorizedJob[]): string[] {
  const used = new Set(jobs.flatMap(job => { const values = effectiveJobCategories(job); return values.length ? values : ["unclassified"]; }));
  return [...used].sort((a,b)=>categoryLabel(a).localeCompare(categoryLabel(b),"sv"));
}
/** Free preference text is preserved; equivalent phrases derive the same IDs. */
export function preferredJobCategories(roles: string[]): JobCategoryId[] { return [...new Set(roles.flatMap(roleCategoryIds))]; }
export function draftJobCategories(draft: {title:string;description:string;category:string;categoryIds:string[];categoryManual:boolean}): JobCategoryId[] {
  return draft.categoryManual ? validJobCategoryIds(draft.categoryIds) : suggestJobCategories(draft.title,draft.description,draft.category).ids;
}
