import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Location from "expo-location";

export interface DepthPoint {
  lat: number;
  lng: number;
  depth: number;
  fishCount: number;
  timestamp: number;
}

export interface RiverScanEntry {
  id: string;
  startTime: number;
  endTime: number;
  duration: number;
  locationName?: string;
  points: DepthPoint[];
  maxDepth: number;
  minDepth: number;
  totalFish: number;
  bbox: { minLat: number; maxLat: number; minLng: number; maxLng: number };
}

interface RiverScanContextValue {
  scans: RiverScanEntry[];
  addScan: (scan: RiverScanEntry) => void;
  removeScan: (id: string) => void;
  clearScans: () => void;
  autoScanActive: boolean;
  startAutoScan: () => void;
  feedDepthReading: (depthStr: string, fishCount: number) => void;
  endAutoScan: () => void;
}

const RiverScanContext = createContext<RiverScanContextValue>({
  scans: [],
  addScan: () => {},
  removeScan: () => {},
  clearScans: () => {},
  autoScanActive: false,
  startAutoScan: () => {},
  feedDepthReading: () => {},
  endAutoScan: () => {},
});

const STORAGE_KEY = "hookvision_river_scans";

function parseDepth(s: string): number | null {
  if (!s || s === "unknown" || s === "—" || s === "-") return null;
  const single = s.match(/(\d+\.?\d*)\s*m/i);
  if (single) return parseFloat(single[1]);
  const range = s.match(/(\d+\.?\d*)\s*[-–]\s*(\d+\.?\d*)/);
  if (range) return (parseFloat(range[1]) + parseFloat(range[2])) / 2;
  const num = parseFloat(s);
  return isNaN(num) ? null : num;
}

export function buildScanEntry(
  id: string,
  startTime: number,
  points: DepthPoint[],
  locationName?: string,
): RiverScanEntry {
  if (points.length === 0) {
    return {
      id, startTime, endTime: Date.now(), duration: 0,
      locationName, points: [], maxDepth: 0, minDepth: 0, totalFish: 0,
      bbox: { minLat: 0, maxLat: 0, minLng: 0, maxLng: 0 },
    };
  }
  const endTime = Date.now();
  const depths = points.map((p) => p.depth);
  const lats = points.map((p) => p.lat);
  const lngs = points.map((p) => p.lng);
  return {
    id, startTime, endTime,
    duration: Math.round((endTime - startTime) / 1000),
    locationName,
    points,
    maxDepth: Math.max(...depths),
    minDepth: Math.min(...depths),
    totalFish: points.reduce((s, p) => s + p.fishCount, 0),
    bbox: {
      minLat: Math.min(...lats), maxLat: Math.max(...lats),
      minLng: Math.min(...lngs), maxLng: Math.max(...lngs),
    },
  };
}

export function RiverScanProvider({ children }: { children: React.ReactNode }) {
  const [scans, setScans] = useState<RiverScanEntry[]>([]);
  const [autoScanActive, setAutoScanActive] = useState(false);

  const autoActiveRef   = useRef(false);
  const autoPointsRef   = useRef<DepthPoint[]>([]);
  const autoStartRef    = useRef<number>(0);
  const currentPosRef   = useRef<{ lat: number; lng: number } | null>(null);
  const locationSubRef  = useRef<Location.LocationSubscription | null>(null);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((raw) => {
      if (raw) {
        try { setScans(JSON.parse(raw) as RiverScanEntry[]); } catch {}
      }
    });
  }, []);

  const persist = useCallback((entries: RiverScanEntry[]) => {
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(entries)).catch(() => {});
  }, []);

  const addScan = useCallback((scan: RiverScanEntry) => {
    setScans((prev) => {
      const next = [scan, ...prev].slice(0, 30);
      persist(next);
      return next;
    });
  }, [persist]);

  const removeScan = useCallback((id: string) => {
    setScans((prev) => {
      const next = prev.filter((s) => s.id !== id);
      persist(next);
      return next;
    });
  }, [persist]);

  const clearScans = useCallback(() => {
    setScans([]);
    AsyncStorage.removeItem(STORAGE_KEY).catch(() => {});
  }, []);

  const startAutoScan = useCallback(async () => {
    if (autoActiveRef.current) return;
    autoActiveRef.current = true;
    autoPointsRef.current = [];
    autoStartRef.current = Date.now();
    currentPosRef.current = null;
    setAutoScanActive(true);

    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") return;
      locationSubRef.current = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.Balanced, distanceInterval: 5 },
        (loc) => {
          currentPosRef.current = { lat: loc.coords.latitude, lng: loc.coords.longitude };
        },
      );
    } catch {}
  }, []);

  const feedDepthReading = useCallback((depthStr: string, fishCount: number) => {
    if (!autoActiveRef.current) return;
    const depth = parseDepth(depthStr);
    if (depth === null || depth <= 0) return;
    const pos = currentPosRef.current;
    if (!pos) return;
    autoPointsRef.current.push({
      lat: pos.lat,
      lng: pos.lng,
      depth,
      fishCount: Math.max(0, fishCount ?? 0),
      timestamp: Date.now(),
    });
  }, []);

  const endAutoScan = useCallback(() => {
    if (!autoActiveRef.current) return;
    autoActiveRef.current = false;
    setAutoScanActive(false);

    locationSubRef.current?.remove();
    locationSubRef.current = null;

    const pts = autoPointsRef.current;
    autoPointsRef.current = [];

    if (pts.length >= 2) {
      const scan = buildScanEntry(`rscan_auto_${Date.now()}`, autoStartRef.current, pts);
      setScans((prev) => {
        const next = [scan, ...prev].slice(0, 30);
        AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch(() => {});
        return next;
      });
    }
  }, []);

  return (
    <RiverScanContext.Provider
      value={{ scans, addScan, removeScan, clearScans, autoScanActive, startAutoScan, feedDepthReading, endAutoScan }}
    >
      {children}
    </RiverScanContext.Provider>
  );
}

export function useRiverScans() {
  return useContext(RiverScanContext);
}
