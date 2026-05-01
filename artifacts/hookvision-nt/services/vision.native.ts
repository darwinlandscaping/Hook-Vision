/**
 * Vision Service — on-device sonar pre-scan
 *
 * Strategy (reliable on Expo Go, low memory):
 *  1. Resize the sonar image to a 96 px thumbnail via expo-image-manipulator
 *  2. Decode the tiny JPEG with @tensorflow/tfjs-react-native (jpeg-js, pure JS)
 *  3. Compute brightness / colour / echo-strength stats from the small tensor
 *
 * Processing a 96 px thumbnail uses ~0.1 MB instead of ~25 MB for a full
 * 1080 × 2400 photo — avoiding OOM errors and TF.js initialisation races.
 */

import { manipulateAsync, SaveFormat } from "expo-image-manipulator";
import * as tf from "@tensorflow/tfjs";
import "@tensorflow/tfjs-react-native";

// ─── Lazy TF.js singleton ──────────────────────────────────────────────────────

let _ready = false;
let _initPromise: Promise<void> | null = null;

export interface VisionService { tf: typeof tf; }

export async function getVision(): Promise<VisionService> {
  if (_ready) return { tf };
  if (_initPromise) { await _initPromise; return { tf }; }
  _initPromise = tf.ready().then(() => {
    _ready = true;
    console.log(`[vision] TF.js ready — backend: ${tf.getBackend()}`);
  });
  await _initPromise;
  return { tf };
}

// ─── Exported interface ────────────────────────────────────────────────────────

export interface MobileSonarScan {
  meanBrightness: number;
  brightPixelPct: number;
  dominantChannel: "R" | "G" | "B";
  paletteCue: string;
  echoStrength: string;
  tensorShape: [number, number, number];
  backendUsed: string;
}

/**
 * Analyse a sonar image URI and return brightness / colour cues.
 * Accepts the file URI (not base64) so expo-image-manipulator can resize it.
 * Typically completes in 200–500 ms on modern phones.
 */
export async function quickScan(imageUri: string): Promise<MobileSonarScan | null> {
  try {
    // ── Step 1: resize to a tiny thumbnail ───────────────────────────────
    const thumb = await manipulateAsync(
      imageUri,
      [{ resize: { width: 96 } }],
      { format: SaveFormat.JPEG, base64: true, compress: 0.9 },
    );
    if (!thumb.base64) return null;

    // ── Step 2: decode thumbnail bytes → tensor ───────────────────────────
    const { tf: t } = await getVision();
    const { decodeJpeg } = await import("@tensorflow/tfjs-react-native");

    const binaryStr = atob(thumb.base64);
    const bytes = new Uint8Array(binaryStr.length);
    for (let i = 0; i < binaryStr.length; i++) bytes[i] = binaryStr.charCodeAt(i);

    const rawTensor = decodeJpeg(bytes, 3);
    const [height, width] = rawTensor.shape as [number, number, number];

    const img = rawTensor.cast("float32").div(255) as tf.Tensor3D;
    rawTensor.dispose();

    // ── Step 3: channel means ─────────────────────────────────────────────
    const channelMeans = img.mean([0, 1]) as tf.Tensor1D;
    const [rMean, gMean, bMean] = Array.from(await channelMeans.data());
    channelMeans.dispose();

    // ── Step 4: luminance + bright-pixel count ────────────────────────────
    const weights   = t.tensor1d([0.299, 0.587, 0.114]);
    const lumTensor = img.mul(weights).sum(2) as tf.Tensor2D;
    weights.dispose();
    img.dispose();

    const meanLumArr = await (lumTensor.mean() as tf.Scalar).data();
    const meanBrightness = meanLumArr[0] * 255;

    const brightMask  = lumTensor.greater(t.scalar(0.78));
    const brightCount = await (brightMask.sum() as tf.Scalar).data();
    lumTensor.dispose();
    brightMask.dispose();

    const brightPixelPct = (brightCount[0] / (width * height)) * 100;

    // ── Step 5: derived cues ──────────────────────────────────────────────
    let dominantChannel: "R" | "G" | "B" = "G";
    const chMax = Math.max(rMean, gMean, bMean) || 1;
    if (rMean === chMax) dominantChannel = "R";
    else if (bMean === chMax) dominantChannel = "B";

    const total = rMean + gMean + bMean || 1;
    let paletteCue: string;
    if (rMean / total > 0.38)         paletteCue = "warm-red";   // Lowrance
    else if (bMean / total > 0.38)    paletteCue = "cool-blue";  // Garmin / Deeper
    else if (gMean > rMean * 1.1)     paletteCue = "teal-green"; // Humminbird
    else                              paletteCue = "neutral";

    const echoStrength =
      meanBrightness > 140 ? "strong" :
      meanBrightness > 90  ? "moderate" : "weak";

    return {
      meanBrightness:  +meanBrightness.toFixed(1),
      brightPixelPct:  +brightPixelPct.toFixed(2),
      dominantChannel,
      paletteCue,
      echoStrength,
      tensorShape:     [height, width, 3],
      backendUsed:     t.getBackend(),
    };
  } catch (err) {
    console.warn("[vision] quickScan failed:", err);
    return null;
  }
}

export function visionStatusSync(): string {
  if (!_ready) return "warming up…";
  return `TF.js ${tf.version} · ${tf.getBackend()}`;
}
