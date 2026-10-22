import type { JobPost } from "./types";

export interface JobWorkplace {
  id: string;
  name: string;
  address: string;
  postal_code: string;
  city: string;
  longitude: number | null;
  latitude: number | null;
}
export const MAX_JOB_WORKPLACES = 10;
export function newJobWorkplace(): JobWorkplace {
  return { id: crypto.randomUUID(), name: "", address: "", postal_code: "", city: "", longitude: null, latitude: null };
}
export function validateJobWorkplaces(value: unknown): JobWorkplace[] {
  if (!Array.isArray(value) || !value.length || value.length > MAX_JOB_WORKPLACES) throw new Error("Ange 1–10 arbetsplatser.");
  const ids = new Set<string>();
  return value.map((item) => {
    if (!item || typeof item !== "object") throw new Error("Kontrollera arbetsplatsens uppgifter.");
    const row = item as Record<string, unknown>;
    const text = (key: string, max: number) => {
      const v = typeof row[key] === "string" ? (row[key] as string).trim() : "";
      if (v.length > max) throw new Error("Arbetsplatsens text är för lång.");
      return v;
    };
    const id = text("id", 36).toLowerCase(), name = text("name", 100), address = text("address", 250), postal_code = text("postal_code", 20), city = text("city", 100);
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id) || ids.has(id)) throw new Error("Arbetsplatser behöver unika identifierare.");
    ids.add(id);
    if (!name || !address || !postal_code || !city) throw new Error("Fyll i namn, adress, postnummer och ort för varje arbetsplats.");
    const longitude = row.longitude ?? null, latitude = row.latitude ?? null;
    if ((longitude !== null || latitude !== null) && !(typeof longitude === "number" && Number.isFinite(longitude) && Math.abs(longitude) <= 180 && typeof latitude === "number" && Number.isFinite(latitude) && Math.abs(latitude) <= 90)) throw new Error("Arbetsplatsens koordinater är ogiltiga.");
    return { id, name, address, postal_code, city, longitude: longitude as number | null, latitude: latitude as number | null };
  });
}
export function getJobWorkplaces(job: Pick<JobPost, "id" | "workplaces" | "address" | "postal_code" | "city" | "longitude" | "latitude">): JobWorkplace[] {
  if (Array.isArray(job.workplaces) && job.workplaces.length) return job.workplaces;
  return [{ id: job.id, name: "Arbetsplats", address: job.address ?? "", postal_code: job.postal_code ?? "", city: job.city, longitude: job.longitude ?? null, latitude: job.latitude ?? null }];
}
export function jobCities(job: Parameters<typeof getJobWorkplaces>[0]): string {
  return [...new Set(getJobWorkplaces(job).map(place => place.city).filter(Boolean))].join(" / ");
}
export function workplaceLabel(place: JobWorkplace): string {
  return [place.name, [place.address, place.postal_code, place.city].filter(Boolean).join(", ")].filter(Boolean).join(" – ");
}
export function jobMatchesCity(job: Parameters<typeof getJobWorkplaces>[0], city: string): boolean {
  return getJobWorkplaces(job).some(place => place.city.toLocaleLowerCase("sv-SE") === city.trim().toLocaleLowerCase("sv-SE"));
}
