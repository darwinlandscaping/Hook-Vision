import * as Location from "expo-location";

/**
 * Known NT fishing spots with their GPS coordinates.
 * Used to map a user's GPS to a meaningful fishing location name.
 */
export const NT_SPOTS: { name: string; lat: number; lng: number }[] = [
  { name: "Darwin Harbour",        lat: -12.4634, lng: 130.8456 },
  { name: "East Arm",              lat: -12.484,  lng: 130.879  },
  { name: "Channel Island",        lat: -12.596,  lng: 130.904  },
  { name: "Fog Bay",               lat: -12.397,  lng: 130.400  },
  { name: "Bynoe Harbour",         lat: -12.670,  lng: 130.598  },
  { name: "Adelaide River Mouth",  lat: -12.152,  lng: 131.370  },
  { name: "Adelaide River",        lat: -12.650,  lng: 131.101  },
  { name: "Mary River",            lat: -12.868,  lng: 131.646  },
  { name: "Shady Camp",            lat: -12.734,  lng: 131.970  },
  { name: "Corroboree Billabong",  lat: -12.887,  lng: 131.988  },
  { name: "Kakadu",                lat: -12.585,  lng: 132.537  },
  { name: "South Alligator River", lat: -12.565,  lng: 132.439  },
  { name: "East Alligator River",  lat: -12.438,  lng: 132.982  },
  { name: "Daly River",            lat: -13.763,  lng: 130.686  },
  { name: "Edith River",           lat: -14.178,  lng: 132.082  },
  { name: "Katherine River",       lat: -14.468,  lng: 132.265  },
  { name: "Roper River",           lat: -14.724,  lng: 134.553  },
  { name: "McArthur River",        lat: -15.904,  lng: 136.066  },
  { name: "Borroloola",            lat: -16.077,  lng: 136.300  },
  { name: "Van Diemen Gulf",       lat: -11.800,  lng: 130.800  },
  { name: "Cobourg Peninsula",     lat: -11.400,  lng: 132.180  },
  { name: "Goulburn Island",       lat: -11.570,  lng: 133.390  },
  { name: "Nhulunbuy",             lat: -12.183,  lng: 136.778  },
  { name: "Cox Peninsula",         lat: -12.516,  lng: 130.562  },
  { name: "Dundee Beach",          lat: -12.520,  lng: 130.348  },
  { name: "Darwin CBD Waterfront", lat: -12.462,  lng: 130.844  },
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
 *  1. Nearest known NT fishing spot within 30 km
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

    // 1. Try to match a known NT fishing spot
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
