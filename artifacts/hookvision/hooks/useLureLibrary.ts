import { useMemo } from "react";
import { findBestLure, type LureEntry } from "@/lib/lureLibrary";

/**
 * Instantly resolves a lure entry from the local library.
 * No network call — always returns immediately with the best matching lure.
 */
export function useLureLibrary(
  lureText: string | undefined,
  lureType: string | undefined
): LureEntry | null {
  return useMemo(() => {
    if (!lureText && !lureType) return null;
    return findBestLure(lureText ?? "", lureType);
  }, [lureText, lureType]);
}
