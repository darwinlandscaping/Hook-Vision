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

export function useCraigsLure(lureText: string | undefined): {
  result: CraigsResult | null;
  loading: boolean;
} {
  const [result, setResult] = useState<CraigsResult | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!lureText) return;

    const q = lureText.trim();
    const cached = cache.get(q);
    if (cached) {
      setResult(cached);
      return;
    }

    setLoading(true);
    const domain = process.env.EXPO_PUBLIC_DOMAIN;
    const baseUrl = domain ? `https://${domain}` : "";

    fetch(`${baseUrl}/api/lure-search?q=${encodeURIComponent(q)}`)
      .then((r) => r.json())
      .then((data: CraigsResult) => {
        cache.set(q, data);
        setResult(data);
      })
      .catch(() => {
        const fallback: CraigsResult = {
          products: [],
          searchUrl: `https://craigsfishingwarehouse.com.au/?s=${encodeURIComponent(q)}&post_type=product`,
        };
        cache.set(q, fallback);
        setResult(fallback);
      })
      .finally(() => setLoading(false));
  }, [lureText]);

  return { result, loading };
}
