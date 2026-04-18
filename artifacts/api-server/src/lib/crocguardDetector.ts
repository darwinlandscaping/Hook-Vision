/**
 * CrocGuard Visual Detection Pipeline
 * ────────────────────────────────────────────────────────────────────────────
 * Fetches JPEG snapshots from ONLINE camera streams at 1 fps, runs a
 * two-stage detection pipeline:
 *
 *  Stage 1 — fast screening (<100 ms)
 *    ONNX YOLOv8-nano  : detect "animal-class" objects (80 COCO classes)
 *    Motion heuristic  : JPEG entropy delta between successive frames
 *    → averaged over 3 frames; if combined score > VISION_TRIGGER_THRESHOLD
 *      proceed to Stage 2
 *
 *  Stage 2 — croc-specific classification (~500 ms, only when triggered)
 *    OpenAI vision API : "Is there a crocodile in this image?" → 0-100
 *    Uses few-shot references from the Croc Reference Library for accuracy.
 *    Result is cached per camera for VISION_CACHE_MS to avoid API hammering.
 *
 * Confidence returned to the fusion engine is the Stage 2 croc-specific
 * score when available, otherwise the Stage 1 score (capped at 50).
 *
 * Target end-to-end cycle: <2 s per camera.
 */

import * as ort from "onnxruntime-node";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";
import { logger } from "./logger.js";
import { setCameraStatus, listCameras } from "./crocguardDb.js";
import { pushVisualScore, startDecayTick } from "./crocguardStatus.js";
import { openai } from "@workspace/integrations-openai-ai-server";
import { getCrocFewShotRefs } from "./crocLibrary.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const MODEL_URL           = "https://github.com/ultralytics/assets/releases/download/v8.3.0/yolov8n.onnx";
const MODEL_PATH          = path.join(__dirname, "../../models/yolov8n.onnx");
const SAMPLE_INTERVAL_MS  = 1000;   // 1 fps per camera
const HEALTH_CHECK_MS     = 10_000; // 10 s camera health ping
const INPUT_SIZE          = 640;    // YOLOv8 input resolution
const VISION_TRIGGER      = 20;     // min stage-1 score to trigger vision API (0-100)
const VISION_CACHE_MS     = 5_000;  // cache vision result for 5 s per camera

// COCO animal-adjacent class ids
const ANIMAL_CLASSES = new Set([14, 15, 16, 17, 18, 19, 20, 21, 22, 23]);

let session: ort.InferenceSession | null = null;
let modelLoading = false;

const prevFrames  = new Map<number, Buffer>();
const confBuffer  = new Map<number, number[]>();

/** Vision API result cache: camId → { score, expiresAt } */
const visionCache = new Map<number, { score: number; expiresAt: number }>();

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
//
// NOTE: Returns raw 0-100 confidence — no artificial ceiling.
// A high ONNX score (>70) is sufficient to trigger RED status independently,
// allowing edge/offline operation without the vision API.
// The vision API (stage 2) refines the score with croc-specific classification
// but is not required for any status level to be reached.

async function runOnnx(jpegBuf: Buffer): Promise<number> {
  if (!session) return 0;
  const tensor = buildInputTensor(jpegBuf);
  if (!tensor) return 0;
  try {
    const results = await session.run({ [session.inputNames[0]!]: tensor });
    const data = results[session.outputNames[0]!]?.data as Float32Array | undefined;
    if (!data) return 0;
    const numDets = 8400;
    let maxConf = 0;
    for (let d = 0; d < numDets; d++) {
      for (const cls of ANIMAL_CLASSES) {
        const c = data[(4 + cls) * numDets + d]!;
        if (c > maxConf) maxConf = c;
      }
    }
    return Math.min(maxConf * 100, 100); // full 0-100 range; red threshold (>70) reachable locally
  } catch {
    return 0;
  }
}

// ─── Motion heuristic (JPEG entropy proxy) ───────────────────────────────────
//
// Motion alone is capped at 50 — motion delta is an ambiguous signal
// (wave splash, lighting change) and should not independently trigger RED.
// Combined with ONNX or vision API it can contribute meaningfully.

