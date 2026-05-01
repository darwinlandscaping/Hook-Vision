/**
 * Vision Service — Web stub
 * Metro uses vision.native.ts on Android/iOS; this file covers the web preview only.
 * All functions are no-ops that return null/false so the UI degrades gracefully.
 */

export interface MobileSonarScan {
  meanBrightness: number;
  brightPixelPct: number;
  dominantChannel: "R" | "G" | "B";
  paletteCue: string;
  echoStrength: string;
  tensorShape: [number, number, number];
  backendUsed: string;
}

export async function getVision() {
  return { tf: null };
}

export async function quickScan(_imageUri: string): Promise<MobileSonarScan | null> {
  return null;
}

export function visionStatusSync(): string {
  return "web (no cv)";
}
