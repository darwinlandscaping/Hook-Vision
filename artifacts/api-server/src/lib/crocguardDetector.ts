/**
 * CrocGuard Visual Detection Pipeline
 * ────────────────────────────────────────────────────────────────────────────
 * Fetches JPEG snapshots from ONLINE camera streams at a set interval,
 * runs lightweight motion detection (JPEG entropy delta heuristic) and
 * optionally ONNX inference (YOLOv8-nano), then feeds confidence scores
 * into the status fusion engine.
 *
 * Pipeline per cycle (target: <2 seconds end-to-end):
 *   1. Fetch JPEG snapshot from camera URL  (200 ms budget)
 *   2. Compute inter-frame delta score       ( 50 ms budget)
 *   3. ONNX inference if model loaded       (400 ms budget)
 *   4. 3-frame rolling average              (  0 ms — in-memory)
 *   5. Push (cameraId, confidence) to fusion engine
 *
 * ONNX model:  yolov8n.onnx (~6 MB) downloaded once on first run.
 *              Falls back to motion-heuristic-only if download unavailable.
 *
 * URL safety: all camera URLs are validated by crocguardSanitizeUrl() before
 * they are stored; the detector trusts stored URLs but still enforces a short
 * fetch timeout to limit damage in case of stale/proxied entries.
 */

import * as ort from "onnxruntime-node";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";
import { logger } from "./logger.js";
import { setCameraStatus, listCameras } from "./crocguardDb.js";
import { pushVisualScore, startDecayTick } from "./crocguardStatus.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const MODEL_URL          = "https://github.com/ultralytics/assets/releases/download/v8.3.0/yolov8n.onnx";
const MODEL_PATH         = path.join(__dirname, "../../models/yolov8n.onnx");
const SAMPLE_INTERVAL_MS = 1000;   // 1 fps per camera
const HEALTH_CHECK_MS    = 10_000; // 10 s camera health ping
const INPUT_SIZE         = 640;    // YOLOv8 input resolution

// COCO "animal" class ids (0-indexed) — proxy for large organism presence
const ANIMAL_CLASSES = new Set([14, 15, 16, 17, 18, 19, 20, 21, 22, 23]);

let session: ort.InferenceSession | null = null;
let modelLoading = false;

/** Raw JPEG bytes from previous cycle per camera — used for entropy diff */
const prevFrames = new Map<number, Buffer>();
/** Rolling 3-frame confidence buffer per camera */
const confBuffer = new Map<number, number[]>();

// ─── Model loading ────────────────────────────────────────────────────────────

async function ensureModel(): Promise<void> {
  if (session || modelLoading) return;
  modelLoading = true;
  try {
    if (!fs.existsSync(MODEL_PATH)) {
      fs.mkdirSync(path.dirname(MODEL_PATH), { recursive: true });
      logger.info("CrocGuard: downloading YOLOv8n ONNX model…");
      const resp = await fetch(MODEL_URL, { signal: AbortSignal.timeout(30_000) });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      fs.writeFileSync(MODEL_PATH, Buffer.from(await resp.arrayBuffer()));
      logger.info({ bytes: fs.statSync(MODEL_PATH).size }, "CrocGuard: model saved");
    }
    session = await ort.InferenceSession.create(MODEL_PATH, {
      executionProviders: ["cpu"],
      graphOptimizationLevel: "all",
    });
    logger.info("CrocGuard: ONNX session ready");
  } catch (err) {
    logger.warn({ err }, "CrocGuard: ONNX model unavailable — motion heuristic only");
  } finally {
    modelLoading = false;
  }
}

// ─── Frame preprocessing ─────────────────────────────────────────────────────