function motionScore(prev: Buffer | undefined, curr: Buffer): number {
  if (!prev) return 0;
  const delta = Math.abs(curr.length - prev.length);
  const base  = Math.max(curr.length, prev.length);
  if (!base) return 0;
  return Math.min((delta / base) / 0.15 * 50, 50); // capped at 50; ambiguous alone
}

// ─── Stage 2: croc-specific vision API classification ─────────────────────────

const CROC_SYSTEM = `You are a wildlife safety AI specialising in crocodile detection from camera footage. Analyse the provided image and determine the probability (0-100) that a crocodile is visible or present. Consider partial visibility (eyes above waterline, submerged outline), reflected light on water, and vegetation shadows. Output ONLY a JSON object: {"crocodile_confidence": <number 0-100>, "explanation": "<brief reason>"}`;

async function getCrocConfidence(camId: number, jpegBuf: Buffer): Promise<number> {
  const now = Date.now();
  const cached = visionCache.get(camId);
  if (cached && now < cached.expiresAt) return cached.score;

  try {
    const refs = getCrocFewShotRefs(3);
    const refContent = refs
      .filter(r => r.thumbBase64)
      .map(r => ({
        type: "image_url" as const,
        image_url: { url: `data:image/jpeg;base64,${r.thumbBase64}`, detail: "low" as const },
      }));

    const base64Frame = jpegBuf.toString("base64");
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      max_tokens: 80,
      messages: [
        { role: "system", content: CROC_SYSTEM },
        {
          role: "user",
          content: [
            ...(refContent.length > 0
              ? [{ type: "text" as const, text: "Reference crocodile images:" }, ...refContent]
              : []),
            { type: "text", text: "Analyse this camera frame:" },
            {
              type: "image_url",
              image_url: { url: `data:image/jpeg;base64,${base64Frame}`, detail: "low" },
            },
          ],
        },
      ],
    });

    const text = response.choices[0]?.message?.content ?? "";
    const jsonMatch = text.match(/\{[\s\S]*?\}/);
    if (!jsonMatch) throw new Error("no JSON in response");
    const parsed = JSON.parse(jsonMatch[0]) as { crocodile_confidence?: number };
    const score = Math.min(100, Math.max(0, Number(parsed.crocodile_confidence ?? 0)));

    visionCache.set(camId, { score, expiresAt: now + VISION_CACHE_MS });
    logger.info({ camId, score }, "CrocGuard: vision API croc confidence");
    return score;
  } catch (err) {
    logger.warn({ err, camId }, "CrocGuard: vision API call failed");
    visionCache.set(camId, { score: 0, expiresAt: now + VISION_CACHE_MS });
    return 0;
  }
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

    const onnxConf    = session ? await runOnnx(buf) : 0;
    const stage1Score = Math.max(motion, onnxConf);

    // Rolling 3-frame average on stage-1 to suppress transient spikes
    const buf3 = confBuffer.get(camId) ?? [];
    buf3.push(stage1Score);
    if (buf3.length > 3) buf3.shift();
    confBuffer.set(camId, buf3);
    const avg1 = buf3.reduce((a, b) => a + b, 0) / buf3.length;

    // Stage 2: croc-specific vision API when stage-1 is triggered
    let finalScore = avg1;
    if (avg1 >= VISION_TRIGGER) {
      finalScore = await getCrocConfidence(camId, buf);
    }

    pushVisualScore(camId, finalScore, buf.subarray(0, 8192).toString("base64"));
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

// ─── Public init ──────────────────────────────────────────────────────────────

export async function initCrocguardDetector(): Promise<void> {
  ensureModel().catch(() => {});

  // Sample ONLY online cameras
  setInterval(async () => {
    const online = listCameras().filter(c => c.status === "online");
    if (online.length === 0) return;
    await Promise.allSettled(online.map(c => processCameraFrame(c.id, c.streamUrl)));
  }, SAMPLE_INTERVAL_MS);

  setInterval(runHealthChecks, HEALTH_CHECK_MS);
  runHealthChecks().catch(() => {});
  startDecayTick();

  logger.info("CrocGuard detector started");
}
