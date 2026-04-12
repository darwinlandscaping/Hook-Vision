import { useEffect, useState } from "react";

/**
 * Curated, high-quality iNaturalist photo URLs for NT fishing species.
 * Using direct CDN URLs avoids API latency and ensures correct, Australian-specific photos.
 * Photos sourced from iNaturalist open-data — licenced under CC-BY.
 */
const SPECIES_PHOTOS: Array<{ keywords: string[]; url: string; label: string }> = [
  {
    keywords: ["barramundi", "barra", "lates calcarifer"],
    url: "https://inaturalist-open-data.s3.amazonaws.com/photos/256218238/medium.jpg",
    label: "Barramundi",
  },
  {
    keywords: ["mangrove jack", "jack", "lutjanus argentimaculatus"],
    url: "https://inaturalist-open-data.s3.amazonaws.com/photos/42950611/medium.jpeg",
    label: "Mangrove Jack",
  },
  {
    keywords: ["spanish mackerel", "spaniard", "scomberomorus commerson"],
    url: "https://inaturalist-open-data.s3.amazonaws.com/photos/218054568/medium.jpg",
    label: "Spanish Mackerel",
  },
  {
    keywords: ["giant trevally", "gt", "caranx ignobilis"],
    url: "https://inaturalist-open-data.s3.amazonaws.com/photos/11911542/medium.jpg",
    label: "Giant Trevally",
  },
  {
    keywords: ["coral trout", "plectropomus leopardus"],
    url: "https://static.inaturalist.org/photos/216412385/medium.jpeg",
    label: "Coral Trout",
  },
  {
    keywords: ["queenfish", "queenie", "scomberoides commersonnianus"],
    url: "https://static.inaturalist.org/photos/341981629/medium.jpeg",
    label: "Queenfish",
  },
  {
    keywords: ["king threadfin", "king threadie", "polydactylus macrochir"],
    url: "https://static.inaturalist.org/photos/50447387/medium.jpeg",
    label: "King Threadfin",
  },
  {
    keywords: ["threadfin salmon", "threadfin", "threadie", "eleutheronema tetradactylum", "four finger threadfin"],
    url: "https://inaturalist-open-data.s3.amazonaws.com/photos/11930136/medium.jpg",
    label: "Threadfin Salmon",
  },
  {
    keywords: ["black jewfish", "jewie", "protonibea diacanthus", "black jew"],
    url: "https://inaturalist-open-data.s3.amazonaws.com/photos/315955428/medium.jpeg",
    label: "Black Jewfish",
  },
  {
    keywords: ["red emperor", "lutjanus sebae"],
    url: "https://inaturalist-open-data.s3.amazonaws.com/photos/77724926/medium.jpg",
    label: "Red Emperor",
  },
  {
    keywords: ["fingermark", "golden snapper", "lutjanus johnii"],
    url: "https://inaturalist-open-data.s3.amazonaws.com/photos/6200097/medium.jpg",
    label: "Fingermark / Golden Snapper",
  },
  {
    keywords: ["goldband snapper", "gold band", "pristipomoides multidens", "goldie"],
    url: "https://inaturalist-open-data.s3.amazonaws.com/photos/606598/medium.jpg",
    label: "Goldband Snapper",
  },
  {
    keywords: ["ruby snapper", "nannygai", "redfish", "etelis carbunculus"],
    url: "https://inaturalist-open-data.s3.amazonaws.com/photos/216170503/medium.jpeg",
    label: "Ruby Snapper / Nannygai",
  },
  {
    keywords: ["cobia", "black kingfish", "rachycentron canadum"],
    url: "https://inaturalist-open-data.s3.amazonaws.com/photos/19249056/medium.jpg",
    label: "Cobia",
  },
  {
    keywords: ["estuary cod", "estuary grouper", "orange-spotted grouper", "epinephelus coioides"],
    url: "https://inaturalist-open-data.s3.amazonaws.com/photos/187446351/medium.jpg",
    label: "Estuary Cod",
  },
  {
    keywords: ["sweetlip", "painted sweetlip", "plectorhinchus flavomaculatus"],
    url: "https://inaturalist-open-data.s3.amazonaws.com/photos/42953669/medium.jpeg",
    label: "Sweetlip",
  },
  {
    keywords: ["grass emperor", "emperor", "lethrinus"],
    url: "https://inaturalist-open-data.s3.amazonaws.com/photos/5333030/medium.jpeg",
    label: "Emperor",
  },
  {
    keywords: ["bluebone", "tuskfish", "bluecheek", "choerodon schoenleinii", "blackspot tuskfish"],
    url: "https://inaturalist-open-data.s3.amazonaws.com/photos/66293751/medium.jpg",
    label: "Tuskfish / Bluebone",
  },
  {
    keywords: ["baldchin groper", "baldchin"],
    url: "https://inaturalist-open-data.s3.amazonaws.com/photos/66293751/medium.jpg",
    label: "Baldchin Groper",
  },
  {
    keywords: ["bigeye trevally", "big eye trevally", "caranx sexfasciatus"],
    url: "https://inaturalist-open-data.s3.amazonaws.com/photos/1411110/medium.jpg",
    label: "Bigeye Trevally",
  },
  {
    keywords: ["flathead", "platycephalus"],
    url: "https://inaturalist-open-data.s3.amazonaws.com/photos/6032115/medium.jpg",
    label: "Flathead",
  },
  {
    keywords: ["mullet", "sea mullet", "mugil", "baitfish", "bait school", "bait ball", "bait", "sardine", "herring", "hardyhead"],
    url: "https://inaturalist-open-data.s3.amazonaws.com/photos/11976021/medium.jpeg",
    label: "Baitfish / Mullet",
  },
  {
    keywords: ["crocodile", "croc", "saltwater croc", "estuarine crocodile", "crocodylus porosus"],
    url: "https://static.inaturalist.org/photos/175699742/medium.jpg",
    label: "Saltwater Crocodile",
  },
];

