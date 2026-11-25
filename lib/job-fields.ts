/**
 * Job builder field rules (F22) and reuse of facts already given (F10).
 * Framework-free so web and a future mobile app validate the same way.
 */
import type { JobBuilderDraft } from "./job-copy";

export const JOB_AGE_MIN = 13, JOB_AGE_MAX = 30;
type SalaryType = JobBuilderDraft["salaryType"];
type FieldForm = Pick<JobBuilderDraft, "minAge" | "maxAge" | "salaryFrom" | "salaryTo" | "salaryType">;
export type JobFieldName = "minAge" | "maxAge" | "salaryFrom" | "salaryTo";
export type JobFieldErrors = Partial<Record<JobFieldName, string>>;

/** Upper bounds that catch a monthly amount typed as hourly pay, not policy limits. */
const SALARY_LIMITS: Partial<Record<SalaryType, number>> = { "timlön": 1000, "månadslön": 200000 };

/** "25 000" and "25000" are the same amount; anything else is not a whole number of kronor. */
export function parseAmount(value: string): number | null {
  const compact = value.replace(/[\s ]/g, "");
  return /^\d{1,7}$/.test(compact) ? Number(compact) : null;
}

export function jobFieldErrors(form: FieldForm): JobFieldErrors {
  const errors: JobFieldErrors = {};
  const age = (key: "minAge" | "maxAge") => {
    if (!form[key].trim()) return null;
    const value = /^\d{1,2}$/.test(form[key].trim()) ? Number(form[key].trim()) : NaN;
    if (!(value >= JOB_AGE_MIN && value <= JOB_AGE_MAX)) { errors[key] = `Ange en ålder mellan ${JOB_AGE_MIN} och ${JOB_AGE_MAX} år.`; return null; }
    return value;
  };
  const minAge = age("minAge"), maxAge = age("maxAge");
  if (minAge !== null && maxAge !== null && maxAge < minAge) errors.maxAge = "Ålder till kan inte vara lägre än ålder från.";

  const limit = SALARY_LIMITS[form.salaryType];
  const salary = (key: "salaryFrom" | "salaryTo") => {
    if (!form[key].trim()) return null;
    const value = parseAmount(form[key]);
    if (value === null || value === 0) { errors[key] = "Skriv beloppet i hela kronor, till exempel 135."; return null; }
    if (limit && value > limit) { errors[key] = form.salaryType === "timlön" ? "Beloppet är ovanligt högt för timlön. Kontrollera beloppet eller välj en annan lönetyp." : "Beloppet är ovanligt högt för månadslön. Kontrollera beloppet."; return null; }
    return value;
  };
  const salaryFrom = salary("salaryFrom"), salaryTo = salary("salaryTo");
  if (salaryFrom !== null && salaryTo !== null && salaryTo < salaryFrom) errors.salaryTo = "Lön till kan inte vara lägre än lön från.";
  return errors;
}

export function firstJobFieldError(errors: JobFieldErrors): { field: JobFieldName; message: string } | null {
  const field = (["minAge", "maxAge", "salaryFrom", "salaryTo"] as const).find(key => errors[key]);
  return field ? { field, message: errors[field] as string } : null;
}

/** Which builder step shows a field, so a blocked save can send the person there. */
export function jobFieldStep(field: JobFieldName): 1 | 3 {
  return field === "minAge" || field === "maxAge" ? 1 : 3;
}

const UNITS: [RegExp, SalaryType][] = [[/^(tim|timme|h)$/, "timlön"], [/^(mån|månad|månaden)$/, "månadslön"], [/^period$/, "fast lön"]];
const AMOUNT = "(\\d{1,3}(?:[\\s\\u00a0]\\d{3})+|\\d{1,7})";

/**
 * Reads a saved salary text only when it explicitly states amount and unit,
 * e.g. "120–145 kr/tim", "Från 130 kr/h" or "25 000 kr/mån". Anything vaguer
 * returns null and the text stays as written.
 */
export function parseSalaryText(text: string): Pick<JobBuilderDraft, "salaryFrom" | "salaryTo" | "salaryType"> | null {
  const value = text.trim().toLocaleLowerCase("sv-SE").replace(/\s+/g, " ").replace(/\s*[–—-]\s*/g, "–").replace(/\s*\/\s*/g, "/");
  const match = new RegExp(`^(?:(från|upp till) )?${AMOUNT}(?:–${AMOUNT})? ?kr(?:/| per | i )([a-zå]+)$`).exec(value);
  if (!match) return null;
  const [, prefix, first, second, unitText] = match;
  const salaryType = UNITS.find(([pattern]) => pattern.test(unitText))?.[1];
  if (!salaryType || (prefix && second)) return null;
  const amount = (raw: string) => String(parseAmount(raw));
  const parsed = prefix === "upp till" ? { salaryFrom: "", salaryTo: amount(first), salaryType }
    : prefix === "från" ? { salaryFrom: amount(first), salaryTo: "", salaryType }
    : { salaryFrom: amount(first), salaryTo: amount(second ?? first), salaryType };
  return Object.keys(jobFieldErrors({ minAge: "", maxAge: "", ...parsed })).length ? null : parsed;
}

/**
 * A new listing starts in the company's city. Never overwrites a city, an
 * edited or copied listing, or workplaces the company already added.
 */
export function prefillCompanyCity<T extends Pick<JobBuilderDraft, "city" | "workplaces" | "copiedFromTitle">>(form: T, companyCity: string | null | undefined, editing: boolean): T {
  const city = companyCity?.trim();
  if (!city || editing || form.copiedFromTitle || form.city.trim() || form.workplaces.length) return form;
  return { ...form, city };
}
