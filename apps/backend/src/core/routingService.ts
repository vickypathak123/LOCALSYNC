import type { RoadRoute } from '../../../../packages/shared-types';

// Routing is additive, never load-bearing: every caller must keep working with
// the existing Haversine distance/eta if this returns null, whatever the
// reason (both providers down, request timed out, no route found). Geofence
// "reached" detection deliberately never depends on this — it's a
// straight-line-radius check by definition and should stay that way.
//
// Two-tier provider: Mapbox Directions when MAPBOX_ACCESS_TOKEN is set (more
// accurate, generous free tier, meant for production use) — OSRM's public
// demo server as an always-available fallback so routing works with zero
// setup. OSRM's demo server is explicitly NOT rated for production/heavy
// traffic (no uptime SLA, rate-limited) — it's here to unblock local dev and
// demos, not to be the permanent provider. Add a Mapbox token when you have
// one; this silently upgrades the moment it's present.

const MAPBOX_DIRECTIONS_URL = 'https://api.mapbox.com/directions/v5/mapbox/driving';
const OSRM_DEMO_URL = 'https://router.project-osrm.org/route/v1/driving';
const REQUEST_TIMEOUT_MS = 5000;

async function fetchJson(url: string): Promise<any | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchFromMapbox(
  originLat: number,
  originLng: number,
  destLat: number,
  destLng: number
): Promise<RoadRoute | null> {
  const token = process.env.MAPBOX_ACCESS_TOKEN;
  if (!token) return null;

  const url = `${MAPBOX_DIRECTIONS_URL}/${originLng},${originLat};${destLng},${destLat}?geometries=geojson&overview=full&access_token=${token}`;
  const data = await fetchJson(url);
  const route = data?.routes?.[0];
  if (!route?.geometry?.coordinates) return null;

  return {
    geometry: route.geometry.coordinates as [number, number][],
    distanceMeters: route.distance,
    durationSeconds: route.duration,
  };
}

async function fetchFromOsrmDemo(
  originLat: number,
  originLng: number,
  destLat: number,
  destLng: number
): Promise<RoadRoute | null> {
  const url = `${OSRM_DEMO_URL}/${originLng},${originLat};${destLng},${destLat}?geometries=geojson&overview=full`;
  const data = await fetchJson(url);
  const route = data?.routes?.[0];
  if (data?.code !== 'Ok' || !route?.geometry?.coordinates) return null;

  return {
    geometry: route.geometry.coordinates as [number, number][],
    distanceMeters: route.distance,
    durationSeconds: route.duration,
  };
}

export async function fetchRoadRoute(
  originLat: number,
  originLng: number,
  destLat: number,
  destLng: number
): Promise<RoadRoute | null> {
  try {
    const viaMapbox = await fetchFromMapbox(originLat, originLng, destLat, destLng);
    if (viaMapbox) return viaMapbox;
    if (process.env.MAPBOX_ACCESS_TOKEN) {
      console.error('[routing] Mapbox request failed, falling back to OSRM demo server');
    }

    return await fetchFromOsrmDemo(originLat, originLng, destLat, destLng);
  } catch (err: any) {
    console.error('[routing] route fetch failed:', err.message);
    return null;
  }
}
