/**
 * Job ad benefits (F25). Equivalent benefits, such as "Lunch under arbetspasset" and
 * "Måltid ingår", count as one so an ad lists each benefit once. Pure functions with no
 * framework dependencies, so the web builder, the ad view and a future app share them.
 */

/** Ready-made choices in the ad builder. */
export const BENEFIT_TIPS = ["Flexibla tider", "Introduktion", "Personalrabatt", "Friskvårdsbidrag", "Måltid ingår"] as const;

/** At most this many benefits come from an AI suggestion; the employer's own choices are always kept. */
export const MAX_SUGGESTED_BENEFITS = 6;

// Each group names one benefit. A benefit matches when one of its words starts with a stem.
const GROUPS: { key: string; stems: string[] }[] = [
  { key: "meal", stems: ["måltid", "lunch", "middag", "frukost", "mat", "personalmat", "personalmåltid"] },
  { key: "flexible", stems: ["flexib", "flextid"] },
  { key: "introduction", stems: ["introduktion", "upplärning", "inskolning", "onboarding"] },
  { key: "discount", stems: ["personalrabatt", "rabatt"] },
  { key: "wellness", stems: ["friskvård"] },
];

const words = (value: string) => value.toLocaleLowerCase("sv-SE").split(/[^\p{L}\p{N}]+/u).filter(Boolean);

/** The same key means the same benefit. Unknown benefits compare by their normalised text. */
export function benefitKey(benefit: string): string {
  const parts = words(benefit);
  // "mat" must be a whole word ("matlagning" is not a meal); other stems may continue ("flexibla").
  const group = GROUPS.find(({ stems }) => parts.some(part => stems.some(stem => stem === "mat" ? part === "mat" || part === "maten" : part.startsWith(stem))));
  return group ? `group:${group.key}` : parts.join(" ");
}

/** Splits a stored comma or line separated list. */
export function benefitItems(value: string | null | undefined): string[] {
  return (value ?? "").split(/[,\n]+/).map(item => item.trim()).filter(Boolean);
}

/** Keeps the first wording of each benefit and drops later equivalents and empty items. */
export function mergeBenefits(items: readonly string[]): string[] {
  const seen = new Set<string>();
  const merged: string[] = [];
  for (const raw of items) {
    const item = raw.trim();
    const key = item && benefitKey(item);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    merged.push(item);
  }
  return merged;
}

/** The employer's list first, then AI suggestions that add something new, up to MAX_SUGGESTED_BENEFITS in total. */
export function mergeSuggestedBenefits(current: string, suggested: readonly string[] = []): string {
  const own = mergeBenefits(benefitItems(current));
  const extra = mergeBenefits([...own, ...suggested]).slice(own.length);
  return [...own, ...extra.slice(0, Math.max(0, MAX_SUGGESTED_BENEFITS - own.length))].join(", ");
}

export function hasBenefit(value: string, benefit: string): boolean {
  const key = benefitKey(benefit);
  return benefitItems(value).some(item => benefitKey(item) === key);
}

/** Removes the benefit and every equivalent, or adds it when none is there. */
export function toggleBenefit(value: string, benefit: string): string {
  return hasBenefit(value, benefit) ? removeBenefit(value, benefit) : addBenefit(value, benefit);
}

/** Adds a benefit unless an equivalent is already listed. */
export function addBenefit(value: string, benefit: string): string {
  return mergeBenefits([...benefitItems(value), benefit]).join(", ");
}

export function removeBenefit(value: string, benefit: string): string {
  const key = benefitKey(benefit);
  return benefitItems(value).filter(item => benefitKey(item) !== key).join(", ");
}

/** Listed benefits that are not one of the ready-made choices, so the builder can show and remove them. */
export function customBenefits(value: string): string[] {
  const tipKeys = new Set(BENEFIT_TIPS.map(benefitKey));
  return mergeBenefits(benefitItems(value)).filter(item => !tipKeys.has(benefitKey(item)));
}

/** The wording the list uses for a benefit (the employer may have written an equivalent), or null. */
export function listedBenefit(value: string, benefit: string): string | null {
  const key = benefitKey(benefit);
  return benefitItems(value).find(item => benefitKey(item) === key) ?? null;
}
