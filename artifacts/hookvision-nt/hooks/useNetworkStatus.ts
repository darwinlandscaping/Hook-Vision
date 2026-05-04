import { useEffect, useRef, useState } from "react";

const DOMAIN     = process.env.EXPO_PUBLIC_DOMAIN;
const HEALTH_URL = DOMAIN ? `https://${DOMAIN}/api/healthz` : null;

const CAMERA_IPS = [
  "http://192.168.42.1",
  "http://10.5.5.9:8080",
  "http://192.168.2.1",
  "http://192.168.4.1",
];

// Adaptive polling intervals:
//   healthy  → every 30 s  (quiet, low noise)
//   first miss → 3 s       (fast recheck before declaring offline)
//   offline  → every 3 s   (aggressive retry for fast recovery)
const INTERVAL_HEALTHY = 30_000;
const INTERVAL_RETRY   =  3_000;

async function pingUrl(url: string, timeoutMs: number): Promise<boolean> {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeoutMs);
    await fetch(url, { method: "HEAD", signal: ctrl.signal });
    clearTimeout(t);
    return true;
  } catch {
    return false;
  }
}

export function useNetworkStatus() {
  const [isOnline,       setIsOnline]       = useState(true);
  const [cameraWifiMode, setCameraWifiMode] = useState(false);
  const failStreak   = useRef(0);
  const timerRef     = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cancelledRef = useRef(false);

  useEffect(() => {
    cancelledRef.current = false;

    const scheduleNext = (delayMs: number) => {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(check, delayMs);
    };

    const check = async () => {
      if (!HEALTH_URL || cancelledRef.current) return;

      const apiOk = await pingUrl(HEALTH_URL, 8_000);
      if (cancelledRef.current) return;

      if (apiOk) {
        failStreak.current = 0;
        setIsOnline(true);
        setCameraWifiMode(false);
        scheduleNext(INTERVAL_HEALTHY);
        return;
      }

      failStreak.current += 1;

      if (failStreak.current < 2) {
        // First miss — recheck quickly before showing the banner
        scheduleNext(INTERVAL_RETRY);
        return;
      }

      const cameraOk = await Promise.any(
        CAMERA_IPS.map(ip =>
          pingUrl(ip, 1500).then(ok => { if (!ok) throw new Error(); return ok; })
        )
      ).catch(() => false);

      if (!cancelledRef.current) {
        setIsOnline(false);
        setCameraWifiMode(!!cameraOk);
        scheduleNext(INTERVAL_RETRY); // retry aggressively until back online
      }
    };

    check();
    return () => {
      cancelledRef.current = true;
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  return { isOnline, cameraWifiMode };
}
