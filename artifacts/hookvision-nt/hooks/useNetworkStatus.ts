import { useEffect, useState } from "react";

const DOMAIN     = process.env.EXPO_PUBLIC_DOMAIN;
const HEALTH_URL = DOMAIN ? `https://${DOMAIN}/api/healthz` : null;

// Known camera WiFi gateway IPs — these respond when phone is on a camera hotspot
const CAMERA_IPS = [
  "http://192.168.42.1",   // Insta360
  "http://10.5.5.9:8080",  // GoPro
  "http://192.168.2.1",    // DJI Osmo
  "http://192.168.4.1",    // SmartLife
];

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

  useEffect(() => {
    let cancelled = false;

    const check = async () => {
      if (!HEALTH_URL) return;

      const apiOk = await pingUrl(HEALTH_URL, 3000);
      if (cancelled) return;

      if (apiOk) {
        setIsOnline(true);
        setCameraWifiMode(false);
        return;
      }

      const cameraChecks = await Promise.any(
        CAMERA_IPS.map(ip => pingUrl(ip, 1500).then(ok => { if (!ok) throw new Error(); return ok; }))
      ).catch(() => false);

      if (!cancelled) {
        setIsOnline(false);
        setCameraWifiMode(!!cameraChecks);
      }
    };

    check();
    const id = setInterval(check, 15000);
    return () => { cancelled = true; clearInterval(id); };
  }, []);

  return { isOnline, cameraWifiMode };
}
