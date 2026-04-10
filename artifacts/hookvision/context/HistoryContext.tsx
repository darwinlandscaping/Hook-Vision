import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { HistoryEntry } from "@/components/HistoryItem";

const HISTORY_KEY = "hookvision_history";

interface HistoryContextValue {
  history: HistoryEntry[];
  addEntry: (entry: HistoryEntry) => void;
  removeEntry: (id: string) => void;
  clearHistory: () => void;
}

const HistoryContext = createContext<HistoryContextValue>({
  history: [],
  addEntry: () => {},
  removeEntry: () => {},
  clearHistory: () => {},
});

export function HistoryProvider({ children }: { children: React.ReactNode }) {
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  useEffect(() => {
    AsyncStorage.getItem(HISTORY_KEY).then((raw) => {
      if (raw) {
        try {
          const parsed = JSON.parse(raw) as HistoryEntry[];
          setHistory(parsed);
        } catch {
          // ignore parse errors
        }
      }
    });
  }, []);

  const persist = useCallback((entries: HistoryEntry[]) => {
    AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(entries)).catch(() => {});
  }, []);

  const addEntry = useCallback(
    (entry: HistoryEntry) => {
      setHistory((prev) => {
        const next = [entry, ...prev].slice(0, 50);
        persist(next);
        return next;
      });
    },
    [persist]
  );

  const removeEntry = useCallback(
    (id: string) => {
      setHistory((prev) => {
        const next = prev.filter((e) => e.id !== id);
        persist(next);
        return next;
      });
    },
    [persist]
  );

  const clearHistory = useCallback(() => {
    setHistory([]);
    AsyncStorage.removeItem(HISTORY_KEY).catch(() => {});
  }, []);

  return (
    <HistoryContext.Provider value={{ history, addEntry, removeEntry, clearHistory }}>
      {children}
    </HistoryContext.Provider>
  );
}

export function useHistory() {
  return useContext(HistoryContext);
}
