/**
 * Structured practical job details (N05): start, hours, working times, period and last application day.
 * Framework-free so the web builder, the listing and a future mobile app share the same rules.
 * Every part is optional; leaving it empty means "Ej bestämt" and nothing is shown to youth.
 */

export const START_MODES = { asap: "Så snart som möjligt", date: "Välj datum", flexible: "Flexibel start" } as const;
export const PERIOD_MODES = { ongoing: "Tills vidare", until: "Tidsbegränsad" } as const;
export const WORK_TIMES = { weekday: "Vardagar dagtid", evening: "Kvällar", weekend: "Helger" } as const;
export const MAX_WEEKLY_HOURS = 60;

export type StartMode = keyof typeof START_MODES;
export type PeriodMode = keyof typeof PERIOD_MODES;
export type WorkTime = keyof typeof WORK_TIMES;

/** What is saved in jobs.practical_details. Empty parts are left out. */
export interface JobPracticalDetails {
  start?: { mode: StartMode; date?: string };
  hours?: { min?: number; max?: number };
  times?: WorkTime[];
  period?: { mode: PeriodMode; endDate?: string };
  deadline?: string;
}

/** The builder's text form of the same details. */
export interface JobPracticalForm {
  startMode: StartMode | ""; startDate: string;
  hoursMin: string; hoursMax: string;
  times: WorkTime[];
  periodMode: PeriodMode | ""; periodEnd: string;
  deadline: string;
}
export const EMPTY_PRACTICAL_FORM: JobPracticalForm = { startMode: "", startDate: "", hoursMin: "", hoursMax: "", times: [], periodMode: "", periodEnd: "", deadline: "" };

export type PracticalField = "startDate" | "hoursMin" | "hoursMax" | "periodEnd" | "deadline";
export type PracticalErrors = Partial<Record<PracticalField, string>>;

const isKey = <T extends object>(map: T, value: unknown): value is keyof T => typeof value === "string" && Object.prototype.hasOwnProperty.call(map, value);

/** A real calendar date written as YYYY-MM-DD. */
export function isIsoDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}
const hours = (value: unknown) => typeof value === "number" && Number.isInteger(value) && value >= 1 && value <= MAX_WEEKLY_HOURS ? value : undefined;

/** Tolerant read of a saved value: anything unknown or malformed is dropped, never shown. */
export function readPracticalDetails(raw: unknown): JobPracticalDetails {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const data = raw as Record<string, unknown>, result: JobPracticalDetails = {};
  const start = data.start as Record<string, unknown> | undefined;
  if (start && isKey(START_MODES, start.mode) && (start.mode !== "date" || isIsoDate(start.date))) result.start = start.mode === "date" ? { mode: "date", date: start.date as string } : { mode: start.mode };
  const span = data.hours as Record<string, unknown> | undefined;
  const min = hours(span?.min), max = hours(span?.max);
  if (min !== undefined || max !== undefined) result.hours = { ...(min !== undefined ? { min } : {}), ...(max !== undefined ? { max } : {}) };
  if (Array.isArray(data.times)) { const times = (Object.keys(WORK_TIMES) as WorkTime[]).filter(key => (data.times as unknown[]).includes(key)); if (times.length) result.times = times; }
  const period = data.period as Record<string, unknown> | undefined;
  if (period && isKey(PERIOD_MODES, period.mode) && (period.mode !== "until" || isIsoDate(period.endDate))) result.period = period.mode === "until" ? { mode: "until", endDate: period.endDate as string } : { mode: period.mode };
  if (isIsoDate(data.deadline)) result.deadline = data.deadline;
  return result;
}

export function practicalForm(details: JobPracticalDetails): JobPracticalForm {
  return {
    startMode: details.start?.mode ?? "", startDate: details.start?.date ?? "",
    hoursMin: details.hours?.min ? String(details.hours.min) : "", hoursMax: details.hours?.max ? String(details.hours.max) : "",
    times: [...(details.times ?? [])],
    periodMode: details.period?.mode ?? "", periodEnd: details.period?.endDate ?? "",
    deadline: details.deadline ?? "",
  };
}

/** A builder draft saved in the browser may be half filled; keep what is well-formed text, drop the rest. */
export function restorePracticalForm(raw: unknown): JobPracticalForm {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return { ...EMPTY_PRACTICAL_FORM, times: [] };
  const data = raw as Record<string, unknown>;
  const str = (key: keyof JobPracticalForm) => typeof data[key] === "string" ? (data[key] as string).slice(0, 10) : "";
  return {
    startMode: isKey(START_MODES, data.startMode) ? data.startMode : "", startDate: str("startDate"),
    hoursMin: str("hoursMin"), hoursMax: str("hoursMax"),
    times: Array.isArray(data.times) ? (Object.keys(WORK_TIMES) as WorkTime[]).filter(key => (data.times as unknown[]).includes(key)) : [],
    periodMode: isKey(PERIOD_MODES, data.periodMode) ? data.periodMode : "", periodEnd: str("periodEnd"),
    deadline: str("deadline"),
  };
}

