import type { GeocodeResult, GeocodeSuggestion } from '../../../../packages/shared-types';
import { haversineMeters } from './taskStore';

// Mapbox's Search Box API (not the older Geocoding API v5) — purpose-built for
// autocomplete-as-you-type with meaningfully better small-business/POI
// coverage in India than the legacy geocoder. It's a two-step flow: `suggest`
// returns lightweight rows (no coordinates, cheaper to compute), `retrieve`
// resolves one chosen suggestion to real lat/lng. Both calls in one search
// session must share the same session_token (Mapbox's billing/session model);
// the caller mints one per "session" (roughly: one search until a selection
// is made) and passes it straight through both endpoints below.
//
// Nominatim (OSM's free geocoder) is the fallback when no Mapbox token is
// configured or Mapbox's request fails — same tiered pattern as
// routingService.ts. It has no suggest/retrieve split, so its results already
// carry lat/lng and skip the retrieve step entirely (see GeocodeSuggestion).
//
// Scoped to India only (both providers' native country filters) since that's
// the org's operating region.

const SEARCHBOX_SUGGEST_URL = 'https://api.mapbox.com/search/searchbox/v1/suggest';
const SEARCHBOX_RETRIEVE_URL = 'https://api.mapbox.com/search/searchbox/v1/retrieve';
const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search';
const REQUEST_TIMEOUT_MS = 5000;
const RESULT_LIMIT = 5;

export interface ProximityPoint {
  lat: number;
  lng: number;
}

async function fetchJson(url: string, headers?: Record<string, string>): Promise<any | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: controller.signal, headers });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

async function suggestViaMapbox(
  query: string,
  sessionToken: string,
  proximity?: ProximityPoint
): Promise<GeocodeSuggestion[] | null> {
  const token = process.env.MAPBOX_ACCESS_TOKEN;
  if (!token) return null;

  let url =
    `${SEARCHBOX_SUGGEST_URL}?q=${encodeURIComponent(query)}&access_token=${token}` +
    `&session_token=${encodeURIComponent(sessionToken)}&limit=${RESULT_LIMIT}&country=in` +
    `&types=poi,address,place,locality,neighborhood,street`;
  if (proximity) url += `&proximity=${proximity.lng},${proximity.lat}`;

  const data = await fetchJson(url);
  const suggestions = data?.suggestions;
  if (!Array.isArray(suggestions)) return null;

  return suggestions.map((s: any) => ({
    id: s.mapbox_id as string,
    label: (s.full_address || s.place_formatted || s.name) as string,
  }));
}

async function suggestViaNominatim(query: string, proximity?: ProximityPoint): Promise<GeocodeSuggestion[] | null> {
  const url = `${NOMINATIM_URL}?q=${encodeURIComponent(query)}&format=json&limit=${RESULT_LIMIT}&countrycodes=in`;
  const data = await fetchJson(url, { 'User-Agent': 'LocalSync-Dispatch/1.0 (field-ops dispatch dashboard)' });
  if (!Array.isArray(data)) return null;

  let results: GeocodeSuggestion[] = data.map((r: any) => ({
    id: `${r.lat},${r.lon}`,
    label: r.display_name as string,
    lat: parseFloat(r.lat),
    lng: parseFloat(r.lon),
  }));

  if (proximity) {
    results = [...results].sort(
      (a, b) =>
        haversineMeters(proximity.lat, proximity.lng, a.lat!, a.lng!) -
        haversineMeters(proximity.lat, proximity.lng, b.lat!, b.lng!)
    );
  }

  return results;
}

export async function suggestPlaces(
  query: string,
  sessionToken: string,
  proximity?: ProximityPoint
): Promise<GeocodeSuggestion[]> {
  try {
    const viaMapbox = await suggestViaMapbox(query, sessionToken, proximity);
    if (viaMapbox) return viaMapbox;
    if (process.env.MAPBOX_ACCESS_TOKEN) {
      console.error('[geocoding] Mapbox suggest failed, falling back to Nominatim');
    }

    return (await suggestViaNominatim(query, proximity)) ?? [];
  } catch (err: any) {
    console.error('[geocoding] suggest failed:', err.message);
    return [];
  }
}

// Only ever called for Mapbox-sourced suggestions (Nominatim's already carry
// lat/lng and never need this) — see the `id`/`lat`/`lng` split on
// GeocodeSuggestion.
export async function retrievePlace(id: string, sessionToken: string): Promise<GeocodeResult | null> {
  const token = process.env.MAPBOX_ACCESS_TOKEN;
  if (!token) return null;

  try {
    const url = `${SEARCHBOX_RETRIEVE_URL}/${encodeURIComponent(id)}?access_token=${token}&session_token=${encodeURIComponent(sessionToken)}`;
    const data = await fetchJson(url);
    const feature = data?.features?.[0];
    const coords = feature?.geometry?.coordinates;
    if (!Array.isArray(coords) || coords.length < 2) return null;

    return {
      label: (feature.properties?.full_address || feature.properties?.name || '') as string,
      lat: coords[1] as number,
      lng: coords[0] as number,
    };
  } catch (err: any) {
    console.error('[geocoding] retrieve failed:', err.message);
    return null;
  }
}
