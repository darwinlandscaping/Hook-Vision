import { useCallback, useEffect, useRef, useState } from "react";

export type TrafficLight = "green" | "orange" | "red";

export interface CrocStatus {
  status: TrafficLight;
  confidence: number;
  source: string | null;
  timestamp: string;
}

export interface UseStatusResult {
  data: CrocStatus | null;
  isOffline: boolean;
  lastUpdated: Date | null;
  prevStatus: TrafficLight | null;
}

export function useCrocGuardStatus(apiBaseUrl: string): UseStatusResult {
  const [data, setData] = useState<CrocStatus | null>(null);
  const [isOffline, setIsOffline] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [prevStatus, setPrevStatus] = useState<TrafficLight | null>(null);
  const prevStatusRef = useRef<TrafficLight | null>(null);

  const poll = useCallback(async () => {
    try {
      const res = await fetch(`${apiBaseUrl}/api/crocguard/status`, {
        signal: AbortSignal.timeout(5000),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as CrocStatus & { ok: boolean };
      setIsOffline(false);
      setData(json);
      setLastUpdated(new Date());
      if (prevStatusRef.current !== json.status) {
        setPrevStatus(prevStatusRef.current);
        prevStatusRef.current = json.status;
      }
    } catch {
      setIsOffline(true);
    }
  }, [apiBaseUrl]);

  useEffect(() => {
    poll();
    const id = setInterval(poll, 2000);
    return () => clearInterval(id);
  }, [poll]);

  return { data, isOffline, lastUpdated, prevStatus };
}
