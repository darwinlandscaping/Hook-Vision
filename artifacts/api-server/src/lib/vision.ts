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
  candidateArchCount: number;   // rough count of bright blobs (only valid when opencvAvailable=true)
  opencvAvailable: boolean;     // false = blob detection was NOT run, counts are unreliable
}

/**
 * Analyse a sonar JPEG (base64) using TF.js + OpenCV.
 * Returns structured metadata that is injected into the GPT prompt as
 * calibration ground truth — helping the model read arch brightness and
 * target positions more accurately.
 *
 * Runs in ~50–120 ms on the API server before the GPT streaming call begins.
 */
/** Detect image format from magic bytes */
function detectFormat(buf: Buffer): "jpeg" | "png" | "unknown" {
  if (buf[0] === 0xff && buf[1] === 0xd8) return "jpeg";
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return "png";
  return "unknown";
}

/** Decode any supported image format to raw RGBA */
async function decodeToRGBA(buf: Buffer): Promise<{ width: number; height: number; data: Uint8Array }> {
  const fmt = detectFormat(buf);

  if (fmt === "jpeg") {
    const jpegModule = await import("jpeg-js");
    const decoded = jpegModule.default.decode(buf, { useTArray: true, formatAsRGBA: true });
    return { width: decoded.width, height: decoded.height, data: decoded.data as Uint8Array };
  }

  if (fmt === "png") {
    // Sync PNG decode via pngjs
    const { PNG } = await import("pngjs") as any;
    return new Promise((resolve, reject) => {
      const png = new PNG();
      png.parse(buf, (err: Error | null, parsed: any) => {
        if (err) return reject(err);
        resolve({ width: parsed.width, height: parsed.height, data: new Uint8Array(parsed.data) });
      });
    });
  }

  throw new Error(`Unsupported image format (magic: ${buf[0].toString(16)} ${buf[1].toString(16)})`);
}

export async function analyzeSonarImage(imageBase64: string): Promise<SonarScan | null> {
  try {
    const { tf: t, cv } = await getVision();

    // ── Decode JPEG or PNG → raw RGBA ────────────────────────────────────
    const imgBuf = Buffer.from(imageBase64, "base64");
    const { width, height, data: rgba } = await decodeToRGBA(imgBuf);
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
      opencvAvailable: !!cv,
    };
  } catch (err) {
    console.error("[vision] analyzeSonarImage failed:", err);
    return null;
  }
}

// ─── Zoom crop helpers ────────────────────────────────────────────────────────

/** Crop raw RGBA data to a sub-rectangle and re-encode as JPEG base64 */
async function cropToJpegBase64(
  rgba: Uint8Array,
  srcWidth: number,
  srcHeight: number,
  x: number, y: number, cropW: number, cropH: number,
  quality = 92
): Promise<string> {
  const out = new Uint8Array(cropW * cropH * 4);
  for (let row = 0; row < cropH; row++) {
    const srcOff = ((y + row) * srcWidth + x) * 4;
    const dstOff = row * cropW * 4;
    out.set(rgba.subarray(srcOff, srcOff + cropW * 4), dstOff);
  }
  const jpegModule = await import("jpeg-js");
  const encoded = jpegModule.default.encode({ data: out, width: cropW, height: cropH }, quality);
  return Buffer.from(encoded.data).toString("base64");
}

export interface ZoomCrops {
  leftHalf:    string;   // base64 JPEG — left 50% of image
  rightHalf:   string;   // base64 JPEG — right 50% of image
  blobCrop:    string;   // base64 JPEG — tight crop around brightest blob (if found)
  mostActive:  "left" | "right";  // which half has more bright pixels
  blobRegion:  { x: number; y: number; w: number; h: number } | null;
}

/**
 * Generate zoom crops of a sonar image so GPT can inspect regions at high detail.
 * Runs in parallel with analyzeSonarImage — ~40–100 ms extra overhead.
 */
