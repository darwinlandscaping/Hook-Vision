import * as ort from "onnxruntime-node";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";
import { logger } from "./logger.js";
import { setCameraStatus, listCameras } from "./crocguardDb.js";
import { pushVisualScore, startDecayTick } from "./crocguardStatus.js";
import { openai } from "@workspace/integrations-openai-ai-server";
import { getCrocFewShotRefs } from "./crocLibrary.js";
import { getModel } from "./models.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const MODEL_URL  = "https://github.com/ultralytics/assets/releases/download/v8.3.0/yolov8n.onnx";
const MODEL_PATH = path.join(__dirname, "../../models/yolov8n.onnx");
const INPUT_SIZE = 640;
const ANIMAL_CLASSES = new Set([14, 15, 16, 17, 18, 19, 20, 21, 22, 23]);

// Vision enrichment is opt-in for edge deployments where network latency matters.
// Set CROCGUARD_VISION_ENABLED=true to enable OpenAI croc-specific scoring.
const VISION_ENABLED = process.env["CROCGUARD_VISION_ENABLED"] === "true";

let session: ort.InferenceSession | null = null;

const prevFrames  = new Map<number, Buffer>();
const confHistory = new Map<number, number[]>();
const visionCache = new Map<number, { score: number; expiresAt: number }>();

// ─── SSRF guard (loopback + instance metadata only; LAN RFC1918 allowed) ──────

const BLOCK_RE = /^(127\.|::1$|0\.0\.0\.0|localhost|169\.254\.169\.254)/i;

function validateFetchTarget(urlStr: string): void {
  try {
    const { hostname } = new URL(urlStr);
    if (BLOCK_RE.test(hostname)) throw new Error(`Blocked host: ${hostname}`);
  } catch (err) {
    if ((err as Error).message.startsWith("Blocked")) throw err;
  }
}

// ─── ONNX model ───────────────────────────────────────────────────────────────

async function ensureModel() {
  if (session) return;
  try {
    if (!fs.existsSync(MODEL_PATH)) {
      fs.mkdirSync(path.dirname(MODEL_PATH), { recursive: true });
      const r = await fetch(MODEL_URL, { signal: AbortSignal.timeout(30_000) });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      fs.writeFileSync(MODEL_PATH, Buffer.from(await r.arrayBuffer()));
    }
    session = await ort.InferenceSession.create(MODEL_PATH, {
      executionProviders: ["cpu"],
      graphOptimizationLevel: "all",
    });
    logger.info("CrocGuard: ONNX session ready");
  } catch (err) {
    logger.warn({ err }, "CrocGuard: ONNX unavailable — motion heuristic only");
  }
}

// ─── Frame acquisition (per camera type) ─────────────────────────────────────

/** snapshot: direct JPEG fetch */
async function fetchSnapshot(url: string): Promise<Buffer | null> {
  validateFetchTarget(url);
  const r = await fetch(url, { signal: AbortSignal.timeout(1500) });
  if (!r.ok) return null;
  return Buffer.from(await r.arrayBuffer());
}

/** mjpeg: read multipart stream until first complete JPEG (SOI … EOI markers) */
async function fetchMjpegFrame(url: string): Promise<Buffer | null> {
  validateFetchTarget(url);
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 2000);
  try {
    const r = await fetch(url, { signal: ctrl.signal });
    if (!r.ok || !r.body) return null;
    const chunks: Uint8Array[] = [];
    let total = 0;
    const MAX = 512 * 1024; // 512 KB cap
    for await (const chunk of r.body as AsyncIterable<Uint8Array>) {
      chunks.push(chunk);
      total += chunk.length;
      // Stop once we have a complete JPEG or hit the cap
      const buf = Buffer.concat(chunks);
      const soi = buf.indexOf(Buffer.from([0xff, 0xd8, 0xff]));
      if (soi >= 0) {
        const eoi = buf.indexOf(Buffer.from([0xff, 0xd9]), soi + 2);
        if (eoi >= 0) { clearTimeout(timer); return buf.subarray(soi, eoi + 2); }
      }
      if (total >= MAX) break;
    }
    clearTimeout(timer);
    return null;
  } catch {
    clearTimeout(timer);
    return null;
  }
}

/** hls: fetch .m3u8 manifest → latest segment; try to extract JPEG from TS */
async function fetchHlsFrame(url: string): Promise<Buffer | null> {
  validateFetchTarget(url);
  try {
    const m3u8R = await fetch(url, { signal: AbortSignal.timeout(2000) });
    if (!m3u8R.ok) return null;
    const text = await m3u8R.text();
    const segs  = text.split("\n").map(l => l.trim()).filter(l => l && !l.startsWith("#"));
    if (!segs.length) return null;
    const segUrl = new URL(segs[segs.length - 1]!, url).toString();
    validateFetchTarget(segUrl);
    const segR = await fetch(segUrl, { signal: AbortSignal.timeout(2000) });
    if (!segR.ok) return null;
    const buf = Buffer.from(await segR.arrayBuffer());
    // If segment is a direct JPEG
    if (buf[0] === 0xff && buf[1] === 0xd8) return buf;
    // Try to find JPEG embedded in TS container
    const soi = buf.indexOf(Buffer.from([0xff, 0xd8, 0xff]));
    if (soi >= 0) {
      const eoi = buf.indexOf(Buffer.from([0xff, 0xd9]), soi + 2);
      if (eoi >= 0) return buf.subarray(soi, eoi + 2);
    }
    return buf; // Return raw TS for motion heuristic at minimum
  } catch { return null; }
}

