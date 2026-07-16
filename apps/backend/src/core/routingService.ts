import type { RoadRoute } from '../../../../packages/shared-types';

// Routing is additive, never load-bearing: every caller must keep working with
// the existing Haversine distance/eta if this returns null, whether that's
// because no token is configured, Mapbox is down, or the request timed out.
// Geofence "reached" detection deliberately never depends on this — it's a
// straight-line-radius check by definition and should stay that way.

const DIRECTIONS_URL = 'https://api.mapbox.com/directions/v5/mapbox/driving';
const REQUEST_TIMEOUT_MS = 5000;

export function isRoutingConfigured(): boolean {
  return !!process.env.MAPBOX_ACCESS_TOKEN;
}

export async function fetchRoadRoute(
  originLat: number,
  originLng: number,
  destLat: number,
  destLng: number
): Promise<RoadRoute | null> {
  const token = process.env.MAPBOX_ACCESS_TOKEN;
  if (!token) return null;

  const url = `${DIRECTIONS_URL}/${originLng},${originLat};${destLng},${destLat}?geometries=geojson&overview=full&access_token=${token}`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) {
      console.error(`[routing] Mapbox Directions returned ${res.status}`);
      return null;
    }
    const data: any = await res.json();
    const route = data.routes?.[0];
    if (!route?.geometry?.coordinates) return null;

    return {
      geometry: route.geometry.coordinates as [number, number][],
      distanceMeters: route.distance,
      durationSeconds: route.duration,
    };
  } catch (err: any) {
    console.error('[routing] Mapbox Directions request failed:', err.message);
    return null;
  } finally {
    clearTimeout(timeout);
  }
}
