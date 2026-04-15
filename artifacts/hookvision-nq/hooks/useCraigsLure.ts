import { useEffect, useState } from "react";

export interface CraigsProduct {
  name: string;
  imageUrl: string;
  productUrl: string;
  price: string | null;
}

export interface CraigsResult {
  products: CraigsProduct[];
  searchUrl: string;
}

const cache = new Map<string, CraigsResult>();

export function useCraigsLure(
  lureText: string | undefined,
  lureType?: string | undefined
): {
  result: CraigsResult | null;
  loading: boolean;
} {
  const [result, setResult] = useState<CraigsResult | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!lureText && !lureType) return;

    const cacheKey = `${lureType ?? ""}|${lureText ?? ""}`;
    const cached = cache.get(cacheKey);
    if (cached) {
      setResult(cached);
      return;
    }

    setLoading(true);
    const domain = process.env.EXPO_PUBLIC_DOMAIN;
    const baseUrl = domain ? `https://${domain}` : "";

    const params = new URLSearchParams();
    if (lureText) params.set("q", lureText.trim());
    if (lureType) params.set("lureType", lureType.trim());

    fetch(`${baseUrl}/api/lure-search?${params.toString()}`)
      .then((r) => r.json())
      .then((data: CraigsResult) => {
        cache.set(cacheKey, data);
        setResult(data);
      })
      .catch(() => {
        const q = lureText ?? lureType ?? "";
        const fallback: CraigsResult = {
          products: [],
          searchUrl: `https://craigsfishingwarehouse.com.au/?s=${encodeURIComponent(q)}&post_type=product`,
        };
        cache.set(cacheKey, fallback);
        setResult(fallback);
      })
      .finally(() => setLoading(false));
  }, [lureText, lureType]);

  return { result, loading };
}
