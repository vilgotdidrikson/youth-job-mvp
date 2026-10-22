import { effectiveJobCategories, jobMatchesCategory, preferredJobCategories, roleCategoryIds } from "./job-categories";
import { jobMatchesCity } from "./job-workplaces";
import { readRecruitmentProfile } from "./recruitment-profile";
import type { JobPost, YouthProfile } from "./types";

export interface DiscoveryFilters { query?: string; city?: string; category?: string; employmentType?: string; }
const normalize = (value: string) => value.trim().toLocaleLowerCase("sv");
const strings = (value: unknown): string[] => Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : [];
export function matchesDiscoveryFilters(job: JobPost, filters: DiscoveryFilters): boolean {
  const needle = normalize(filters.query ?? "");
  return (!needle || (roleCategoryIds(needle).length ? jobMatchesCategory(job, needle) : normalize([job.title, job.description, job.company_name, job.category].join(" ")).includes(needle)))
    && (!filters.city || jobMatchesCity(job, filters.city))
    && (!filters.category || jobMatchesCategory(job, filters.category))
    && (!filters.employmentType || job.employment_type.split(",").some(value => normalize(value) === normalize(filters.employmentType!)));
}
export function prepareDiscoveryJob(job: JobPost, profile: YouthProfile | null, seen: boolean): JobPost {
  const recruitment = readRecruitmentProfile(profile?.recruitment_profile);
  const roles = [...strings(profile?.desired_roles), ...recruitment.preferences.roles];
  const wanted = new Set([...(recruitment.preferences.categoryIds ?? []), ...preferredJobCategories(roles)]);
  const reasons: string[] = [];
  let score = 0;
  if (effectiveJobCategories(job).some(id => wanted.has(id))) { score += 3; reasons.push("Tillhör en typ av jobb du vill söka"); }
  if ([profile?.city ?? "", ...recruitment.preferences.locations].filter(Boolean).some(city => jobMatchesCity(job, city))) { score += 2; reasons.push("Har en arbetsplats på en ort du angett"); }
  const employment = strings(profile?.employment_preferences).map(normalize);
  if (job.employment_type.split(",").some(value => employment.includes(normalize(value)))) { score++; reasons.push("Anställningsformen finns bland dina önskemål"); }
  const requirements = (job.requirements ?? "").split(/[\n.;]/).map(normalize);
  const a = recruitment.availability;
  if ((requirements.includes("kan arbeta helger") && ["sat", "sun"].every(day => a.days.map(normalize).includes(day)))
    || (requirements.includes("kan arbeta kvällar") && a.periods.map(normalize).includes("evening"))) {
    score++; reasons.push("En angiven arbetstid stämmer med din tillgänglighet");
  }
  return { ...job, discovery: { seen, score, reasons } };
}
function compare(a: JobPost, b: JobPost): number {
  return (b.discovery?.score ?? 0) - (a.discovery?.score ?? 0)
    || (Date.parse(b.first_published_at || b.created_at) || 0) - (Date.parse(a.first_published_at || a.created_at) || 0)
    || a.id.localeCompare(b.id);
}
export function orderDiscoveryJobs(jobs: JobPost[], filters: DiscoveryFilters = {}, requestedId?: string | null): JobPost[] {
  const eligible = [...new Map(jobs.filter(job => matchesDiscoveryFilters(job, filters)).map(job => [job.id, job])).values()];
  const result: JobPost[] = [];
  for (const seen of [false, true]) {
    const queues = new Map<string, JobPost[]>();
    for (const job of eligible.filter(job => Boolean(job.discovery?.seen) === seen).sort(compare)) {
      const key = job.company_user_id || job.id;
      queues.set(key, [...(queues.get(key) ?? []), job]);
    }
    while (queues.size) {
      const round = [...queues.values()].map(queue => queue[0]).sort(compare);
      for (const job of round) {
        result.push(job);
        const key = job.company_user_id || job.id;
        const queue = queues.get(key)!; queue.shift();
        if (!queue.length) queues.delete(key);
      }
    }
  }
  const index = result.findIndex(job => job.id === requestedId);
  if (index > 0) result.unshift(...result.splice(index, 1));
  return result;
}
