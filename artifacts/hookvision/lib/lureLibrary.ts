export interface DarwinStore {
  id: string;
  name: string;
  shortName: string;
  color: string;
  searchUrl: (lure: string) => string;
}

export interface LureEntry {
  name: string;
  brand: string;
  imageUrl: string;
  productUrl: string;
  lureType: string;
  keywords: string[];
}

// ── All Darwin fishing stores ────────────────────────────────────────────────
export const DARWIN_STORES: DarwinStore[] = [
  {
    id: "craigs",
    name: "Craig's Fishing Warehouse",
    shortName: "Craig's",
    color: "#e63946",
    searchUrl: (lure) =>
      `https://craigsfishingwarehouse.com.au/?s=${encodeURIComponent(lure)}&post_type=product`,
  },
  {
    id: "bcf",
    name: "BCF Darwin",
    shortName: "BCF",
    color: "#0077b6",
    searchUrl: (lure) =>
      `https://www.bcf.com.au/search?q=${encodeURIComponent(lure)}`,
  },
  {
    id: "tackleworld",
    name: "Tackle World Darwin",
    shortName: "Tackle World",
    color: "#2d6a4f",
    searchUrl: (lure) =>
      `https://tackleworld.com.au/?s=${encodeURIComponent(lure)}&post_type=product`,
  },
  {
    id: "anaconda",
    name: "Anaconda Darwin",
    shortName: "Anaconda",
    color: "#6a0572",
    searchUrl: (lure) =>
      `https://www.anacondastores.com.au/fishing?q=${encodeURIComponent(lure)}`,
  },
  {
    id: "ntfishing",
    name: "NT Fishing Supplies",
    shortName: "NT Fishing",
    color: "#f4a261",
    searchUrl: (lure) =>
      `https://www.ntfishingsupplies.com.au/search?q=${encodeURIComponent(lure)}`,
  },
];

const CRAIGS = "https://craigsfishingwarehouse.com.au";

