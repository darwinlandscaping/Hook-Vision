import { useCallback, useRef } from "react";
import { useFocusEffect } from "expo-router";
import { useNarrator } from "@/context/NarratorContext";

/**
 * Call this in any tab to auto-narrate its key info when hands-free mode is on.
 * getText() is called lazily at focus time so dynamic data (tides, analysis, etc.)
 * is always fresh. A 700ms delay lets the page finish rendering first.
 */
export function useAutoNarrate(getText: () => string) {
  const { autoSpeak } = useNarrator();
  const getTextRef = useRef(getText);
  getTextRef.current = getText;

  useFocusEffect(
    useCallback(() => {
      const id = setTimeout(() => { const t = getTextRef.current(); if (t) autoSpeak(t); }, 700);
      return () => clearTimeout(id);
    }, [autoSpeak])
  );
}
