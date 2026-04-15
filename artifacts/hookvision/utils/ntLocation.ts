import * as Location from "expo-location";

/**
 * Known WA/Kimberley fishing spots with their GPS coordinates.
 * Used to map a user's GPS to a meaningful fishing location name.
 */
export const NT_SPOTS: { name: string; lat: number; lng: number }[] = [
  { name: "Broome Town Beach",       lat: -18.0093, lng: 122.2051 },
  { name: "Roebuck Bay",             lat: -18.1200, lng: 122.3000 },
  { name: "Cable Beach",             lat: -17.9543, lng: 122.1847 },
  { name: "Gantheaume Point",        lat: -18.0483, lng: 122.1833 },
  { name: "Derby",                   lat: -17.3103, lng: 123.6278 },
  { name: "King Sound",              lat: -16.5000, lng: 123.5000 },
  { name: "Fitzroy River Mouth",     lat: -17.7230, lng: 123.7070 },
  { name: "Fitzroy Crossing",        lat: -18.1785, lng: 125.5881 },
  { name: "Willare Ramp",            lat: -17.8500, lng: 123.6500 },
  { name: "Kununurra",               lat: -15.7742, lng: 128.7300 },
  { name: "Lake Kununurra",          lat: -15.7100, lng: 128.7400 },
  { name: "Wyndham",                 lat: -15.4651, lng: 128.1069 },
  { name: "Cambridge Gulf",          lat: -15.2000, lng: 128.4000 },
  { name: "Ord River Mouth",         lat: -15.0990, lng: 128.2340 },
  { name: "Drysdale River",          lat: -14.7490, lng: 126.9550 },
  { name: "Mitchell River",          lat: -14.8000, lng: 125.7500 },
  { name: "Prince Regent River",     lat: -15.8500, lng: 125.0500 },
  { name: "King George Falls",       lat: -14.8830, lng: 127.6580 },
  { name: "Berkeley Sound",          lat: -14.2500, lng: 127.1500 },
  { name: "Port Hedland",            lat: -20.3121, lng: 118.6061 },
  { name: "De Grey River",           lat: -20.1890, lng: 119.1690 },
  { name: "Pardoo Station",          lat: -20.1100, lng: 119.5600 },
  { name: "Montebello Islands",      lat: -20.4870, lng: 115.5320 },
  { name: "Dampier",                 lat: -20.6530, lng: 116.7130 },
  { name: "Karratha",                lat: -20.7377, lng: 116.8463 },
  { name: "Roebourne",               lat: -20.7760, lng: 117.1530 },
  { name: "Burrup Peninsula",        lat: -20.5893, lng: 116.7268 },
  { name: "Fortescue River",         lat: -21.6500, lng: 115.7500 },
  { name: "Exmouth",                 lat: -21.9348, lng: 114.1250 },
  { name: "Ningaloo Reef",           lat: -22.5000, lng: 113.7000 },
  { name: "Coral Bay",               lat: -23.1383, lng: 113.7741 },
  { name: "Carnarvon",               lat: -24.8675, lng: 113.6576 },
  { name: "Gascoyne River",          lat: -24.8400, lng: 113.5800 },
  { name: "Shark Bay",               lat: -25.5000, lng: 113.5000 },
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
 * fishing location name. Returns null if permission denied or timeout.
 *
 * Priority:
 *  1. Nearest known WA/Kimberley fishing spot within 30 km
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

    // 1. Try to match a known WA fishing spot
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
