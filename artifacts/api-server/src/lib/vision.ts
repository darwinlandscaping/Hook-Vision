/**
 * Vision Library — TensorFlow.js · OpenCV WASM · ONNX Runtime
 * Wired into the analyze route for sonar pre-processing.
 */

import * as tf from "@tensorflow/tfjs";
import * as ort from "onnxruntime-node";

// ─── Lazy singletons ─────────────────────────────────────────────────────────

let _tf: typeof tf | null = null;
let _cv: any | null = null;
let _ort: typeof ort | null = null;
let _initialised = false;
let _initPromise: Promise<void> | null = null;

export interface VisionLibs {
  tf: typeof tf;
  cv: any;
  ort: typeof ort;
}

export async function getVision(): Promise<VisionLibs> {
  if (_initialised) return { tf: _tf!, cv: _cv!, ort: _ort! };

  if (_initPromise) {
    await _initPromise;
    return { tf: _tf!, cv: _cv!, ort: _ort! };
  }

  _initPromise = (async () => {
    _tf = tf;
    await _tf.ready();

    try {
      const mod = await import("opencv-wasm");
      _cv = await (mod as any).default;
    } catch (e) {
      console.warn("[vision] OpenCV WASM unavailable:", (e as Error).message);
      _cv = null;
    }

    _ort = ort;
    _initialised = true;
    console.log(`[vision] ready — tf:${_tf.version} cv:${_cv ? "ok" : "n/a"} ort:${_ort.env.versions.node}`);
  })();

  await _initPromise;
  return { tf: _tf!, cv: _cv!, ort: _ort! };
}

// ─── Sonar image pre-scan ────────────────────────────────────────────────────

export interface SonarScan {
  meanBrightness: number;       // 0–255
  brightPixelPct: number;       // % pixels above 200 brightness (strong echoes)
  redDominance: number;         // 0–1 — red channel fraction (Lowrance-style)
  blueDominance: number;        // 0–1 — blue channel fraction (Deeper/Garmin)
  topBrightRegions: Array<{
    xFrac: number;
    yFrac: number;
    size: number;
  }>;
  sonarPaletteCue: string;      // "warm-red" | "cool-blue" | "teal-green" | "neutral"
  echoStrength: string;         // "strong" | "moderate" | "weak"
  candidateArchCount: number;   // rough count of bright blobs
}

/**
 * Analyse a sonar JPEG (base64) using TF.js + OpenCV.
 * Returns structured metadata that is injected into the GPT prompt as
 * calibration ground truth — helping the model read arch brightness and
 * target positions more accurately.
 *
 * Runs in ~50–120 ms on the API server before the GPT streaming call begins.
 */
