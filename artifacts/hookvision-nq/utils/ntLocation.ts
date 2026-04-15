import * as Location from "expo-location";

/**
 * Known NQ fishing spots with their GPS coordinates.
 * Used to map a user's GPS to a meaningful NQ fishing location name.
 */
export const NT_SPOTS: { name: string; lat: number; lng: number }[] = [
  { name: "Karumba Point",             lat: -17.487, lng: 140.836 },
  { name: "Norman River Mouth",        lat: -17.623, lng: 140.912 },
  { name: "Normanton Wharf",           lat: -17.667, lng: 141.078 },
  { name: "Flinders River Mouth",      lat: -17.733, lng: 141.167 },
  { name: "Gilbert River Mouth",       lat: -16.983, lng: 141.333 },
  { name: "Mitchell River Mouth",      lat: -15.225, lng: 141.583 },
  { name: "Kowanyama",                 lat: -15.483, lng: 141.750 },
  { name: "Weipa",                     lat: -12.667, lng: 141.867 },
  { name: "Embley River",              lat: -12.589, lng: 141.822 },
  { name: "Ducie River",               lat: -12.745, lng: 141.933 },
  { name: "Edward River",              lat: -14.033, lng: 141.617 },
  { name: "Pormpuraaw",                lat: -14.883, lng: 141.600 },
  { name: "Burketown",                 lat: -17.733, lng: 139.548 },
  { name: "Albert River",              lat: -17.689, lng: 139.421 },
  { name: "Cairns",                    lat: -16.919, lng: 145.778 },
  { name: "Trinity Bay",               lat: -16.866, lng: 145.718 },
  { name: "Barron River Delta",        lat: -16.867, lng: 145.666 },
  { name: "Port Douglas",              lat: -16.484, lng: 145.466 },
  { name: "Cooktown",                  lat: -15.467, lng: 145.248 },
  { name: "Endeavour River",           lat: -15.489, lng: 145.266 },
  { name: "Laura River",               lat: -15.567, lng: 144.461 },
  { name: "Princess Charlotte Bay",    lat: -14.400, lng: 144.283 },
  { name: "Cape Melville",             lat: -14.083, lng: 144.500 },
  { name: "Agincourt Reef (GBR)",      lat: -16.033, lng: 145.700 },
  { name: "Hastings Reef (GBR)",       lat: -16.483, lng: 145.950 },
  { name: "Boulders Creek (Tully)",    lat: -17.933, lng: 145.983 },
  { name: "Tully River",               lat: -17.933, lng: 145.933 },
  { name: "North Johnstone River",     lat: -17.533, lng: 145.967 },
  { name: "Wenlock River",             lat: -12.637, lng: 142.567 },
  { name: "Archer River",              lat: -13.467, lng: 141.700 },
  { name: "Cape York",                 lat: -10.685, lng: 142.533 },
  { name: "Gulf of Carpentaria",       lat: -14.000, lng: 139.000 },
  { name: "Karumba Bay",               lat: -17.200, lng: 140.600 },
];

const MATCH_RADIUS_KM = 30;

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Silently requests location permission and resolves to a human-readable
 * NQ fishing location name. Returns null if permission denied or timeout.
 *
 * Priority:
 *  1. Nearest known NQ fishing spot within 30 km
 *  2. Reverse-geocoded suburb/city + state
 *  3. null (caller should handle gracefully — just omit from report)
 */
export async function getNTLocationName(timeoutMs = 8000): Promise<string | null> {
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== "granted") return null;

    const pos = await Promise.race([
      Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
      new Promise<null>((res) => setTimeout(() => res(null), timeoutMs)),
    ]);
    if (!pos) return null;

    const { latitude: lat, longitude: lng } = pos.coords;

    // 1. Try to match a known NQ fishing spot within radius
    let closest: (typeof NT_SPOTS)[0] | null = null;
    let closestDist = Infinity;
    for (const spot of NT_SPOTS) {
      const d = haversineKm(lat, lng, spot.lat, spot.lng);
      if (d < closestDist) { closestDist = d; closest = spot; }
    }
    if (closest && closestDist <= MATCH_RADIUS_KM) return closest.name;

    // 2. Fall back to reverse geocoding
    const [geo] = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lng });
    if (geo) {
      const parts: string[] = [];
      if (geo.district || geo.subregion) parts.push((geo.district || geo.subregion)!);
      else if (geo.city) parts.push(geo.city);
      if (geo.region) parts.push(geo.region);
      if (parts.length) return parts.join(", ");
    }

    return null;
  } catch {
    return null;
  }
}