function buildInputTensor(jpegBuf: Buffer): ort.Tensor | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const jpeg = require("jpeg-js") as typeof import("jpeg-js");
    const { width, height, data } = jpeg.decode(jpegBuf, { useTArray: true, maxResolutionInMP: 100 });
    const floats = new Float32Array(3 * INPUT_SIZE * INPUT_SIZE);
    const sx = width  / INPUT_SIZE;
    const sy = height / INPUT_SIZE;
    for (let y = 0; y < INPUT_SIZE; y++) {
      for (let x = 0; x < INPUT_SIZE; x++) {
        const px = Math.min(Math.floor(x * sx), width  - 1);
        const py = Math.min(Math.floor(y * sy), height - 1);
        const i  = (py * width + px) * 4;
        floats[0 * INPUT_SIZE * INPUT_SIZE + y * INPUT_SIZE + x] = (data[i]!    ) / 255;
        floats[1 * INPUT_SIZE * INPUT_SIZE + y * INPUT_SIZE + x] = (data[i + 1]!) / 255;
        floats[2 * INPUT_SIZE * INPUT_SIZE + y * INPUT_SIZE + x] = (data[i + 2]!) / 255;
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
    const results = await session.run({ [session.inputNames[0]!]: tensor });
    const data = results[session.outputNames[0]!]?.data as Float32Array | undefined;
    if (!data) return 0;
    const numDets = 8400; // YOLOv8n default
    let maxConf = 0;
    for (let d = 0; d < numDets; d++) {
      for (const cls of ANIMAL_CLASSES) {
        const c = data[(4 + cls) * numDets + d]!;
        if (c > maxConf) maxConf = c;
      }
    }
    return Math.min(maxConf * 100, 85); // cap — vision API does final confirmation
  } catch {
    return 0;
  }
}

// ─── Motion heuristic (JPEG entropy proxy) ───────────────────────────────────

function motionScore(prev: Buffer | undefined, curr: Buffer): number {
  if (!prev) return 0;
  const delta = Math.abs(curr.length - prev.length);
  const base  = Math.max(curr.length, prev.length);
  if (!base) return 0;
  // ≥15% size change → max heuristic score of 50 (combined with ONNX for >70 RED threshold)
  return Math.min((delta / base) / 0.15 * 50, 50);
}

// ─── Per-camera cycle ─────────────────────────────────────────────────────────

async function processCameraFrame(camId: number, streamUrl: string): Promise<void> {
  try {
    const resp = await fetch(streamUrl, { signal: AbortSignal.timeout(1500) });
    if (!resp.ok) {
      setCameraStatus(camId, "offline");
      return;
    }
    setCameraStatus(camId, "online");

    const buf    = Buffer.from(await resp.arrayBuffer());
    const motion = motionScore(prevFrames.get(camId), buf);
    prevFrames.set(camId, buf);

    const onnxConf = session ? await runOnnx(buf) : 0;
    const rawConf  = Math.max(motion, onnxConf);

    // Rolling 3-frame average to suppress transient false positives
    const buf3 = confBuffer.get(camId) ?? [];
    buf3.push(rawConf);
    if (buf3.length > 3) buf3.shift();
    confBuffer.set(camId, buf3);

    const avgConf = buf3.reduce((a, b) => a + b, 0) / buf3.length;
    pushVisualScore(camId, avgConf, buf.subarray(0, 8192).toString("base64"));
  } catch {
    setCameraStatus(camId, "offline");
  }
}

// ─── Health check loop ────────────────────────────────────────────────────────

async function runHealthChecks(): Promise<void> {
  const cameras = listCameras();
  await Promise.allSettled(cameras.map(async cam => {
    try {
      const r = await fetch(cam.streamUrl, { method: "HEAD", signal: AbortSignal.timeout(3000) });
      setCameraStatus(cam.id, r.ok ? "online" : "offline");
    } catch {
      setCameraStatus(cam.id, "offline");
    }
  }));
}

// ─── Public init ─────────────────────────────────────────────────────────────

export async function initCrocguardDetector(): Promise<void> {
  // Kick off model download in the background — does not block startup
  ensureModel().catch(() => {});

  // Sample ONLY online cameras every second
  setInterval(async () => {
    const online = listCameras().filter(c => c.status === "online");
    if (online.length === 0) return;
    await Promise.allSettled(online.map(c => processCameraFrame(c.id, c.streamUrl)));
  }, SAMPLE_INTERVAL_MS);

  // Periodic health check for ALL cameras regardless of current status
  setInterval(runHealthChecks, HEALTH_CHECK_MS);
  runHealthChecks().catch(() => {});

  // Start the status decay interval
  startDecayTick();

  logger.info("CrocGuard detector started");
}
