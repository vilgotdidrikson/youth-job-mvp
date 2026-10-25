import { getCityCoordinates, type Coordinates } from "./job-location";
import { getJobWorkplaces } from "./job-workplaces";
import { readPracticalDetails, WORK_TIMES } from "./job-practical";
import type { JobPost } from "./types";

export interface JobSearchFilters {
  query?: string; city?: string; category?: string; employmentType?: string;
  workTime?: string; nearbyCity?: string; radiusKm?: string; onlyKnown?: string;
}
export const SEARCH_FILTER_KEYS = ["query", "city", "category", "employmentType", "workTime", "nearbyCity", "radiusKm", "onlyKnown"] as const;
export type SearchFilterValues = Record<typeof SEARCH_FILTER_KEYS[number], string>;
export const DISTANCE_CHOICES = ["5", "10", "25", "50"] as const;
export const normalizeSearchText = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("sv-SE").trim();
const coordinatesValid = (value: Coordinates): boolean => Number.isFinite(value.latitude) && Number.isFinite(value.longitude) && Math.abs(value.latitude) <= 90 && Math.abs(value.longitude) <= 180;

export function distanceKm(a: Coordinates, b: Coordinates): number {
  const rad = Math.PI / 180;
  const lat = Math.sin((b.latitude - a.latitude) * rad / 2);
  const lon = Math.sin((b.longitude - a.longitude) * rad / 2);
  const h = lat * lat + Math.cos(a.latitude * rad) * Math.cos(b.latitude * rad) * lon * lon;
  return 6371 * 2 * Math.asin(Math.sqrt(Math.min(1, Math.max(0, h))));
}

/** Minimum known straight-line distance across workplaces; no guessed home/route. */
export function jobDistance(job: JobPost, city: string): { km: number | null; hasUnknown: boolean } {
  const origin = getCityCoordinates(city);
  if (!origin) return { km: null, hasUnknown: true };
  const distances: number[] = []; let hasUnknown = false;
  for (const place of getJobWorkplaces(job)) {
    if (typeof place.latitude !== "number" || typeof place.longitude !== "number" || !coordinatesValid({ latitude: place.latitude, longitude: place.longitude })) { hasUnknown = true; continue; }
    distances.push(distanceKm(origin, { latitude: place.latitude, longitude: place.longitude }));
  }
  return { km: distances.length ? Math.min(...distances) : null, hasUnknown };
}

export function matchesPracticalSearch(job: JobPost, filters: JobSearchFilters): boolean {
  const times = readPracticalDetails(job.practical_details).times;
  const includeUnknown = filters.onlyKnown !== "yes";
  if (filters.workTime && Object.prototype.hasOwnProperty.call(WORK_TIMES, filters.workTime)) {
    if (times?.length ? !times.includes(filters.workTime as keyof typeof WORK_TIMES) : !includeUnknown) return false;
  }
  if (filters.nearbyCity && DISTANCE_CHOICES.some(value => value === filters.radiusKm) && getCityCoordinates(filters.nearbyCity)) {
    const distance = jobDistance(job, filters.nearbyCity);
    if (!(distance.km !== null && distance.km <= Number(filters.radiusKm)) && !(includeUnknown && distance.hasUnknown)) return false;
  }
  return true;
}

export function searchDetailLabels(job: JobPost, filters: JobSearchFilters): string[] {
  const labels: string[] = [];
  if (filters.workTime) {
    const times = readPracticalDetails(job.practical_details).times;
    labels.push(times?.length ? times.map(time => WORK_TIMES[time]).join(", ") : "Arbetstid ej angiven");
  }
  if (filters.nearbyCity && filters.radiusKm) {
    const { km, hasUnknown } = jobDistance(job, filters.nearbyCity);
    labels.push(km === null ? "Avstånd okänt" : `Ca ${Math.round(km)} km från ${filters.nearbyCity} centrum${hasUnknown ? " · plats saknas för någon arbetsplats" : ""}`);
  }
  return labels;
}

export function readSearchFilters(params: { get: (key: string) => string | null }): SearchFilterValues {
  const filters = Object.fromEntries(SEARCH_FILTER_KEYS.map(key => [key, (params.get(key) ?? "").slice(0, 200)])) as SearchFilterValues;
  if (!(Object.prototype.hasOwnProperty.call(WORK_TIMES, filters.workTime))) filters.workTime = "";
  if (!getCityCoordinates(filters.nearbyCity) || !DISTANCE_CHOICES.some(value => value === filters.radiusKm)) { filters.nearbyCity = ""; filters.radiusKm = ""; }
  if (filters.onlyKnown !== "yes") filters.onlyKnown = "";
  return filters;
}
export function searchHref(path: "/swipe" | "/kartan", filters: JobSearchFilters): string {
  const params = new URLSearchParams();
  for (const key of SEARCH_FILTER_KEYS) if (filters[key]) params.set(key, filters[key]!);
  return params.size ? `${path}?${params}` : path;
}
