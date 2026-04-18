/**
 * CrocGuard Visual Detection Pipeline
 * ────────────────────────────────────────────────────────────────────────────
 * Fetches JPEG snapshots from configured camera streams at a set interval,
 * runs lightweight motion detection (pixel-delta heuristic) and optionally
 * ONNX inference, then feeds confidence scores into the status fusion engine.
 *
 * Pipeline per cycle (target: <2 seconds end-to-end):
 *   1. Fetch JPEG snapshot from camera URL (200 ms budget)
 *   2. Compute inter-frame delta score   ( 50 ms budget)
 *   3. ONNX inference if model loaded    (400 ms budget — worker thread)
 *   4. Push (cameraId, confidence) to status engine
 *
 * ONNX model:  yolov8n.onnx (6 MB) downloaded once on first run.
 *              YOLOv8-nano can detect ~80 COCO classes; we pick the highest
 *              single-class confidence from any "animal-like" class as a
 *              proxy prior before vision-API confirms croc species.
 *              Falls back to motion-heuristic-only if model unavailable.
 */

import * as ort from "onnxruntime-node";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";
import { logger } from "./logger.js";
import { cameraCache, setCameraStatus, listCameras } from "./crocguardDb.js";
import { pushVisualScore } from "./crocguardStatus.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ─── Constants ────────────────────────────────────────────────────────────────

const MODEL_URL  = "https://github.com/ultralytics/assets/releases/download/v8.3.0/yolov8n.onnx";
const MODEL_PATH = path.join(__dirname, "../../models/yolov8n.onnx");
const SAMPLE_INTERVAL_MS = 1000;   // 1 frame/sec per camera
const HEALTH_CHECK_MS    = 10_000; // 10 s camera health-check
const INPUT_SIZE         = 640;    // YOLOv8 default input

// COCO animal-adjacent class ids (index into yolov8 output)
const ANIMAL_CLASSES = new Set([14, 15, 16, 17, 18, 19, 20, 21, 22, 23]); // bird/cat/dog/horse/sheep/cow/elephant/bear/zebra/giraffe

// ─── Module state ─────────────────────────────────────────────────────────────

let session: ort.InferenceSession | null = null;
let modelLoading = false;

/** Last raw JPEG bytes per camera id — used for frame differencing */
const prevFrames = new Map<number, Buffer>();

/** Rolling 3-frame confidence buffer per camera */
const confBuffer = new Map<number, number[]>();

// ─── Model loading ────────────────────────────────────────────────────────────

async function ensureModel(): Promise<boolean> {
  if (session) return true;
  if (modelLoading) return false;
  modelLoading = true;
  try {
    if (!fs.existsSync(MODEL_PATH)) {
      fs.mkdirSync(path.dirname(MODEL_PATH), { recursive: true });
      logger.info("CrocGuard: downloading YOLOv8n ONNX model…");
      const resp = await fetch(MODEL_URL, { signal: AbortSignal.timeout(30_000) });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const buf = Buffer.from(await resp.arrayBuffer());
      fs.writeFileSync(MODEL_PATH, buf);
      logger.info({ size: buf.length }, "CrocGuard: model downloaded");
    }
    session = await ort.InferenceSession.create(MODEL_PATH, {
      executionProviders: ["cpu"],
      graphOptimizationLevel: "all",
    });
    logger.info("CrocGuard: ONNX session ready");
    return true;
  } catch (err) {
    logger.warn({ err }, "CrocGuard: ONNX model unavailable — using motion heuristic only");
    return false;
  } finally {
    modelLoading = false;
  }
}

// ─── Frame preprocessing (resize → normalise → NCHW tensor) ─────────────────

function buildInputTensor(jpegBuf: Buffer): ort.Tensor | null {
  try {
    const { default: jpeg } = require("jpeg-js"); // synchronous CJS interop
    const raw = jpeg.decode(jpegBuf, { useTArray: true, maxResolutionInMP: 100 });

    const { width, height, data } = raw as { width: number; height: number; data: Uint8Array };
    const floats = new Float32Array(3 * INPUT_SIZE * INPUT_SIZE);

    const scaleX = width  / INPUT_SIZE;
    const scaleY = height / INPUT_SIZE;

    for (let y = 0; y < INPUT_SIZE; y++) {
      for (let x = 0; x < INPUT_SIZE; x++) {
        const srcX = Math.min(Math.floor(x * scaleX), width  - 1);
        const srcY = Math.min(Math.floor(y * scaleY), height - 1);
        const srcIdx = (srcY * width + srcX) * 4;
        // R/G/B normalised to [0,1] — YOLOv8 expects RGB NCHW
        floats[0 * INPUT_SIZE * INPUT_SIZE + y * INPUT_SIZE + x] = data[srcIdx]!     / 255;
        floats[1 * INPUT_SIZE * INPUT_SIZE + y * INPUT_SIZE + x] = data[srcIdx + 1]! / 255;
        floats[2 * INPUT_SIZE * INPUT_SIZE + y * INPUT_SIZE + x] = data[srcIdx + 2]! / 255;
      }
    }
    return new ort.Tensor("float32", floats, [1, 3, INPUT_SIZE, INPUT_SIZE]);
  } catch {
    return null;
  }
}

