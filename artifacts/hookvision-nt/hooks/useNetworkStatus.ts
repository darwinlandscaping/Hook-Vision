import { useEffect, useState } from "react";

const DOMAIN = process.env.EXPO_PUBLIC_DOMAIN;
const HEALTH_URL = DOMAIN ? `https://${DOMAIN}/api/healthz` : null;

export function useNetworkStatus() {
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const check = async () => {
      if (!HEALTH_URL) return;
      try {
        const ctrl = new AbortController();
        const t = setTimeout(() => ctrl.abort(), 3000);
        await fetch(HEALTH_URL, { method: "HEAD", signal: ctrl.signal });
        clearTimeout(t);
        if (!cancelled) setIsOnline(true);
      } catch {
        if (!cancelled) setIsOnline(false);
      }
    };

    check();
    const id = setInterval(check, 15000);
    return () => { cancelled = true; clearInterval(id); };
  }, []);

  return { isOnline };
}