export const LURE_LIBRARY: LureEntry[] = [

  // ── SURFACE POPPERS ────────────────────────────────────────────────────────
  {
    name: "Killalure Flatz Ratz — Bleeding Roses",
    brand: "Killalure",
    imageUrl: `${CRAIGS}/wp-content/uploads/2018/03/BLEEDINGROSESFLATZIMG_9174-300x225.jpeg`,
    productUrl: `${CRAIGS}/product/killalure-flatz-ratz-bleeding-roses-bling/`,
    lureType: "surface_popper",
    keywords: ["flatz ratz", "flatz", "ratz", "killalure", "popper", "surface", "topwater", "bleeding roses", "chugger"],
  },
  {
    name: "Killalure Flatz Ratz — Green Bling",
    brand: "Killalure",
    imageUrl: `${CRAIGS}/wp-content/uploads/2018/03/GREENBLINGFLATZIMG_9175-300x225.jpeg`,
    productUrl: `${CRAIGS}/product/1099/`,
    lureType: "surface_popper",
    keywords: ["flatz ratz", "flatz", "ratz", "killalure", "green", "popper", "surface", "topwater"],
  },
  {
    name: "Halco Roosta Poppa 80 — Avgas",
    brand: "Halco",
    imageUrl: `${CRAIGS}/wp-content/uploads/2018/03/IMG_E6075-300x225.jpg`,
    productUrl: `${CRAIGS}/product/halco-roosta-poppa80-avgas/`,
    lureType: "surface_popper",
    keywords: ["halco", "roosta", "poppa", "popper", "surface", "topwater", "avgas", "walkdog"],
  },
  {
    name: "Halco Roosta Poppa 80 — Eccy",
    brand: "Halco",
    imageUrl: `${CRAIGS}/wp-content/uploads/2018/03/IMG_E6077-300x225.jpg`,
    productUrl: `${CRAIGS}/product/halco-roosta-poppa80-eccy/`,
    lureType: "surface_popper",
    keywords: ["halco", "roosta", "poppa", "popper", "surface", "topwater", "eccy", "chartreuse"],
  },
  {
    name: "Halco Roosta Poppa 80 — Mundi",
    brand: "Halco",
    imageUrl: `${CRAIGS}/wp-content/uploads/2018/03/IMG_E6073-300x225.jpg`,
    productUrl: `${CRAIGS}/product/halco-roosta-poppa80-mundi/`,
    lureType: "surface_popper",
    keywords: ["halco", "roosta", "poppa", "popper", "surface", "topwater", "mundi", "mullet"],
  },

  // ── HARDBODY BIBBED MINNOWS ────────────────────────────────────────────────
  {
    name: "Zerek Flat Shad Pro 3.5\" — Bling Mullet",
    brand: "Zerek",
    imageUrl: `${CRAIGS}/wp-content/uploads/2022/03/BLINGMULLETIMG_9181-300x225.jpeg`,
    productUrl: `${CRAIGS}/product/zerek-flat-shad-pro-3-5-bling-mullet/`,
    lureType: "hardbody",
    keywords: ["zerek", "flat shad", "shad", "hardbody", "minnow", "crankbait", "bibbed", "bling mullet", "mullet", "crank"],
  },
  {
    name: "Zerek Flat Shad Pro 4.5\" — Bling Mullet",
    brand: "Zerek",
    imageUrl: `${CRAIGS}/wp-content/uploads/2022/03/BLINGMULLETIMG_9181-300x225.jpeg`,
    productUrl: `${CRAIGS}/product/zerek-flat-shad-pro-4-5-bling-mullet/`,
    lureType: "hardbody",
    keywords: ["zerek", "flat shad", "shad", "hardbody", "minnow", "crankbait", "bibbed", "jackall", "rapala", "chubby"],
  },
  {
    name: "RMG Scorpion 125SR — Eccy",
    brand: "RMG",
    imageUrl: `${CRAIGS}/wp-content/uploads/2018/03/IMG_E6408-300x225.jpg`,
    productUrl: `${CRAIGS}/product/rmg-scorpion125sr-1mtr-eccy/`,
    lureType: "hardbody",
    keywords: ["rmg", "scorpion", "hardbody", "bibbed", "minnow", "crankbait", "deep diver", "eccy", "deep"],
  },
  {
    name: "RMG Scorpion 125SR — Mundi",
    brand: "RMG",
    imageUrl: `${CRAIGS}/wp-content/uploads/2018/03/IMG_E6086-300x225.jpg`,
    productUrl: `${CRAIGS}/product/rmg-scorpion125sr-1mtr-mundi/`,
    lureType: "hardbody",
    keywords: ["rmg", "scorpion", "hardbody", "bibbed", "minnow", "crankbait", "mundi", "mullet", "strike pro", "atomic"],
  },

  // ── BIBLESS MINNOWS ────────────────────────────────────────────────────────
  {
    name: "Rapala Flat Rap 8cm — Clown",
    brand: "Rapala",
    imageUrl: `${CRAIGS}/wp-content/uploads/2019/08/IMG_E9820-300x225.jpg`,
    productUrl: `${CRAIGS}/product/rapala-flat-rap-8cm-clown/`,
    lureType: "bibless_minnow",
    keywords: ["rapala", "flat rap", "flatrap", "bibless", "clown", "minnow", "fr10", "x-rap", "xrap"],
  },
  {
    name: "Rapala Flat Rap 8cm — OPSD",
    brand: "Rapala",
    imageUrl: `${CRAIGS}/wp-content/uploads/2026/01/OPSDFLATRAPIMG_9192-300x225.jpeg`,
    productUrl: `${CRAIGS}/product/rapala-flat-rap-8cm-opsd/`,
    lureType: "bibless_minnow",
    keywords: ["rapala", "flat rap", "flatrap", "bibless", "minnow", "opsd", "olive", "perch", "predatek"],
  },
  {
    name: "Killalure Aussie Bling HD Bomber",
    brand: "Killalure",
    imageUrl: `${CRAIGS}/wp-content/uploads/2020/03/AUSSIEBLINGIMG_9103-300x225.jpeg`,
    productUrl: `${CRAIGS}/product/15a-aussie-bling-hd-bomber/`,
    lureType: "bibless_minnow",
    keywords: ["barra bling", "bling", "aussie", "bomber", "bibless", "minnow", "hardbody", "killalure"],
  },
  {
    name: "Killalure Chartreuse Bling HD Bomber",
    brand: "Killalure",
    imageUrl: `${CRAIGS}/wp-content/uploads/2024/06/CHARTREUSEBLINGIMG_9106-300x225.jpeg`,
    productUrl: `${CRAIGS}/product/15a-chartreuse-bling-hd-bomber/`,
    lureType: "bibless_minnow",
    keywords: ["chartreuse", "bling", "bomber", "bibless", "minnow", "yellow", "nomad", "madscad"],
  },
  {
    name: "Killalure Green Bling HD",
    brand: "Killalure",
    imageUrl: `${CRAIGS}/wp-content/uploads/2018/03/GREENBLINGIMG_9102-300x225.jpeg`,
    productUrl: `${CRAIGS}/product/15a-green-bling-hd/`,
    lureType: "bibless_minnow",
    keywords: ["green", "bling", "bibless", "minnow", "hardbody", "predatek", "barra bling"],
  },

  // ── SOFT PLASTICS ──────────────────────────────────────────────────────────
  {
    name: "Akame Guppy 120 — Pearl Jam",
    brand: "Akame",
    imageUrl: `${CRAIGS}/wp-content/uploads/2024/02/PEARLJAM120IMG_9177-300x225.jpeg`,
    productUrl: `${CRAIGS}/product/akame-guppy-120-pearl-jam-twin-pack/`,
    lureType: "soft_plastic",
    keywords: ["soft plastic", "paddle", "paddletail", "guppy", "akame", "prawn", "zman", "berkley", "gulp", "curl tail", "grub", "shrimp", "120"],
  },
  {
    name: "Akame Guppy 150 — Pearl Jam",
    brand: "Akame",
    imageUrl: `${CRAIGS}/wp-content/uploads/2024/02/PEARLJAM150IMG_9178-300x225.jpeg`,
    productUrl: `${CRAIGS}/product/akame-guppy-150-pearl-jam-twin-pack/`,
    lureType: "soft_plastic",
    keywords: ["soft plastic", "paddle", "paddletail", "guppy", "akame", "prawn", "zman z-man", "berkley", "gulp", "wriggler", "shrimp", "150"],
  },

  // ── STICKBAITS / PENCIL BAITS ──────────────────────────────────────────────
  {
    name: "Killalure Flatz Ratz — Surface Pencil",
    brand: "Killalure",
    imageUrl: `${CRAIGS}/wp-content/uploads/2018/03/BLEEDINGROSESFLATZIMG_9174-300x225.jpeg`,
    productUrl: `${CRAIGS}/product/killalure-flatz-ratz-bleeding-roses-bling/`,
    lureType: "stickbait",
    keywords: ["stickbait", "pencil", "walk the dog", "dog walk", "nomad", "madscad", "raptor", "maria", "surface"],
  },
  {
    name: "Halco Roosta Poppa 80 — Walk the Dog",
    brand: "Halco",
    imageUrl: `${CRAIGS}/wp-content/uploads/2018/03/IMG_E6075-300x225.jpg`,
    productUrl: `${CRAIGS}/product/halco-roosta-poppa80-avgas/`,
    lureType: "stickbait",
    keywords: ["stickbait", "pencil", "surface", "walk", "dog", "slidog", "stick"],
  },

  // ── METAL SLUGS ────────────────────────────────────────────────────────────
  {
    name: "Killalure Aussie Bling HD — Metal Slug",
    brand: "Killalure",
    imageUrl: `${CRAIGS}/wp-content/uploads/2020/03/AUSSIEBLINGIMG_9103-300x225.jpeg`,
    productUrl: `${CRAIGS}/product/15a-aussie-bling-hd-bomber/`,
    lureType: "metal_slug",
    keywords: ["metal", "slug", "chrome", "casting", "spoon", "bling", "bomber", "halco", "twisty", "slugger", "cast"],
  },
  {
    name: "Killalure Chartreuse Bling — Metal",
    brand: "Killalure",
    imageUrl: `${CRAIGS}/wp-content/uploads/2024/06/CHARTREUSEBLINGIMG_9106-300x225.jpeg`,
    productUrl: `${CRAIGS}/product/15a-chartreuse-bling-hd-bomber/`,
    lureType: "metal_slug",
    keywords: ["metal", "slug", "chrome", "casting", "spoon", "chartreuse", "yellow", "bling", "pilchard"],
  },
  {
    name: "Killalure Green Bling — Metal",
    brand: "Killalure",
    imageUrl: `${CRAIGS}/wp-content/uploads/2018/03/GREENBLINGIMG_9102-300x225.jpeg`,
    productUrl: `${CRAIGS}/product/15a-green-bling-hd/`,
    lureType: "metal_slug",
    keywords: ["metal", "slug", "green", "bling", "chrome", "casting", "surecatch", "spoon"],
  },

  // ── SLOW JIGS ──────────────────────────────────────────────────────────────
  {
    name: "Killalure Barrabait — Bleeding Roses",
    brand: "Killalure",
    imageUrl: `${CRAIGS}/wp-content/uploads/2018/09/BLEEDINGROSESIMG_9101-300x225.jpeg`,
    productUrl: `${CRAIGS}/product/killalure-barrabait-bleeding-roses-bling/`,
    lureType: "slow_jig",
    keywords: ["jig", "slow pitch", "knife jig", "barrabait", "killalure", "slow", "jigging", "metal jig"],
  },
  {
    name: "Killalure Barrabait — Gold Head",
    brand: "Killalure",
    imageUrl: `${CRAIGS}/wp-content/uploads/2018/03/BDSIGOLDHEADIMG_9095-300x225.jpeg`,
    productUrl: `${CRAIGS}/product/killalure-barrabait-bling-bdsi-gold-head/`,
    lureType: "slow_jig",
    keywords: ["jig", "slow pitch", "barrabait", "killalure", "gold head", "barra jig", "spoon jig"],
  },
  {
    name: "Killalure Barrabait Bling — Black",
    brand: "Killalure",
    imageUrl: `${CRAIGS}/wp-content/uploads/2018/03/BLACKBLINGIMG_9098-300x225.jpeg`,
    productUrl: `${CRAIGS}/product/killalure-barrabait-bling-black/`,
    lureType: "slow_jig",
    keywords: ["jig", "slow pitch", "barrabait", "black jig", "killalure", "metal jig", "deep jig"],
  },

  // ── FROG / SURFACE CRAWLERS ────────────────────────────────────────────────
  {
    name: "Killalure Flatz Ratz — Frog / Surface",
    brand: "Killalure",
    imageUrl: `${CRAIGS}/wp-content/uploads/2018/03/BLEEDINGROSESFLATZIMG_9174-300x225.jpeg`,
    productUrl: `${CRAIGS}/product/killalure-flatz-ratz-bleeding-roses-bling/`,
    lureType: "frog",
    keywords: ["frog", "toad", "surface", "lily", "pad", "snag", "weedless", "topwater", "bubble"],
  },
];

/**
 * Find the best matching lure from the library.
 * Priority: exact lureType match → highest keyword overlap with the AI's suggestion.
 */
export function findBestLure(lureText: string, lureType?: string): LureEntry | null {
  const lower = (lureText ?? "").toLowerCase();

  let candidates = lureType
    ? LURE_LIBRARY.filter((l) => l.lureType === lureType)
    : LURE_LIBRARY;

  if (candidates.length === 0) candidates = LURE_LIBRARY;

  let best: LureEntry | null = null;
  let bestScore = -1;

  for (const lure of candidates) {
    let score = 0;
    for (const kw of lure.keywords) {
      if (lower.includes(kw)) score += kw.split(" ").length;
    }
    if (score > bestScore) {
      bestScore = score;
      best = lure;
    }
  }

  return best ?? candidates[0] ?? null;
}

/**
 * Generate buy links for all Darwin stores for a given lure name.
 */
export function getDarwinStoreLinks(lureName: string): { store: DarwinStore; url: string }[] {
  const searchTerm = lureName.replace(/—.*$/, "").trim();
  return DARWIN_STORES.map((store) => ({
    store,
    url: store.searchUrl(searchTerm),
  }));
}