export async function generateZoomCrops(imageBase64: string): Promise<ZoomCrops | null> {
  try {
    const imgBuf = Buffer.from(imageBase64, "base64");
    const { width, height, data: rgba } = await decodeToRGBA(imgBuf);

    const midX = Math.floor(width / 2);

    // ── Count bright pixels per half ───────────────────────────────────────
    let leftBright = 0, rightBright = 0;
    // Track bounding box of all bright pixels for the blob crop
    let bMinX = width, bMinY = height, bMaxX = 0, bMaxY = 0;

    for (let row = 0; row < height; row++) {
      for (let col = 0; col < width; col++) {
        const idx = (row * width + col) * 4;
        const lum = rgba[idx] * 0.299 + rgba[idx + 1] * 0.587 + rgba[idx + 2] * 0.114;
        if (lum > 190) {
          if (col < midX) leftBright++;
          else rightBright++;
          if (col < bMinX) bMinX = col;
          if (col > bMaxX) bMaxX = col;
          if (row < bMinY) bMinY = row;
          if (row > bMaxY) bMaxY = row;
        }
      }
    }

    const mostActive: "left" | "right" = leftBright >= rightBright ? "left" : "right";

    // ── Blob tight crop — pad 12% each side ───────────────────────────────
    let blobCrop: string;
    let blobRegion: ZoomCrops["blobRegion"] = null;
    if (bMaxX > bMinX && bMaxY > bMinY) {
      const padX = Math.floor((bMaxX - bMinX) * 0.12);
      const padY = Math.floor((bMaxY - bMinY) * 0.12);
      const cx = Math.max(0, bMinX - padX);
      const cy = Math.max(0, bMinY - padY);
      const cw = Math.min(width  - cx, (bMaxX - bMinX) + padX * 2);
      const ch = Math.min(height - cy, (bMaxY - bMinY) + padY * 2);
      if (cw > 40 && ch > 40) {
        blobCrop  = await cropToJpegBase64(rgba, width, height, cx, cy, cw, ch);
        blobRegion = { x: cx, y: cy, w: cw, h: ch };
      } else {
        blobCrop = mostActive === "left"
          ? await cropToJpegBase64(rgba, width, height, 0, 0, midX, height)
          : await cropToJpegBase64(rgba, width, height, midX, 0, width - midX, height);
      }
    } else {
      blobCrop = mostActive === "left"
        ? await cropToJpegBase64(rgba, width, height, 0, 0, midX, height)
        : await cropToJpegBase64(rgba, width, height, midX, 0, width - midX, height);
    }

    // ── Generate both halves ───────────────────────────────────────────────
    const [leftHalf, rightHalf] = await Promise.all([
      cropToJpegBase64(rgba, width, height, 0,    0, midX,          height),
      cropToJpegBase64(rgba, width, height, midX, 0, width - midX,  height),
    ]);

    return { leftHalf, rightHalf, blobCrop, mostActive, blobRegion };
  } catch (err) {
    console.warn("[vision] generateZoomCrops failed:", (err as Error).message);
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
    : scan.opencvAvailable
      ? "  none detected (OpenCV found no blobs above threshold)"
      : "  NOT AVAILABLE — OpenCV blob detection did not run";

  const blobCountLine = scan.opencvAvailable
    ? `Candidate arches: ${scan.candidateArchCount} bright blobs found (OpenCV measured)`
    : `Candidate arches: ⚠ BLOB DETECTION UNAVAILABLE — OpenCV WASM not loaded. This count is MEANINGLESS. Do NOT use it to infer fish presence or absence. Ignore entirely and rely solely on your visual analysis of the images.`;

  return `
═══ CV PRE-SCAN (TF.js pixel stats — measured data) ═══
Mean brightness : ${scan.meanBrightness}/255 (echo strength: ${scan.echoStrength})
Strong-echo %   : ${scan.brightPixelPct}% pixels above threshold
Palette cue     : ${scan.sonarPaletteCue} → R=${scan.redDominance.toFixed(2)} B=${scan.blueDominance.toFixed(2)}
${blobCountLine}
Top bright regions (x/y as fraction of image, 0=top-left):
${blobSummary}
${scan.opencvAvailable
  ? "USE these positions to cross-reference arch locations with depth scale. Strong arches at low yFrac = shallow; high yFrac = deeper."
  : "⚠ IMPORTANT: Because blob detection is unavailable, YOU MUST search every pixel of every provided image manually. Scan left half AND right half AND tight crop. Assume there are fish until proven otherwise — the bright-echo % above is your only signal hint."}`.trim();
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
