export interface LureEntry {
  name: string;
  brand: string;
  imageUrl: string;
  productUrl: string;
  lureType: string;
  keywords: string[];
}

const BASE = "https://craigsfishingwarehouse.com.au";

export const LURE_LIBRARY: LureEntry[] = [

  // ── SURFACE POPPERS ────────────────────────────────────────────────────────
  {
    name: "Killalure Flatz Ratz Bleeding Roses",
    brand: "Killalure",
    imageUrl: `${BASE}/wp-content/uploads/2018/03/BLEEDINGROSESFLATZIMG_9174-300x225.jpeg`,
    productUrl: `${BASE}/product/killalure-flatz-ratz-bleeding-roses-bling/`,
    lureType: "surface_popper",
    keywords: ["flatz ratz", "flatz", "ratz", "killalure", "popper", "surface", "topwater", "bleeding roses"],
  },
  {
    name: "Killalure Flatz Ratz Green Bling",
    brand: "Killalure",
    imageUrl: `${BASE}/wp-content/uploads/2018/03/GREENBLINGFLATZIMG_9175-300x225.jpeg`,
    productUrl: `${BASE}/product/1099/`,
    lureType: "surface_popper",
    keywords: ["flatz ratz", "flatz", "ratz", "killalure", "green", "popper", "surface"],
  },
  {
    name: "Halco Roosta Poppa 80 Avgas",
    brand: "Halco",
    imageUrl: `${BASE}/wp-content/uploads/2018/03/IMG_E6075-300x225.jpg`,
    productUrl: `${BASE}/product/halco-roosta-poppa80-avgas/`,
    lureType: "surface_popper",
    keywords: ["halco", "roosta", "poppa", "popper", "surface", "topwater", "avgas"],
  },
  {
    name: "Halco Roosta Poppa 80 Eccy",
    brand: "Halco",
    imageUrl: `${BASE}/wp-content/uploads/2018/03/IMG_E6077-300x225.jpg`,
    productUrl: `${BASE}/product/halco-roosta-poppa80-eccy/`,
    lureType: "surface_popper",
    keywords: ["halco", "roosta", "poppa", "popper", "surface", "topwater", "eccy"],
  },
  {
    name: "Halco Roosta Poppa 80 Mundi",
    brand: "Halco",
    imageUrl: `${BASE}/wp-content/uploads/2018/03/IMG_E6073-300x225.jpg`,
    productUrl: `${BASE}/product/halco-roosta-poppa80-mundi/`,
    lureType: "surface_popper",
    keywords: ["halco", "roosta", "poppa", "popper", "surface", "topwater", "mundi"],
  },

  // ── HARDBODY BIBBED MINNOWS ────────────────────────────────────────────────
  {
    name: "Zerek Flat Shad Pro 3.5\" Bling Mullet",
    brand: "Zerek",
    imageUrl: `${BASE}/wp-content/uploads/2022/03/BLINGMULLETIMG_9181-300x225.jpeg`,
    productUrl: `${BASE}/product/zerek-flat-shad-pro-3-5-bling-mullet/`,
    lureType: "hardbody",
    keywords: ["zerek", "flat shad", "shad", "hardbody", "minnow", "crankbait", "bibbed", "bling mullet"],
  },
  {
    name: "Zerek Flat Shad Pro 4.5\" Bling Mullet",
    brand: "Zerek",
    imageUrl: `${BASE}/wp-content/uploads/2022/03/BLINGMULLETIMG_9181-300x225.jpeg`,
    productUrl: `${BASE}/product/zerek-flat-shad-pro-4-5-bling-mullet/`,
    lureType: "hardbody",
    keywords: ["zerek", "flat shad", "shad", "hardbody", "minnow", "crankbait", "bibbed"],
  },
  {
    name: "RMG Scorpion 125SR Eccy",
    brand: "RMG",
    imageUrl: `${BASE}/wp-content/uploads/2018/03/IMG_E6408-300x225.jpg`,
    productUrl: `${BASE}/product/rmg-scorpion125sr-1mtr-eccy/`,
    lureType: "hardbody",
    keywords: ["rmg", "scorpion", "hardbody", "bibbed", "minnow", "crankbait", "deep diver", "eccy"],
  },
  {
    name: "RMG Scorpion 125SR Mundi",
    brand: "RMG",
    imageUrl: `${BASE}/wp-content/uploads/2018/03/IMG_E6086-300x225.jpg`,
    productUrl: `${BASE}/product/rmg-scorpion125sr-1mtr-mundi/`,
    lureType: "hardbody",
    keywords: ["rmg", "scorpion", "hardbody", "bibbed", "minnow", "crankbait", "rapala", "jackall", "deep", "mundi"],
  },

  // ── BIBLESS MINNOWS ────────────────────────────────────────────────────────
  {
    name: "Rapala Flat Rap 8cm Clown",
    brand: "Rapala",
    imageUrl: `${BASE}/wp-content/uploads/2019/08/IMG_E9820-300x225.jpg`,
    productUrl: `${BASE}/product/rapala-flat-rap-8cm-clown/`,
    lureType: "bibless_minnow",
    keywords: ["rapala", "flat rap", "flatrap", "bibless", "clown", "minnow"],
  },
  {
    name: "Rapala Flat Rap 8cm OPSD",
    brand: "Rapala",
    imageUrl: `${BASE}/wp-content/uploads/2026/01/OPSDFLATRAPIMG_9192-300x225.jpeg`,
    productUrl: `${BASE}/product/rapala-flat-rap-8cm-opsd/`,
    lureType: "bibless_minnow",
    keywords: ["rapala", "flat rap", "flatrap", "bibless", "minnow", "opsd", "x-rap"],
  },
  {
    name: "15A Aussie Bling HD Bomber",
    brand: "Killalure",
    imageUrl: `${BASE}/wp-content/uploads/2020/03/AUSSIEBLINGIMG_9103-300x225.jpeg`,
    productUrl: `${BASE}/product/15a-aussie-bling-hd-bomber/`,
    lureType: "bibless_minnow",
    keywords: ["barra bling", "bling", "aussie", "bomber", "bibless", "minnow", "hardbody"],
  },
  {
    name: "15A Chartreuse Bling HD Bomber",
    brand: "Killalure",
    imageUrl: `${BASE}/wp-content/uploads/2024/06/CHARTREUSEBLINGIMG_9106-300x225.jpeg`,
    productUrl: `${BASE}/product/15a-chartreuse-bling-hd-bomber/`,
    lureType: "bibless_minnow",
    keywords: ["chartreuse", "bling", "bomber", "bibless", "minnow", "hardbody", "yellow"],
  },
  {
    name: "15A Green Bling HD",
    brand: "Killalure",
    imageUrl: `${BASE}/wp-content/uploads/2018/03/GREENBLINGIMG_9102-300x225.jpeg`,
    productUrl: `${BASE}/product/15a-green-bling-hd/`,
    lureType: "bibless_minnow",
    keywords: ["green", "bling", "bibless", "minnow", "hardbody", "predatek"],
  },

  // ── SOFT PLASTICS ──────────────────────────────────────────────────────────
  {
    name: "Akame Guppy 120 Pearl Jam",
    brand: "Akame",
    imageUrl: `${BASE}/wp-content/uploads/2024/02/PEARLJAM120IMG_9177-300x225.jpeg`,
    productUrl: `${BASE}/product/akame-guppy-120-pearl-jam-twin-pack/`,
    lureType: "soft_plastic",
    keywords: ["soft plastic", "paddle", "paddletail", "guppy", "akame", "prawn", "zman", "berkley", "gulp", "curly tail", "grub"],
  },
  {
    name: "Akame Guppy 150 Pearl Jam",
    brand: "Akame",
    imageUrl: `${BASE}/wp-content/uploads/2024/02/PEARLJAM150IMG_9178-300x225.jpeg`,
    productUrl: `${BASE}/product/akame-guppy-150-pearl-jam-twin-pack/`,
    lureType: "soft_plastic",
    keywords: ["soft plastic", "paddle", "paddletail", "guppy", "akame", "prawn", "zman", "berkley", "gulp", "curly tail", "wriggler", "shrimp", "120", "150"],
  },

  // ── STICKBAITS / PENCIL BAITS ──────────────────────────────────────────────
  {
    name: "Killalure Flatz Ratz — Stickbait Action",
    brand: "Killalure",
    imageUrl: `${BASE}/wp-content/uploads/2018/03/BLEEDINGROSESFLATZIMG_9174-300x225.jpeg`,
    productUrl: `${BASE}/product/killalure-flatz-ratz-bleeding-roses-bling/`,
    lureType: "stickbait",
    keywords: ["stickbait", "pencil", "walk", "dog", "nomad", "madscad", "raptor", "maria", "surface", "popper"],
  },
  {
    name: "Halco Roosta Poppa 80 — Surface Pencil",
    brand: "Halco",
    imageUrl: `${BASE}/wp-content/uploads/2018/03/IMG_E6075-300x225.jpg`,
    productUrl: `${BASE}/product/halco-roosta-poppa80-avgas/`,
    lureType: "stickbait",
    keywords: ["stickbait", "pencil", "surface", "walk", "dog", "slidog", "madscad"],
  },

  // ── METAL SLUGS ────────────────────────────────────────────────────────────
  {
    name: "15A Aussie Bling HD Bomber",
    brand: "Killalure",
    imageUrl: `${BASE}/wp-content/uploads/2020/03/AUSSIEBLINGIMG_9103-300x225.jpeg`,
    productUrl: `${BASE}/product/15a-aussie-bling-hd-bomber/`,
    lureType: "metal_slug",
    keywords: ["metal", "slug", "chrome", "casting", "spoon", "bling", "bomber", "halco", "twisty", "slugger"],
  },
  {
    name: "15A Chartreuse Bling HD Bomber",
    brand: "Killalure",
    imageUrl: `${BASE}/wp-content/uploads/2024/06/CHARTREUSEBLINGIMG_9106-300x225.jpeg`,
    productUrl: `${BASE}/product/15a-chartreuse-bling-hd-bomber/`,
    lureType: "metal_slug",
    keywords: ["metal", "slug", "chrome", "casting", "spoon", "chartreuse", "yellow", "bling"],
  },
  {
    name: "15A Green Bling HD",
    brand: "Killalure",
    imageUrl: `${BASE}/wp-content/uploads/2018/03/GREENBLINGIMG_9102-300x225.jpeg`,
    productUrl: `${BASE}/product/15a-green-bling-hd/`,
    lureType: "metal_slug",
    keywords: ["metal", "slug", "green", "bling", "chrome", "casting"],
  },

  // ── SLOW JIGS ──────────────────────────────────────────────────────────────
  {
    name: "Killalure Barrabait Bleeding Roses Bling",
    brand: "Killalure",
    imageUrl: `${BASE}/wp-content/uploads/2018/09/BLEEDINGROSESIMG_9101-300x225.jpeg`,
    productUrl: `${BASE}/product/killalure-barrabait-bleeding-roses-bling/`,
    lureType: "slow_jig",
    keywords: ["jig", "slow pitch", "knife jig", "barrabait", "killalure", "slow", "jigging"],
  },
  {
    name: "Killalure Barrabait Bling BDSI Gold Head",
    brand: "Killalure",
    imageUrl: `${BASE}/wp-content/uploads/2018/03/BDSIGOLDHEADIMG_9095-300x225.jpeg`,
    productUrl: `${BASE}/product/killalure-barrabait-bling-bdsi-gold-head/`,
    lureType: "slow_jig",
    keywords: ["jig", "slow pitch", "barrabait", "killalure", "gold head", "barra jig"],
  },
  {
    name: "Killalure Barrabait Bling Black",
    brand: "Killalure",
    imageUrl: `${BASE}/wp-content/uploads/2018/03/BLACKBLINGIMG_9098-300x225.jpeg`,
    productUrl: `${BASE}/product/killalure-barrabait-bling-black/`,
    lureType: "slow_jig",
    keywords: ["jig", "slow pitch", "barrabait", "black jig", "killalure", "metal jig"],
  },

  // ── FROG / SURFACE CRAWLERS ────────────────────────────────────────────────
  {
    name: "Killalure Flatz Ratz — Surface Frog Style",
    brand: "Killalure",
    imageUrl: `${BASE}/wp-content/uploads/2018/03/BLEEDINGROSESFLATZIMG_9174-300x225.jpeg`,
    productUrl: `${BASE}/product/killalure-flatz-ratz-bleeding-roses-bling/`,
    lureType: "frog",
    keywords: ["frog", "toad", "surface", "lily", "pad", "snag", "weedless", "topwater"],
  },
];

/**
 * Find the best matching lure from the library.
 * Priority: exact lureType match → highest keyword overlap with the AI's suggestion.
 */
export function findBestLure(lureText: string, lureType?: string): LureEntry | null {
  const lower = (lureText ?? "").toLowerCase();

  // Filter by lureType first
  let candidates = lureType
    ? LURE_LIBRARY.filter((l) => l.lureType === lureType)
    : LURE_LIBRARY;

  if (candidates.length === 0) candidates = LURE_LIBRARY;

  // Score each candidate by keyword overlap with the AI's lure text
  let best: LureEntry | null = null;
  let bestScore = -1;

  for (const lure of candidates) {
    let score = 0;
    for (const kw of lure.keywords) {
      if (lower.includes(kw)) score += kw.split(" ").length; // longer match = higher weight
    }
    if (score > bestScore) {
      bestScore = score;
      best = lure;
    }
  }

  // If no keyword match, just return the first candidate for the lureType
  return best ?? candidates[0] ?? null;
}