export async function analyzeSonarImage(jpegBase64: string): Promise<SonarScan | null> {
  try {
    const { tf: t, cv } = await getVision();

    // ── Decode JPEG → raw RGBA via jpeg-js ───────────────────────────────
    const jpegModule = await import("jpeg-js");
    const jpegBuf = Buffer.from(jpegBase64, "base64");
    const decoded = jpegModule.default.decode(jpegBuf, { useTArray: true, formatAsRGBA: true });
    const { width, height, data: rgba } = decoded;
    const pixelCount = width * height;

    // ── Build TF.js tensor [H, W, 3] ─────────────────────────────────────
    const rgb = new Uint8Array(pixelCount * 3);
    for (let i = 0; i < pixelCount; i++) {
      rgb[i * 3]     = rgba[i * 4];
      rgb[i * 3 + 1] = rgba[i * 4 + 1];
      rgb[i * 3 + 2] = rgba[i * 4 + 2];
    }

    const imgTensor = t.tensor3d(rgb, [height, width, 3], "float32");
    const normalised = imgTensor.div(255);

    // Per-channel means
    const channelMeans = normalised.mean([0, 1]) as tf.Tensor1D;
    const [rMean, gMean, bMean] = Array.from(await channelMeans.data());

    // Luminance tensor (grayscale ITU-R 601)
    const weights = t.tensor1d([0.299, 0.587, 0.114]);
    const lumTensor = (normalised as tf.Tensor3D).mul(weights).sum(2) as tf.Tensor2D;
    const meanLum = await (lumTensor.mean() as tf.Scalar).data();
    const meanBrightness = meanLum[0] * 255;

    // Bright pixel percentage (lum > 0.78 ≈ value > 200)
    const brightMask = lumTensor.greater(t.scalar(0.78));
    const brightCount = await (brightMask.sum() as tf.Scalar).data();
    const brightPixelPct = (brightCount[0] / pixelCount) * 100;

    // Total channel sum for dominance fractions
    const channelSum = rMean + gMean + bMean || 1;
    const redDominance  = rMean / channelSum;
    const blueDominance = bMean / channelSum;

    // ── OpenCV blob detection (if available) ─────────────────────────────
    let topBrightRegions: SonarScan["topBrightRegions"] = [];
    let candidateArchCount = 0;

    if (cv) {
      try {
        // Build 3-channel mat
        const bgrData = new Uint8Array(pixelCount * 3);
        for (let i = 0; i < pixelCount; i++) {
          bgrData[i * 3]     = rgba[i * 4 + 2]; // B
          bgrData[i * 3 + 1] = rgba[i * 4 + 1]; // G
          bgrData[i * 3 + 2] = rgba[i * 4];     // R
        }
        const mat = cv.matFromArray(height, width, cv.CV_8UC3, bgrData);

        // Grayscale → threshold → connected components
        const gray = new cv.Mat();
        cv.cvtColor(mat, gray, cv.COLOR_BGR2GRAY);

        const thresh = new cv.Mat();
        cv.threshold(gray, thresh, 200, 255, cv.THRESH_BINARY);

        const labels  = new cv.Mat();
        const stats   = new cv.Mat();
        const cents   = new cv.Mat();
        const n = cv.connectedComponentsWithStats(thresh, labels, stats, cents);

        candidateArchCount = Math.max(0, n - 1); // exclude background label

        for (let i = 1; i < Math.min(n, 12); i++) {
          const area = stats.intAt(i, cv.CC_STAT_AREA);
          if (area < 30) continue;
          topBrightRegions.push({
            xFrac: +(cents.doubleAt(i, 0) / width).toFixed(3),
            yFrac: +(cents.doubleAt(i, 1) / height).toFixed(3),
            size: area,
          });
        }
        // Sort largest first
        topBrightRegions.sort((a, b) => b.size - a.size);
        topBrightRegions = topBrightRegions.slice(0, 8);

        mat.delete(); gray.delete(); thresh.delete();
        labels.delete(); stats.delete(); cents.delete();
      } catch (cvErr) {
        console.warn("[vision] OpenCV blob detection skipped:", (cvErr as Error).message);
      }
    }

    // Cleanup TF tensors
    imgTensor.dispose(); normalised.dispose();
    channelMeans.dispose(); weights.dispose();
    lumTensor.dispose(); brightMask.dispose();

    // ── Derive human-readable cues ────────────────────────────────────────
    let sonarPaletteCue: string;
    if (redDominance > 0.38)       sonarPaletteCue = "warm-red";   // Lowrance
    else if (blueDominance > 0.38)  sonarPaletteCue = "cool-blue";  // Garmin / Deeper
    else if (gMean > rMean * 1.1)   sonarPaletteCue = "teal-green"; // Humminbird
    else                             sonarPaletteCue = "neutral";

    const echoStrength =
      meanBrightness > 140 ? "strong" :
      meanBrightness > 90  ? "moderate" : "weak";

    return {
      meanBrightness: +meanBrightness.toFixed(1),
      brightPixelPct: +brightPixelPct.toFixed(2),
      redDominance:   +redDominance.toFixed(3),
      blueDominance:  +blueDominance.toFixed(3),
      topBrightRegions,
      sonarPaletteCue,
      echoStrength,
      candidateArchCount,
    };
  } catch (err) {
    console.error("[vision] analyzeSonarImage failed:", err);
    return null;
  }
}

/**
 * Format a SonarScan as a compact text block to inject into the GPT prompt.
 */
export function formatCvContext(scan: SonarScan): string {
  const blobSummary = scan.topBrightRegions.length
    ? scan.topBrightRegions
        .map((b, i) => `  #${i + 1}: x=${b.xFrac} y=${b.yFrac} area=${b.size}px`)
        .join("\n")
    : "  none detected";

  return `
═══ CV PRE-SCAN (TF.js + OpenCV — measured pixel data) ═══
Mean brightness : ${scan.meanBrightness}/255 (echo strength: ${scan.echoStrength})
Strong-echo %   : ${scan.brightPixelPct}% pixels above threshold
Palette cue     : ${scan.sonarPaletteCue} → R=${scan.redDominance.toFixed(2)} B=${scan.blueDominance.toFixed(2)}
Candidate arches: ${scan.candidateArchCount} bright blobs found
Top bright regions (x/y as fraction of image, 0=top-left):
${blobSummary}
USE these positions to cross-reference arch locations with depth scale. Strong arches at low yFrac = shallow; high yFrac = deeper.`.trim();
}

// ─── Status check ─────────────────────────────────────────────────────────────

export async function visionStatus() {
  const { tf: t, cv, ort: o } = await getVision();
  return {
    tensorflow: `${t.version} (backend: ${t.getBackend()})`,
    opencv: cv ? "ready" : "unavailable",
    onnxRuntime: o.env.versions.node ?? "n/a",
  };
}

// ─── YOLO stub ────────────────────────────────────────────────────────────────

export async function runYolo(
  modelPath: string,
  _imageBuffer: Buffer,
  _confidenceThreshold = 0.4,
  _labels: string[] = []
) {
  const { ort: o } = await getVision();
  const session = await o.InferenceSession.create(modelPath, { executionProviders: ["cpu"] });
  console.log(`[vision/yolo] session ready — inputs: ${session.inputNames[0]}`);
  return [];
}