async function acquireFrame(streamUrl: string, type: string): Promise<Buffer | null> {
  if (type === "mjpeg") return fetchMjpegFrame(streamUrl);
  if (type === "hls")   return fetchHlsFrame(streamUrl);
  return fetchSnapshot(streamUrl); // default: snapshot
}

// ─── ONNX inference ───────────────────────────────────────────────────────────

function buildTensor(buf: Buffer): ort.Tensor | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const jpeg = require("jpeg-js") as typeof import("jpeg-js");
    const { width, height, data } = jpeg.decode(buf, { useTArray: true, maxResolutionInMP: 100 });
    const f = new Float32Array(3 * INPUT_SIZE * INPUT_SIZE);
    const sx = width / INPUT_SIZE, sy = height / INPUT_SIZE;
    for (let y = 0; y < INPUT_SIZE; y++) {
      for (let x = 0; x < INPUT_SIZE; x++) {
        const px = Math.min(Math.floor(x * sx), width - 1);
        const py = Math.min(Math.floor(y * sy), height - 1);
        const i  = (py * width + px) * 4;
        f[0 * INPUT_SIZE * INPUT_SIZE + y * INPUT_SIZE + x] = data[i]!     / 255;
        f[1 * INPUT_SIZE * INPUT_SIZE + y * INPUT_SIZE + x] = data[i + 1]! / 255;
        f[2 * INPUT_SIZE * INPUT_SIZE + y * INPUT_SIZE + x] = data[i + 2]! / 255;
      }
    }
    return new ort.Tensor("float32", f, [1, 3, INPUT_SIZE, INPUT_SIZE]);
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

// ─── Async croc vision enrichment ────────────────────────────────────────────

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
      model: getModel("mid"),
      max_completion_tokens: 60,
      messages: [{
        role: "user",
        content: [
          ...(refImgs.length ? [{ type: "text" as const, text: "Croc references:" }, ...refImgs] : []),
          { type: "text", text: "Probability 0-100 crocodile present. JSON: {\"p\":N}" },
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

// ─── Per-camera detection cycle ───────────────────────────────────────────────

async function processCamera(camId: number, streamUrl: string, type: string) {
  try {
    const buf = await acquireFrame(streamUrl, type);
    if (!buf) { setCameraStatus(camId, "offline"); return; }
    setCameraStatus(camId, "online");

    const motion   = motionScore(prevFrames.get(camId), buf);
    prevFrames.set(camId, buf);
    const onnxConf = session ? await runOnnx(buf) : 0;
    const stage1   = Math.max(motion, onnxConf);

    const hist = confHistory.get(camId) ?? [];
    hist.push(stage1);
    if (hist.length > 3) hist.shift();
    confHistory.set(camId, hist);
    const avg = hist.reduce((a, b) => a + b, 0) / hist.length;

    pushVisualScore(camId, avg, buf.subarray(0, 8192).toString("base64"));

    if (VISION_ENABLED && avg >= 20) enrichWithVision(camId, buf).catch(() => {});
  } catch {
    setCameraStatus(camId, "offline");
  }
}

// ─── Health check (tolerant: HEAD with GET fallback for 405) ─────────────────

async function healthCheck() {
  await Promise.allSettled(listCameras().map(async cam => {
    try {
      let r = await fetch(cam.streamUrl, { method: "HEAD", signal: AbortSignal.timeout(2000) });
      if (r.status === 405) {
        // Camera rejects HEAD; try GET with immediate abort after headers
        const ctrl = new AbortController();
        setTimeout(() => ctrl.abort(), 1000);
        try { r = await fetch(cam.streamUrl, { signal: ctrl.signal }); }
        catch (e: unknown) {
          // AbortError after connecting = stream is reachable
          if ((e as Error).name === "AbortError") { setCameraStatus(cam.id, "online"); return; }
          throw e;
        }
      }
      setCameraStatus(cam.id, (r.ok || r.status === 206) ? "online" : "offline");
    } catch { setCameraStatus(cam.id, "offline"); }
  }));
}

// ─── Init ─────────────────────────────────────────────────────────────────────

export async function initCrocguardDetector() {
  ensureModel().catch(() => {});

  setInterval(async () => {
    const online = listCameras().filter(c => c.status === "online");
    if (online.length)
      await Promise.allSettled(online.map(c => processCamera(c.id, c.streamUrl, c.type)));
  }, 1000);

  setInterval(healthCheck, 10_000);
  healthCheck().catch(() => {});
  startDecayTick();

  logger.info("CrocGuard detector started");
}