// ─── ONNX inference ───────────────────────────────────────────────────────────

async function runOnnx(jpegBuf: Buffer): Promise<number> {
  if (!session) return 0;
  const tensor = buildInputTensor(jpegBuf);
  if (!tensor) return 0;

  try {
    const feeds = { [session.inputNames[0]!]: tensor };
    const results = await session.run(feeds);
    const output = results[session.outputNames[0]!];
    if (!output) return 0;

    // YOLOv8 output: [1, 84, 8400] — rows are [x,y,w,h, cls0..cls79]
    const data = output.data as Float32Array;
    const numDets = 8400;
    let maxAnimalConf = 0;

    for (let d = 0; d < numDets; d++) {
      for (const cls of ANIMAL_CLASSES) {
        const conf = data[(4 + cls) * numDets + d]!;
        if (conf > maxAnimalConf) maxAnimalConf = conf;
      }
    }
    // Scale 0-1 confidence to 0-100, cap at 85 (vision API does final confirmation)
    return Math.min(maxAnimalConf * 100, 85);
  } catch {
    return 0;
  }
}

// ─── Motion heuristic ─────────────────────────────────────────────────────────

function motionScore(prev: Buffer | undefined, curr: Buffer): number {
  if (!prev) return 0;
  // Use JPEG file-size delta as a cheap proxy for frame change
  // (more motion → more entropy → larger compressed size)
  const delta = Math.abs(curr.length - prev.length);
  const base  = Math.max(curr.length, prev.length);
  if (base === 0) return 0;
  // Normalise: 0% change = 0 score, ≥15% change = 50 score (motion heuristic only)
  const ratio = delta / base;
  return Math.min(ratio / 0.15 * 50, 50);
}

// ─── Per-camera cycle ─────────────────────────────────────────────────────────

async function processCameraFrame(camId: number, streamUrl: string): Promise<void> {
  try {
    const resp = await fetch(streamUrl, { signal: AbortSignal.timeout(1500) });
    if (!resp.ok) {
      await setCameraStatus(camId, "offline");
      return;
    }
    await setCameraStatus(camId, "online");

    const buf = Buffer.from(await resp.arrayBuffer());

    // 1. Motion heuristic
    const motion = motionScore(prevFrames.get(camId), buf);
    prevFrames.set(camId, buf);

    // 2. ONNX (if available)
    const onnxConf = session ? await runOnnx(buf) : 0;

    // 3. Combine — take higher of motion or ONNX
    const rawConf = Math.max(motion, onnxConf);

    // 4. Rolling 3-frame average to reduce false positives
    const buf3 = confBuffer.get(camId) ?? [];
    buf3.push(rawConf);
    if (buf3.length > 3) buf3.shift();
    confBuffer.set(camId, buf3);

    const avgConf = buf3.reduce((a, b) => a + b, 0) / buf3.length;
    pushVisualScore(camId, avgConf, buf.subarray(0, 8192).toString("base64"));
  } catch {
    await setCameraStatus(camId, "offline").catch(() => {});
  }
}

// ─── Health check loop ────────────────────────────────────────────────────────

async function runHealthChecks(): Promise<void> {
  const cameras = listCameras();
  await Promise.allSettled(
    cameras.map(async cam => {
      try {
        const r = await fetch(cam.streamUrl, { method: "HEAD", signal: AbortSignal.timeout(3000) });
        await setCameraStatus(cam.id, r.ok ? "online" : "offline");
      } catch {
        await setCameraStatus(cam.id, "offline");
      }
    })
  );
}

// ─── Public API ───────────────────────────────────────────────────────────────

let samplingTimer:   ReturnType<typeof setInterval> | null = null;
let healthCheckTimer: ReturnType<typeof setInterval> | null = null;

export async function initCrocguardDetector(): Promise<void> {
  ensureModel().catch(() => {});

  // Start sampling loop
  samplingTimer = setInterval(async () => {
    const cameras = listCameras().filter(c => c.status === "online" || true); // attempt all
    await Promise.allSettled(
      cameras.map(c => processCameraFrame(c.id, c.streamUrl))
    );
  }, SAMPLE_INTERVAL_MS);

  // Start health-check loop
  healthCheckTimer = setInterval(runHealthChecks, HEALTH_CHECK_MS);

  // Immediate health check
  runHealthChecks().catch(() => {});

  logger.info("CrocGuard detector started");
}

export function stopCrocguardDetector(): void {
  if (samplingTimer)    clearInterval(samplingTimer);
  if (healthCheckTimer) clearInterval(healthCheckTimer);
}
