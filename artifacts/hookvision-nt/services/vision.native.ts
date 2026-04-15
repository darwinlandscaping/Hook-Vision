/**
 * Vision Service — TensorFlow.js + React Native
 * Wired into the Analyze screen for on-device sonar pre-scan.
 *
 * Capabilities:
 *  • Pre-warms the TF.js RN backend in the background on screen mount
 *  • Decodes a JPEG base64 string → tensor via @tensorflow/tfjs-react-native
 *  • Runs brightness / colour / echo-strength analysis entirely on-device
 *  • COCO-SSD detection is available via getVision() when a GL context is ready
 */

import * as tf from "@tensorflow/tfjs";
import "@tensorflow/tfjs-react-native";

// ─── Lazy singleton ───────────────────────────────────────────────────────────

let _ready = false;
let _initPromise: Promise<void> | null = null;

export interface VisionService {
  tf: typeof tf;
}

/**
 * Pre-warm the TF.js React Native backend.
 * Call once on screen mount — safe to call multiple times (no-op after first).
 */
export async function getVision(): Promise<VisionService> {
  if (_ready) return { tf };

  if (_initPromise) {
    await _initPromise;
    return { tf };
  }

  _initPromise = tf.ready().then(() => {
    _ready = true;
    console.log(`[vision] TF.js ready — backend: ${tf.getBackend()}`);
  });

  await _initPromise;
  return { tf };
}

// ─── On-device sonar pre-scan ─────────────────────────────────────────────────

export interface MobileSonarScan {
  meanBrightness: number;       // 0–255
  brightPixelPct: number;       // % pixels strongly lit
  dominantChannel: "R" | "G" | "B";
  paletteCue: string;           // "warm-red" | "cool-blue" | "teal-green" | "neutral"
  echoStrength: string;         // "strong" | "moderate" | "weak"
  tensorShape: [number, number, number];
  backendUsed: string;
}

/**
 * Decode a JPEG base64 string and run fast TF.js statistics on it.
 * Returns brightness, colour profile, and echo-strength cues.
 *
 * Used by the Analyze screen to display a "CV Pre-scan" panel while the
 * GPT-4.1 request is in flight.
 */
export async function quickScan(jpegBase64: string): Promise<MobileSonarScan | null> {
  try {
    const { tf: t } = await getVision();

    // ── Decode JPEG bytes → TF.js tensor ─────────────────────────────────
    // @tensorflow/tfjs-react-native exports decodeJpeg which uses the
    // platform's native image decoder (no GL context required).
    const { decodeJpeg } = await import("@tensorflow/tfjs-react-native");

    // Convert base64 → Uint8Array of raw JPEG bytes
    const binaryStr = atob(jpegBase64);
    const bytes = new Uint8Array(binaryStr.length);
    for (let i = 0; i < binaryStr.length; i++) {
      bytes[i] = binaryStr.charCodeAt(i);
    }

    // Decode JPEG → [H, W, 3] uint8 tensor
    const rawTensor = decodeJpeg(bytes, 3);
    const [height, width] = rawTensor.shape as [number, number, number];

    // Normalise to [0,1] float32 for math operations
    const img = rawTensor.cast("float32").div(255) as tf.Tensor3D;
    rawTensor.dispose();

    // ── Channel means ─────────────────────────────────────────────────────
    const channelMeans = img.mean([0, 1]) as tf.Tensor1D;
    const [rMean, gMean, bMean] = Array.from(await channelMeans.data());
    channelMeans.dispose();

    // ── Luminance ─────────────────────────────────────────────────────────
    const weights   = t.tensor1d([0.299, 0.587, 0.114]);
    const lumTensor = img.mul(weights).sum(2) as tf.Tensor2D;
    weights.dispose();
    img.dispose();

    const meanLumArr  = await (lumTensor.mean() as tf.Scalar).data();
    const meanBrightness = meanLumArr[0] * 255;

    const brightMask  = lumTensor.greater(t.scalar(0.78));
    const brightCount = await (brightMask.sum() as tf.Scalar).data();
    lumTensor.dispose();
    brightMask.dispose();

    const brightPixelPct = (brightCount[0] / (width * height)) * 100;

    // ── Derived cues ──────────────────────────────────────────────────────
    const channelMax = Math.max(rMean, gMean, bMean) || 1;
    let dominantChannel: "R" | "G" | "B" = "G";
    if (rMean === channelMax) dominantChannel = "R";
    else if (bMean === channelMax) dominantChannel = "B";

    const total = rMean + gMean + bMean || 1;
    const rFrac = rMean / total;
    const bFrac = bMean / total;

    let paletteCue: string;
    if (rFrac > 0.38)       paletteCue = "warm-red";   // Lowrance
    else if (bFrac > 0.38)  paletteCue = "cool-blue";  // Garmin / Deeper
    else if (gMean > rMean * 1.1) paletteCue = "teal-green"; // Humminbird
    else                    paletteCue = "neutral";

    const echoStrength =
      meanBrightness > 140 ? "strong" :
      meanBrightness > 90  ? "moderate" : "weak";

    return {
      meanBrightness: +meanBrightness.toFixed(1),
      brightPixelPct: +brightPixelPct.toFixed(2),
      dominantChannel,
      paletteCue,
      echoStrength,
      tensorShape: [height, width, 3],
      backendUsed: t.getBackend(),
    };
  } catch (err) {
    console.warn("[vision] quickScan failed:", err);
    return null;
  }
}

/**
 * Returns a one-line status string — safe to call before tf.ready().
 */
export function visionStatusSync(): string {
  if (!_ready) return "warming up…";
  return `TF.js ${tf.version} · ${tf.getBackend()}`;
}
