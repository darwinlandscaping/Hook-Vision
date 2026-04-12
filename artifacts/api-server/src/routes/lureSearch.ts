import { Router } from "express";

const router = Router();

export interface CraigsProduct {
  name: string;
  imageUrl: string;
  productUrl: string;
  price: string | null;
}

const CRAIGS_BASE = "https://craigsfishingwarehouse.com.au";

const cache = new Map<string, { products: CraigsProduct[]; ts: number }>();
const CACHE_TTL = 1000 * 60 * 60; // 1 hour

function decodeHtmlEntities(str: string): string {
  return str
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&#8216;/g, "\u2018")
    .replace(/&#8217;/g, "\u2019")
    .replace(/&#8220;/g, "\u201C")
    .replace(/&#8221;/g, "\u201D")
    .replace(/&#8482;/g, "\u2122")
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCharCode(parseInt(h, 16)));
}

function extractProducts(html: string): CraigsProduct[] {
  const products: CraigsProduct[] = [];
  const seen = new Set<string>();

  const linkRe =
    /<a[^>]+href="(https:\/\/craigsfishingwarehouse\.com\.au\/product\/[^"]+)"[^>]*>([\s\S]*?)<\/a>/g;

  let m: RegExpExecArray | null;
  while ((m = linkRe.exec(html)) !== null) {
    const url = m[1];
    if (seen.has(url)) continue;

    const inner = m[2];
    const imgMatch = inner.match(/src="([^"]+\.(?:jpg|jpeg|png|webp))"/i);
    const titleMatch = inner.match(/<h2[^>]*>([\s\S]*?)<\/h2>/);

    if (!imgMatch) continue;

    seen.add(url);

    const rawTitle = titleMatch
      ? decodeHtmlEntities(titleMatch[1].replace(/<[^>]+>/g, "").trim())
      : "";

    const imgUrl = imgMatch[1];
    const normImg = imgUrl.replace(/-\d+x\d+\./, "-300x225.");

    products.push({
      name: rawTitle,
      imageUrl: normImg,
      productUrl: url,
      price: null,
    });
  }

  return products;
}

async function searchCraigs(query: string): Promise<CraigsProduct[]> {
  const key = query.toLowerCase().trim();
  const cached = cache.get(key);
  if (cached && Date.now() - cached.ts < CACHE_TTL) {
    return cached.products;
  }

  const url = `${CRAIGS_BASE}/?s=${encodeURIComponent(key)}&post_type=product`;
  const res = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      Accept: "text/html",
    },
    signal: AbortSignal.timeout(10_000),
  });

  if (!res.ok) {
    cache.set(key, { products: [], ts: Date.now() });
    return [];
  }

  const html = await res.text();
  const products = extractProducts(html);
  cache.set(key, { products, ts: Date.now() });
  return products;
}

/**
 * Maps lure keywords → Craig's search terms that yield results
 */
const LURE_KEYWORD_MAP: Array<{ keywords: string[]; search: string }> = [
  {
    keywords: [
      "barra",
      "barramundi",
      "hardbody",
      "minnow",
      "crankbait",
      "bibbed",
    ],
    search: "classic barra bling",
  },
  {
    keywords: ["popper", "surface", "slidog", "roosta", "bubble popper"],
    search: "killalure flatz ratz",
  },
  {
    keywords: ["stickbait", "stick bait", "pencil", "walk-the-dog"],
    search: "raptor lure",
  },
  {
    keywords: ["jig", "slow pitch", "knife jig", "metal jig"],
    search: "killalure barrabait",
  },
  {
    keywords: ["soft plastic", "paddletail", "curl tail", "grub"],
    search: "killer prawn soft plastic",
  },
  {
    keywords: ["metal slug", "chrome", "casting", "slug", "spoon"],
    search: "bomber bling",
  },
  {
    keywords: ["rapala", "x-rap", "flat rap"],
    search: "rapala flat rap",
  },
  {
    keywords: ["killalure", "terminator", "barrabait"],
    search: "killalure",
  },
  {
    keywords: ["reidy", "reidys"],
    search: "reidys custom",
  },
];

function resolveSearch(lureSuggestion: string): string {
  const lower = lureSuggestion.toLowerCase();
  for (const row of LURE_KEYWORD_MAP) {
    if (row.keywords.some((k) => lower.includes(k))) {
      return row.search;
    }
  }
  return lureSuggestion;
}

router.get("/lure-search", async (req, res) => {
  const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
  if (!q) {
    res.status(400).json({ error: "q is required" });
    return;
  }

  try {
    // Try exact search first, then mapped search
    let products = await searchCraigs(q);
    if (products.length === 0) {
      const mappedSearch = resolveSearch(q);
      if (mappedSearch !== q) {
        products = await searchCraigs(mappedSearch);
      }
    }

    res.json({
      query: q,
      products: products.slice(0, 4),
      searchUrl: `${CRAIGS_BASE}/?s=${encodeURIComponent(resolveSearch(q))}&post_type=product`,
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch Craig's products" });
  }
});

export default router;