const wholeHours = (value: string) => /^\d{1,2}$/.test(value.trim()) ? Number(value.trim()) : NaN;

/** `today` (YYYY-MM-DD) is only used to stop a new last application day in the past. */
export function practicalErrors(form: JobPracticalForm, today?: string): PracticalErrors {
  const errors: PracticalErrors = {};
  if (form.startMode === "date" && !isIsoDate(form.startDate)) errors.startDate = "Välj ett startdatum eller ett annat startalternativ.";
  const min = form.hoursMin.trim() ? wholeHours(form.hoursMin) : null, max = form.hoursMax.trim() ? wholeHours(form.hoursMax) : null;
  if (min !== null && !(min >= 1 && min <= MAX_WEEKLY_HOURS)) errors.hoursMin = `Ange timmar per vecka mellan 1 och ${MAX_WEEKLY_HOURS}.`;
  if (max !== null && !(max >= 1 && max <= MAX_WEEKLY_HOURS)) errors.hoursMax = `Ange timmar per vecka mellan 1 och ${MAX_WEEKLY_HOURS}.`;
  else if (min !== null && max !== null && !errors.hoursMin && max < min) errors.hoursMax = "Timmar till kan inte vara färre än timmar från.";
  if (form.periodMode === "until") {
    if (!isIsoDate(form.periodEnd)) errors.periodEnd = "Välj sista dag för anställningen eller ett annat alternativ.";
    else if (form.startMode === "date" && isIsoDate(form.startDate) && form.periodEnd < form.startDate) errors.periodEnd = "Anställningen kan inte sluta före startdatumet.";
  }
  if (form.deadline) {
    if (!isIsoDate(form.deadline)) errors.deadline = "Välj ett giltigt datum.";
    else if (today && form.deadline < today) errors.deadline = "Sista ansökningsdag kan inte ha passerat.";
  }
  return errors;
}

export function firstPracticalError(errors: PracticalErrors): { field: PracticalField; message: string } | null {
  const field = (["startDate", "hoursMin", "hoursMax", "periodEnd", "deadline"] as const).find(key => errors[key]);
  return field ? { field, message: errors[field] as string } : null;
}

/** The value saved in jobs.practical_details; run practicalErrors first. */
export function practicalPayload(form: JobPracticalForm): JobPracticalDetails {
  return readPracticalDetails({
    start: form.startMode ? { mode: form.startMode, ...(form.startMode === "date" ? { date: form.startDate } : {}) } : undefined,
    hours: { min: form.hoursMin.trim() ? wholeHours(form.hoursMin) : undefined, max: form.hoursMax.trim() ? wholeHours(form.hoursMax) : undefined },
    times: form.times,
    period: form.periodMode ? { mode: form.periodMode, ...(form.periodMode === "until" ? { endDate: form.periodEnd } : {}) } : undefined,
    deadline: form.deadline || undefined,
  });
}

export function formatSwedishDate(iso: string): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString("sv-SE", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
}

/** Labelled facts for the listing, in a fixed order. Parts that are not set are left out. */
export function practicalFacts(details: JobPracticalDetails, today?: string): { label: string; value: string }[] {
  const facts: { label: string; value: string }[] = [];
  if (details.start) facts.push({ label: "Start", value: details.start.mode === "date" && details.start.date ? `Från ${formatSwedishDate(details.start.date)}` : START_MODES[details.start.mode] });
  const { min, max } = details.hours ?? {};
  const span = min && max ? (min === max ? `${min}` : `${min}–${max}`) : min ? `Minst ${min}` : max ? `Upp till ${max}` : "";
  const parts = [span && `${span} tim/vecka`, details.times?.map(time => WORK_TIMES[time]).join(", ")].filter(Boolean);
  if (parts.length) facts.push({ label: "Omfattning", value: parts.join(" · ") });
  if (details.period) facts.push({ label: "Anställningsperiod", value: details.period.mode === "until" && details.period.endDate ? `Tidsbegränsad till ${formatSwedishDate(details.period.endDate)}` : PERIOD_MODES[details.period.mode] });
  if (details.deadline) facts.push({ label: "Sista ansökningsdag", value: today && details.deadline < today ? `${formatSwedishDate(details.deadline)} (har passerat)` : formatSwedishDate(details.deadline) });
  return facts;
}

/** Local date as YYYY-MM-DD, for comparing with saved dates. */
export function localIsoDate(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
