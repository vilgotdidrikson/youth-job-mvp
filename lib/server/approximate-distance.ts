import * as table from "./postal-places-se.json";

/**
 * Town-level distance from an open postal code table (GeoNames, CC BY 4.0).
 * The postal code never leaves the server and no exact address is used.
 * Unknown input gives null: a distance is never guessed.
 */
type Point = [number, number];
const places = table.places as Point[], ranges = table.ranges as [number, number, number][], names = table.names as Record<string, number>;

export function postalPlace(postalCode: unknown): Point | null {
  if (typeof postalCode !== "string" || !/^\s*\d{3}\s?\d{2}\s*$/.test(postalCode)) return null;
  const code = Number(postalCode.replace(/\s/g, ""));
  let low = 0, high = ranges.length - 1;
  while (low <= high) {
    const middle = (low + high) >> 1, [from, to, place] = ranges[middle];
    if (code < from) high = middle - 1; else if (code > to) low = middle + 1; else return places[place];
  }
  return null;
}
export function cityPlace(city: unknown): Point | null {
  if (typeof city !== "string") return null;
  const key = city.trim().toLocaleLowerCase("sv-SE");
  return key && Object.prototype.hasOwnProperty.call(names, key) ? places[names[key]] : null;
}
function kilometres(a: Point, b: Point): number {
  const rad = Math.PI / 180, dLat = (b[0] - a[0]) * rad, dLng = (b[1] - a[1]) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a[0] * rad) * Math.cos(b[0] * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}
/** Wide bands, because both ends are town centres rather than addresses. */
export function distanceBand(km: number): string {
  return km < 10 ? "samma ort eller närområde, under cirka 10 km" : km < 25 ? "cirka 10–25 km" : km < 50 ? "cirka 25–50 km" : km < 100 ? "cirka 50–100 km" : "över 100 km";
}
/** One neutral fact for matching. It says nothing about suitability or the residential area. */
export function estimatedDistanceLine(postalCode: unknown, workplaceCities: unknown): string | null {
  const home = postalPlace(postalCode);
  const work = (Array.isArray(workplaceCities) ? workplaceCities : []).map(cityPlace).filter((point): point is Point => point !== null);
  if (!home || !work.length) return null;
  return `Uppskattat avstånd mellan egen postort och närmaste arbetsort: ${distanceBand(Math.min(...work.map(point => kilometres(home, point))))} (beräknat från postnummer, inte från adress)`;
}
/** Reads the two inputs from the internal matching input returned by the database. */
export function matchingDistanceLine(input: Record<string, unknown> | null | undefined): string | null {
  const job = input?.job_context;
  return estimatedDistanceLine(input?.postal_code, job && typeof job === "object" && !Array.isArray(job) ? (job as Record<string, unknown>).workplace_cities : null);
}
