import fetch from "node-fetch";

export interface MileageResult {
  distanceMiles: number;
  estimated: boolean; // true if this is a fallback/manual value, not from a real routing provider
  provider: string;
}

interface Provider {
  name: string;
  getDistanceMiles(fromAddress: string, toAddress: string): Promise<number>;
}

const METERS_PER_MILE = 1609.344;

// Address-pair -> result cache. The Day Plan re-fetches distances on every add/reorder,
// but the same stop addresses are usually queried repeatedly within a session, so caching
// avoids redundant geocode+directions calls (which is what was causing the UI lag).
const mileageCache = new Map<string, { result: MileageResult; expiresAt: number }>();
const CACHE_TTL_MS = 12 * 60 * 60 * 1000; // 12 hours - addresses rarely change mid-day

function cacheKey(fromAddress: string, toAddress: string): string {
  return `${fromAddress.trim().toLowerCase()}=>${toAddress.trim().toLowerCase()}`;
}

/** OpenRouteService (default provider). Requires geocoding + directions calls. */
class OpenRouteServiceProvider implements Provider {
  name = "openrouteservice";
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  private async geocode(address: string): Promise<[number, number]> {
    const url = `https://api.openrouteservice.org/geocode/search?api_key=${encodeURIComponent(
      this.apiKey
    )}&text=${encodeURIComponent(address)}&size=1`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`ORS geocode failed: ${res.status}`);
    const data: any = await res.json();
    const coords = data?.features?.[0]?.geometry?.coordinates;
    if (!coords) throw new Error(`ORS geocode returned no results for "${address}"`);
    return [coords[0], coords[1]];
  }

  async getDistanceMiles(fromAddress: string, toAddress: string): Promise<number> {
    const [fromCoord, toCoord] = await Promise.all([
      this.geocode(fromAddress),
      this.geocode(toAddress),
    ]);
    const url = "https://api.openrouteservice.org/v2/directions/driving-car";
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: this.apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ coordinates: [fromCoord, toCoord] }),
    });
    if (!res.ok) throw new Error(`ORS directions failed: ${res.status}`);
    const data: any = await res.json();
    const meters = data?.routes?.[0]?.summary?.distance;
    if (typeof meters !== "number") throw new Error("ORS directions returned no distance");
    return meters / METERS_PER_MILE;
  }
}

/** Google Maps Distance Matrix provider. */
class GoogleMapsProvider implements Provider {
  name = "google";
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async getDistanceMiles(fromAddress: string, toAddress: string): Promise<number> {
    const url = `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${encodeURIComponent(
      fromAddress
    )}&destinations=${encodeURIComponent(toAddress)}&units=imperial&key=${this.apiKey}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Google Distance Matrix failed: ${res.status}`);
    const data: any = await res.json();
    const meters = data?.rows?.[0]?.elements?.[0]?.distance?.value;
    if (typeof meters !== "number") throw new Error("Google Distance Matrix returned no distance");
    return meters / METERS_PER_MILE;
  }
}

/** MapQuest Directions provider. */
class MapQuestProvider implements Provider {
  name = "mapquest";
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async getDistanceMiles(fromAddress: string, toAddress: string): Promise<number> {
    const url = `https://www.mapquestapi.com/directions/v2/route?key=${this.apiKey}&from=${encodeURIComponent(
      fromAddress
    )}&to=${encodeURIComponent(toAddress)}&unit=m`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`MapQuest directions failed: ${res.status}`);
    const data: any = await res.json();
    const miles = data?.route?.distance;
    if (typeof miles !== "number") throw new Error("MapQuest returned no distance");
    return miles;
  }
}

function buildProvider(): Provider | null {
  const providerName = (process.env.MILEAGE_PROVIDER || "openrouteservice").toLowerCase();

  switch (providerName) {
    case "google": {
      const key = process.env.GOOGLE_MAPS_API_KEY;
      return key ? new GoogleMapsProvider(key) : null;
    }
    case "mapquest": {
      const key = process.env.MAPQUEST_API_KEY;
      return key ? new MapQuestProvider(key) : null;
    }
    case "openrouteservice":
    default: {
      const key = process.env.ORS_API_KEY;
      return key ? new OpenRouteServiceProvider(key) : null;
    }
  }
}

/**
 * Calculates driving distance in miles between two addresses using the configured provider.
 * Falls back to `{ estimated: true, distanceMiles: 0 }` when no provider/API key is configured
 * or the provider call fails, so the app never blocks visit creation on a routing failure.
 */
export async function calculateMileage(
  fromAddress: string,
  toAddress: string
): Promise<MileageResult> {
  const key = cacheKey(fromAddress, toAddress);
  const cached = mileageCache.get(key);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.result;
  }

  const result = await calculateMileageUncached(fromAddress, toAddress);

  // Don't cache failed/fallback lookups - a transient provider hiccup shouldn't get "stuck"
  // returning 0 mi for the next 12 hours; only cache genuine successful calculations.
  if (!result.estimated) {
    mileageCache.set(key, { result, expiresAt: Date.now() + CACHE_TTL_MS });
  }

  return result;
}

/**
 * Calculates driving distance in miles between two addresses using the configured provider.
 * Falls back to `{ estimated: true, distanceMiles: 0 }` when no provider/API key is configured
 * or the provider call fails, so the app never blocks visit creation on a routing failure.
 */
async function calculateMileageUncached(
  fromAddress: string,
  toAddress: string
): Promise<MileageResult> {
  const provider = buildProvider();

  if (!provider) {
    return { distanceMiles: 0, estimated: true, provider: "none" };
  }

  try {
    const distanceMiles = await provider.getDistanceMiles(fromAddress, toAddress);
    return { distanceMiles: Math.round(distanceMiles * 10) / 10, estimated: false, provider: provider.name };
  } catch (err) {
    console.warn(`Mileage provider (${provider.name}) failed, falling back to manual entry:`, err);
    return { distanceMiles: 0, estimated: true, provider: provider.name };
  }
}
