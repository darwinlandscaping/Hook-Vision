import * as Location from "expo-location";

/**
 * Known NQ fishing spots with their GPS coordinates.
 * Used to map a user's GPS to a meaningful fishing location name.
 */
export const NT_SPOTS: { name: string; lat: number; lng: number }[] = [
  { name: "Karumba Point",          lat: -17.487, lng: 140.836 },
  { name: "Norman River Mouth",     lat: -17.623, lng: 140.912 },
  { name: "Normanton Wharf",        lat: -17.667, lng: 141.078 },
  { name: "Flinders River Mouth",   lat: -17.733, lng: 141.167 },
  { name: "Gilbert River Mouth",    lat: -16.983, lng: 141.333 },
  { name: "Mitchell River Mouth",   lat: -15.225, lng: 141.583 },
  { name: "Kowanyama",              lat: -15.483, lng: 141.750 },
  { name: "Weipa",                  lat: -12.667, lng: 141.867 },
  { name: "Embley River",           lat: -12.589, lng: 141.822 },
  { name: "Ducie River",            lat: -12.745, lng: 141.933 },
  { name: "Edward River",           lat: -14.033, lng: 141.617 },
  { name: "Pormpuraaw",             lat: -14.883, lng: 141.600 },
  { name: "Burketown",              lat: -17.733, lng: 139.548 },
  { name: "Albert River",           lat: -17.689, lng: 139.421 },
  { name: "Cairns",                 lat: -16.919, lng: 145.778 },
  { name: "Trinity Bay",            lat: -16.866, lng: 145.718 },
  { name: "Barron River Delta",     lat: -16.867, lng: 145.666 },
  { name: "Port Douglas",           lat: -16.484, lng: 145.466 },
  { name: "Cooktown",               lat: -15.467, lng: 145.248 },
  { name: "Endeavour River",        lat: -15.489, lng: 145.266 },
  { name: "Laura River",            lat: -15.567, lng: 144.461 },
  { name: "Princess Charlotte Bay", lat: -14.400, lng: 144.283 },
  { name: "Cape Melville",          lat: -14.083, lng: 144.500 },
  { name: "Coral Sea - Osprey Reef",lat: -13.872, lng: 146.587 },
  { name: "Agincourt Reef (GBR)",   lat: -16.033, lng: 145.700 },
  { name: "Hastings Reef (GBR)",    lat: -16.483, lng: 145.950 },
  { name: "Flinders Reef (Coral Sea)", lat: -17.717, lng: 148.433 },
  { name: "Boulders Creek (Tully)", lat: -17.933, lng: 145.983 },
  { name: "Tully River",            lat: -17.933, lng: 145.933 },
  { name: "North Johnstone River",  lat: -17.533, lng: 145.967 },
  { name: "Wenlock River",          lat: -12.637, lng: 142.567 },
  { name: "Archer River",           lat: -13.467, lng: 141.700 },
  { name: "Cape York",              lat: -10.685, lng: 142.533 },
  { name: "Gulf of Carpentaria",    lat: -14.000, lng: 139.000 },
  { name: "Karumba Bay",            lat: -17.200, lng: 140.600 },
];

/**
 * Returns the name of the nearest NQ fishing spot to the given coords.
 */
export function nearestSpot(lat: number, lng: number): string {
  let best = NT_SPOTS[0];
  let bestDist = haversine(lat, lng, best.lat, best.lng);
  for (const spot of NT_SPOTS) {
    const d = haversine(lat, lng, spot.lat, spot.lng);
    if (d < bestDist) { bestDist = d; best = spot; }
  }
  return best.name;
}

function haversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = deg2rad(lat2 - lat1);
  const dLon = deg2rad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function deg2rad(deg: number): number {
  return deg * (Math.PI / 180);
}

/**
 * Requests location permission and returns the current position.
 * Returns null if permission is denied.
 */
export async function getCurrentLocation(): Promise<{ lat: number; lng: number } | null> {
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== "granted") return null;
    const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
    return { lat: pos.coords.latitude, lng: pos.coords.longitude };
  } catch {
    return null;
  }
}