const apiCache: Record<string, string | null> = {};

function resolveDirectUrl(species: string): string | null {
  const clean = species.replace(/\s*\(\d+%\)/, "").toLowerCase().trim();
  for (const entry of SPECIES_PHOTOS) {
    if (entry.keywords.some((k) => clean.includes(k))) {
      return entry.url;
    }
  }
  return null;
}

async function fetchFromiNaturalist(species: string): Promise<string | null> {
  const clean = species.replace(/\s*\(\d+%\)/, "").trim();
  const key = clean.toLowerCase();
  if (apiCache[key] !== undefined) return apiCache[key];

  try {
    const r = await fetch(
      `https://api.inaturalist.org/v1/taxa?q=${encodeURIComponent(clean)}&per_page=1&rank=species`,
      { headers: { Accept: "application/json" } }
    );
    const data = await r.json();
    const photo: string | null = data?.results?.[0]?.default_photo?.medium_url ?? null;
    apiCache[key] = photo;
    return photo;
  } catch {
    apiCache[key] = null;
    return null;
  }
}

export function useFishImage(species: string): string | null {
  const directUrl = resolveDirectUrl(species);
  const [apiUrl, setApiUrl] = useState<string | null>(null);

  useEffect(() => {
    if (directUrl) return; // curated URL found — no need for API
    fetchFromiNaturalist(species).then(setApiUrl);
  }, [species, directUrl]);

  return directUrl ?? apiUrl;
}

/** Sync lookup — returns immediately if species is in the curated map */
export function getSpeciesLabel(species: string): string | null {
  const clean = species.replace(/\s*\(\d+%\)/, "").toLowerCase().trim();
  for (const entry of SPECIES_PHOTOS) {
    if (entry.keywords.some((k) => clean.includes(k))) {
      return entry.label;
    }
  }
  return null;
}
