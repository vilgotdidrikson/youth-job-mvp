import { JOB_CATEGORIES, type JobCategoryId } from "./job-categories";
import { STRENGTHS, type RecruitmentProfile } from "./recruitment-profile";

/** Choices and list rules for the profile steps, reusable by a future mobile client. Limits mirror validateRecruitmentProfile. */
export const MAX_ROLES = 8;
export const MAX_LOCATIONS = 8;
export const MAX_LIST_ITEM_LENGTH = 80;
export const MAX_MOTIVATION_LENGTH = 1000;
export const MAX_TRAVEL_MINUTES = 180;
export const MAX_LICENCES = 8;
export const MAX_TOOLS = 12;
export const MAX_LANGUAGES = 8;
export const MAX_EXAMPLES = 5;
export const MAX_STRENGTH_LENGTH = 30;
export const MAX_EXAMPLE_CONTEXT_LENGTH = 200;
export const MAX_EXAMPLE_ACTION_LENGTH = 1000;

/** Short chip text per category. The full category label is what gets saved in roles. */
export const JOB_CATEGORY_SHORT_LABELS: Record<JobCategoryId, string> = {
  cafe: "Café", restaurant: "Restaurang och kök", retail: "Butik", childcare: "Barnomsorg", sports: "Idrott och träning",
  events: "Event", warehouse: "Lager", delivery: "Leverans och bud", "customer-service": "Kundtjänst", administration: "Administration",
  finance: "Ekonomi", supervision: "Läxhjälp", "social-media": "Sociala medier", cleaning: "Städ", gardening: "Trädgård",
};

/** Shown before "Visa alla 15" on desktop; the rest keep their place in the list once expanded. */
export const PRIMARY_JOB_CATEGORY_IDS: readonly JobCategoryId[] = ["cafe", "restaurant", "retail", "childcare", "sports", "events", "warehouse", "delivery", "customer-service", "social-media"];

/** "60" is shown as "60+ min". Any other saved value is kept and shown as "Annat". */
export const TRAVEL_OPTIONS = [
  { value: "15", label: "15 min" }, { value: "30", label: "30 min" }, { value: "45", label: "45 min" }, { value: "60", label: "60+ min" },
] as const;

export const LEARNING_SUGGESTIONS = ["Kundservice", "Ta mer ansvar", "Jobba i team", "Egen lön"] as const;

/** Suggestions from the design files; the content is still to be confirmed (SPEC, open decision 2). */
export const LICENCE_SUGGESTIONS = ["B-körkort", "AM-körkort", "HLR-utbildning", "Truckkort"] as const;
export const TOOL_SUGGESTIONS = ["Kassasystem", "Canva", "Excel", "Word", "Google Docs", "Instagram"] as const;

const key = (value: string) => value.trim().toLocaleLowerCase("sv-SE");

/** A role belongs to a category chip only when it is that category's label or short label; other wording stays the person's own. */
export function categoryForRole(role: string): JobCategoryId | null {
  const value = key(role);
  return JOB_CATEGORIES.find(category => key(category.label) === value || key(JOB_CATEGORY_SHORT_LABELS[category.id]) === value)?.id ?? null;
}

export function roleChoices(roles: readonly string[]) {
  const selected = new Set(roles.map(categoryForRole));
  return {
    categories: JOB_CATEGORIES.map(category => ({ id: category.id, label: category.label, shortLabel: JOB_CATEGORY_SHORT_LABELS[category.id], selected: selected.has(category.id) })),
    custom: roles.filter(role => !categoryForRole(role)),
  };
}

export function toggleCategoryRole(roles: readonly string[], id: JobCategoryId): string[] {
  if (roles.some(role => categoryForRole(role) === id)) return roles.filter(role => categoryForRole(role) !== id);
  if (roles.length >= MAX_ROLES) return [...roles];
  return [...roles, JOB_CATEGORIES.find(category => category.id === id)!.label];
}

/** Adds comma-separated entries without duplicates, up to the limit. */
export function addListItems(list: readonly string[], text: string, max: number): string[] {
  const next = [...list];
  for (const raw of text.split(",")) {
    const item = raw.trim().slice(0, MAX_LIST_ITEM_LENGTH);
    if (!item || next.length >= max || next.some(existing => key(existing) === key(item))) continue;
    next.push(item);
  }
  return next;
}

/** Own job wording; text that names a category selects that category instead of a duplicate chip. */
export function addRoles(roles: readonly string[], text: string): string[] {
  const named = text.split(",").map(item => { const id = categoryForRole(item); return id ? JOB_CATEGORIES.find(category => category.id === id)!.label : item; });
  return addListItems(roles, named.join(","), MAX_ROLES);
}

export function removeListItem(list: readonly string[], item: string): string[] {
  return list.filter(existing => existing !== item);
}

export function isStandardTravel(value: string): boolean {
  return TRAVEL_OPTIONS.some(option => option.value === value);
}

/** Appends a suggestion to the free text unless it is already there or would exceed the limit. */
export function appendSuggestion(text: string, suggestion: string, max = MAX_MOTIVATION_LENGTH): string {
  const current = text.trim();
  if (key(current).includes(key(suggestion))) return text;
  const newSentence = /[.!?]$/.test(current);
  const next = !current ? suggestion : newSentence ? `${current} ${suggestion}` : `${current}, ${suggestion.charAt(0).toLocaleLowerCase("sv-SE")}${suggestion.slice(1)}`;
  return next.length > max ? text : next;
}

type Example = RecruitmentProfile["examples"][number];
export const emptyExample = (): Example => ({ strength: "", context: "", action: "" });
export const isBlankExample = (example: Example) => !example.strength.trim() && !example.context.trim() && !example.action.trim();

/** A strength is saved as its STRENGTHS key; own wording that matches a label becomes that key. */
export function strengthKey(text: string): string {
  const value = text.trim().slice(0, MAX_STRENGTH_LENGTH);
  return Object.entries(STRENGTHS).find(([, label]) => key(label) === key(value))?.[0] ?? value;
}
export function strengthLabel(strength: string): string {
  return STRENGTHS[strength as keyof typeof STRENGTHS] ?? strength;
}

/** Blank example cards are dropped; a started one must be complete before the unchanged validation sees it. */
export function examplesToSave(examples: readonly Example[]): { examples: Example[]; error: string | null } {
  const filled = examples.filter(example => !isBlankExample(example));
  if (filled.some(example => !example.strength.trim())) return { examples: filled, error: "Välj vad exemplet visar." };
  if (filled.some(example => !example.context.trim() || !example.action.trim())) return { examples: filled, error: "Ange både situation och vad du gjorde i exemplet." };
  return { examples: filled, error: null };
}
