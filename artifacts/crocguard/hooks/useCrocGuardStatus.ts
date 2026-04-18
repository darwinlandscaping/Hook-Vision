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

const ONLINE_INTERVAL = 2_000;
const OFFLINE_INTERVAL = 5_000;

export function useCrocGuardStatus(apiBaseUrl: string): UseStatusResult {
  const [data, setData] = useState<CrocStatus | null>(null);
  const [isOffline, setIsOffline] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [prevStatus, setPrevStatus] = useState<TrafficLight | null>(null);
  const prevStatusRef = useRef<TrafficLight | null>(null);
  const isOfflineRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const poll = useCallback(async () => {
    try {
      const res = await fetch(`${apiBaseUrl}/api/crocguard/status`, {
        signal: AbortSignal.timeout(4000),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as CrocStatus & { ok: boolean };
      isOfflineRef.current = false;
      setIsOffline(false);
      setData(json);
      setLastUpdated(new Date());
      if (prevStatusRef.current !== json.status) {
        setPrevStatus(prevStatusRef.current);
        prevStatusRef.current = json.status;
      }
    } catch {
      isOfflineRef.current = true;
      setIsOffline(true);
    }
  }, [apiBaseUrl]);

  const schedule = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(async () => {
      await poll();
      schedule();
    }, isOfflineRef.current ? OFFLINE_INTERVAL : ONLINE_INTERVAL);
  }, [poll]);

  useEffect(() => {
    poll().then(schedule);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [poll, schedule]);

  return { data, isOffline, lastUpdated, prevStatus };
}
