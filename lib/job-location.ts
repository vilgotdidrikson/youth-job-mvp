export interface Coordinates {
  longitude: number;
  latitude: number;
}

interface LocationInput {
  address?: string | null;
  postalCode?: string | null;
  city?: string | null;
}

const SWEDISH_CITY_COORDINATES: Record<string, Coordinates> = {
  stockholm: { longitude: 18.0686, latitude: 59.3293 },
  göteborg: { longitude: 11.9746, latitude: 57.7089 },
  malmö: { longitude: 13.0038, latitude: 55.605 },
  uppsala: { longitude: 17.6389, latitude: 59.8586 },
  västerås: { longitude: 16.5456, latitude: 59.6099 },
  örebro: { longitude: 15.2134, latitude: 59.2753 },
  linköping: { longitude: 15.6216, latitude: 58.4108 },
  helsingborg: { longitude: 12.6945, latitude: 56.0465 },
  jönköping: { longitude: 14.1618, latitude: 57.7826 },
  norrköping: { longitude: 16.1826, latitude: 58.5877 },
  lund: { longitude: 13.191, latitude: 55.7047 },
  umeå: { longitude: 20.263, latitude: 63.8258 },
};

function fallbackCityCoordinates(city?: string | null): Coordinates | null {
  const cityKey = city?.trim().toLocaleLowerCase("sv-SE");
  return cityKey ? SWEDISH_CITY_COORDINATES[cityKey] ?? null : null;
}

/**
 * Resolves a job's public workplace location. If the Mapbox token is not set
 * (or the search fails), familiar Swedish cities still get a city-level pin.
 */
export async function geocodeJobLocation(input: LocationInput): Promise<Coordinates | null> {
  const fallback = fallbackCityCoordinates(input.city);
  const token = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;
  const query = [input.address, input.postalCode, input.city, "Sweden"].filter(Boolean).join(", ");

  if (!token || !query) return fallback;

  try {
    const response = await fetch(
      `https://api.mapbox.com/search/geocode/v6/forward?q=${encodeURIComponent(query)}&access_token=${encodeURIComponent(token)}&limit=1`,
    );
    if (!response.ok) return fallback;

    const payload = (await response.json()) as { features?: Array<{ geometry?: { coordinates?: unknown } }> };
    const coordinates = payload.features?.[0]?.geometry?.coordinates;
    if (
      Array.isArray(coordinates) &&
      typeof coordinates[0] === "number" &&
      typeof coordinates[1] === "number"
    ) {
      return { longitude: coordinates[0], latitude: coordinates[1] };
    }
  } catch {
    // A location should never prevent a company from publishing its job.
  }

  return fallback;
}

export function getCityCoordinates(city?: string | null): Coordinates | null {
  return fallbackCityCoordinates(city);
}
