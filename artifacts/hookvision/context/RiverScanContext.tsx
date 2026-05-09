import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

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
}

const RiverScanContext = createContext<RiverScanContextValue>({
  scans: [],
  addScan: () => {},
  removeScan: () => {},
  clearScans: () => {},
});

const STORAGE_KEY = "hookvision_river_scans";

export function RiverScanProvider({ children }: { children: React.ReactNode }) {
  const [scans, setScans] = useState<RiverScanEntry[]>([]);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((raw) => {
      if (raw) {
        try {
          setScans(JSON.parse(raw) as RiverScanEntry[]);
        } catch {}
      }
    });
  }, []);

  const persist = useCallback((entries: RiverScanEntry[]) => {
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(entries)).catch(() => {});
  }, []);

  const addScan = useCallback(
    (scan: RiverScanEntry) => {
      setScans((prev) => {
        const next = [scan, ...prev].slice(0, 30);
        persist(next);
        return next;
      });
    },
    [persist],
  );

  const removeScan = useCallback(
    (id: string) => {
      setScans((prev) => {
        const next = prev.filter((s) => s.id !== id);
        persist(next);
        return next;
      });
    },
    [persist],
  );

  const clearScans = useCallback(() => {
    setScans([]);
    AsyncStorage.removeItem(STORAGE_KEY).catch(() => {});
  }, []);

  return (
    <RiverScanContext.Provider value={{ scans, addScan, removeScan, clearScans }}>
      {children}
    </RiverScanContext.Provider>
  );
}

export function useRiverScans() {
  return useContext(RiverScanContext);
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
