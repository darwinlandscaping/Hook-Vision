// Maps lure category keywords → Wikipedia article for thumbnail
// The thumbnail fetch uses the same Wikipedia REST API as fish images

export interface LureCategory {
  label: string;
  article: string;
}

const LURE_CATEGORIES: Array<{ keywords: string[]; label: string; article: string }> = [
  {
    keywords: ["popper", "bubble", "roosta", "slidog", "surface"],
    label: "Surface Popper",
    article: "Surface_lure",
  },
  {
    keywords: ["soft plastic", "paddletail", "swimmerz", "squidgies", "zman", "gulp"],
    label: "Soft Plastic",
    article: "Soft_plastic_bait",
  },
  {
    keywords: ["minnow", "hardbody", "bibbed", "rapala", "x-rap", "jackall", "zerek", "crankbait"],
    label: "Hardbody Minnow",
    article: "Crankbait",
  },
  {
    keywords: ["jig", "slow pitch", "slow-pitch", "knife jig", "sabiki"],
    label: "Fishing Jig",
    article: "Jig_(fishing)",
  },
  {
    keywords: ["metal", "slug", "chrome", "casting lure"],
    label: "Metal Slug",
    article: "Spoon_lure",
  },
  {
    keywords: ["stickbait", "stick bait", "pencil", "walk-the-dog"],
    label: "Stickbait",
    article: "Surface_lure",
  },
  {
    keywords: ["live bait", "mullet", "prawn", "yakka", "garfish", "pilchard", "squid", "bait"],
    label: "Live / Natural Bait",
    article: "Live_bait_(fishing)",
  },
];

const cache: Record<string, string | null> = {};

export function getLureCategory(lureText: string): LureCategory | null {
  const lower = lureText.toLowerCase();
  for (const cat of LURE_CATEGORIES) {
    if (cat.keywords.some((k) => lower.includes(k))) {
      return { label: cat.label, article: cat.article };
    }
  }
  return null;
}

export async function fetchLureImage(lureText: string): Promise<string | null> {
  const cat = getLureCategory(lureText);
  if (!cat) return null;

  if (cache[cat.article] !== undefined) return cache[cat.article];

  try {
    const r = await fetch(
      `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(cat.article)}`,
      { headers: { Accept: "application/json" } }
    );
    const data = await r.json();
    const url: string | null = data?.thumbnail?.source ?? null;
    cache[cat.article] = url;
    return url;
  } catch {
    cache[cat.article] = null;
    return null;
  }
}
