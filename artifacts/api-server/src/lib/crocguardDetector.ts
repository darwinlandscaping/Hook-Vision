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

const MODEL_URL  = "https://github.com/ultralytics/assets/releases/download/v8.3.0/yolov8n.onnx";
const MODEL_PATH = path.join(__dirname, "../../models/yolov8n.onnx");
const INPUT_SIZE = 640;

// COCO animal-class ids
const ANIMAL_CLASSES = new Set([14, 15, 16, 17, 18, 19, 20, 21, 22, 23]);

let session: ort.InferenceSession | null = null;

const prevFrames  = new Map<number, Buffer>();
const confBuffer  = new Map<number, number[]>();
const visionCache = new Map<number, { score: number; expiresAt: number }>();

async function ensureModel() {
  if (session) return;
  try {
    if (!fs.existsSync(MODEL_PATH)) {
      fs.mkdirSync(path.dirname(MODEL_PATH), { recursive: true });
      const resp = await fetch(MODEL_URL, { signal: AbortSignal.timeout(30_000) });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      fs.writeFileSync(MODEL_PATH, Buffer.from(await resp.arrayBuffer()));
    }
    session = await ort.InferenceSession.create(MODEL_PATH, {
      executionProviders: ["cpu"],
      graphOptimizationLevel: "all",
    });
    logger.info("CrocGuard: ONNX session ready");
  } catch (err) {
    logger.warn({ err }, "CrocGuard: ONNX model unavailable — motion heuristic only");
  }
}

function buildTensor(jpegBuf: Buffer): ort.Tensor | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const jpeg = require("jpeg-js") as typeof import("jpeg-js");
    const { width, height, data } = jpeg.decode(jpegBuf, { useTArray: true, maxResolutionInMP: 100 });
    const floats = new Float32Array(3 * INPUT_SIZE * INPUT_SIZE);
    const sx = width / INPUT_SIZE, sy = height / INPUT_SIZE;
    for (let y = 0; y < INPUT_SIZE; y++) {
      for (let x = 0; x < INPUT_SIZE; x++) {
        const px = Math.min(Math.floor(x * sx), width - 1);
        const py = Math.min(Math.floor(y * sy), height - 1);
        const i  = (py * width + px) * 4;
        floats[0 * INPUT_SIZE * INPUT_SIZE + y * INPUT_SIZE + x] = data[i]!    / 255;
        floats[1 * INPUT_SIZE * INPUT_SIZE + y * INPUT_SIZE + x] = data[i + 1]! / 255;
        floats[2 * INPUT_SIZE * INPUT_SIZE + y * INPUT_SIZE + x] = data[i + 2]! / 255;
      }
    }
    return new ort.Tensor("float32", floats, [1, 3, INPUT_SIZE, INPUT_SIZE]);
  } catch { return null; }
}

async function runOnnx(buf: Buffer): Promise<number> {
  if (!session) return 0;
  const tensor = buildTensor(buf);
  if (!tensor) return 0;
  try {
    const out  = await session.run({ [session.inputNames[0]!]: tensor });
    const data = out[session.outputNames[0]!]?.data as Float32Array | undefined;
    if (!data) return 0;
    const n = 8400;
    let max = 0;
    for (let d = 0; d < n; d++)
      for (const cls of ANIMAL_CLASSES) { const c = data[(4 + cls) * n + d]!; if (c > max) max = c; }
    return Math.min(max * 100, 100);
  } catch { return 0; }
}

function motionScore(prev: Buffer | undefined, curr: Buffer): number {
  if (!prev) return 0;
  const delta = Math.abs(curr.length - prev.length);
  const base  = Math.max(curr.length, prev.length);
  return base ? Math.min((delta / base) / 0.15 * 50, 50) : 0;
}

// Vision API enrichment — runs async, does NOT block the detection loop
async function enrichWithVision(camId: number, buf: Buffer) {
  const now = Date.now();
  const cached = visionCache.get(camId);
  if (cached && now < cached.expiresAt) {
    pushVisualScore(camId, cached.score, buf.subarray(0, 8192).toString("base64"));
    return;
  }
  try {
    const refs = getCrocFewShotRefs(3).filter(r => r.thumbBase64);
    const refImgs = refs.map(r => ({
      type: "image_url" as const,
      image_url: { url: `data:image/jpeg;base64,${r.thumbBase64}`, detail: "low" as const },
    }));
    const resp = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      max_tokens: 60,
      messages: [{
        role: "user",
        content: [
          ...(refImgs.length ? [{ type: "text" as const, text: "Croc reference images:" }, ...refImgs] : []),
          { type: "text", text: "Probability 0-100 that a crocodile is present in this image. JSON only: {\"p\":N}" },
          { type: "image_url", image_url: { url: `data:image/jpeg;base64,${buf.toString("base64")}`, detail: "low" } },
        ],
      }],
    });
    const m = (resp.choices[0]?.message?.content ?? "").match(/\{.*?"p"\s*:\s*(\d+)/);
    const score = m ? Math.min(100, Math.max(0, parseInt(m[1]!, 10))) : 0;
    visionCache.set(camId, { score, expiresAt: now + 5_000 });
    pushVisualScore(camId, score, buf.subarray(0, 8192).toString("base64"));
    logger.info({ camId, score }, "CrocGuard: vision enrichment");
  } catch (err) {
    logger.warn({ err, camId }, "CrocGuard: vision enrichment failed");
    visionCache.set(camId, { score: 0, expiresAt: now + 5_000 });
  }
}

async function processCamera(camId: number, streamUrl: string) {
  try {
    const resp = await fetch(streamUrl, { signal: AbortSignal.timeout(1500) });
    if (!resp.ok) { setCameraStatus(camId, "offline"); return; }
    setCameraStatus(camId, "online");

    const buf    = Buffer.from(await resp.arrayBuffer());
    const motion = motionScore(prevFrames.get(camId), buf);
    prevFrames.set(camId, buf);

    const onnxConf = session ? await runOnnx(buf) : 0;
    const stage1   = Math.max(motion, onnxConf);

    // Rolling 3-frame average on stage-1
    const history = confBuffer.get(camId) ?? [];
    history.push(stage1);
    if (history.length > 3) history.shift();
    confBuffer.set(camId, history);
    const avg = history.reduce((a, b) => a + b, 0) / history.length;

    // Push stage-1 score immediately so status fusion is never blocked
    pushVisualScore(camId, avg, buf.subarray(0, 8192).toString("base64"));

    // Async enrichment: vision API refines score when stage-1 suggests movement
    if (avg >= 20) {
      enrichWithVision(camId, buf).catch(() => {});
    }
  } catch {
    setCameraStatus(camId, "offline");
  }
}

async function healthCheck() {
  await Promise.allSettled(listCameras().map(async cam => {
    try {
      const r = await fetch(cam.streamUrl, { method: "HEAD", signal: AbortSignal.timeout(3000) });
      setCameraStatus(cam.id, r.ok ? "online" : "offline");
    } catch { setCameraStatus(cam.id, "offline"); }
  }));
}

export async function initCrocguardDetector() {
  ensureModel().catch(() => {});

  setInterval(async () => {
    const online = listCameras().filter(c => c.status === "online");
    if (online.length) await Promise.allSettled(online.map(c => processCamera(c.id, c.streamUrl)));
  }, 1000);

  setInterval(healthCheck, 10_000);
  healthCheck().catch(() => {});
  startDecayTick();

  logger.info("CrocGuard detector started");
}
