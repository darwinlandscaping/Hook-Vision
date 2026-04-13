/**
 * Vision Library — TensorFlow.js · OpenCV WASM · YOLO / ONNX Runtime
 *
 * Not connected to any route yet. Import { getVision } and call it
 * when you are ready to add CV analysis to the analyzer pipeline.
 *
 * Usage (future):
 *   import { getVision } from "@/lib/vision";
 *   const { tf, cv, ort } = await getVision();
 */

import * as tf from "@tensorflow/tfjs";
import * as ort from "onnxruntime-node";

// ─── Lazy singletons ─────────────────────────────────────────────────────────

let _tf: typeof tf | null = null;
let _cv: any | null = null;
let _ort: typeof ort | null = null;
let _initialised = false;

export interface VisionLibs {
  tf: typeof tf;
  cv: any;
  ort: typeof ort;
}

/**
 * Initialise all vision libraries on first call, then return cached instances.
 * Lazy so the API server boots fast even if the vision stack isn't needed yet.
 */
export async function getVision(): Promise<VisionLibs> {
  if (_initialised) {
    return { tf: _tf!, cv: _cv!, ort: _ort! };
  }

  // ── TensorFlow.js ────────────────────────────────────────────────────────
  _tf = tf;
  await _tf.ready();
  console.log(`[vision] TensorFlow.js ready — backend: ${_tf.getBackend()}`);

  // ── OpenCV WASM ──────────────────────────────────────────────────────────
  try {
    const opencvWasm = await import("opencv-wasm");
    _cv = await (opencvWasm as any).default;
    console.log(`[vision] OpenCV WASM ready — build: ${_cv.getBuildInformation?.()?.split("\n")[0] ?? "ok"}`);
  } catch (e) {
    console.warn("[vision] OpenCV WASM failed to load:", e);
    _cv = null;
  }

  // ── ONNX Runtime (YOLO models run here) ──────────────────────────────────
  _ort = ort;
  console.log(`[vision] ONNX Runtime ready — version: ${_ort.env.versions.node ?? "n/a"}`);

  _initialised = true;
  return { tf: _tf, cv: _cv, ort: _ort };
}

/**
 * Quick smoke-test — run this from a route or startup hook to confirm
 * all three libraries loaded correctly. Returns a status report object.
 */
export async function visionStatus(): Promise<{
  tensorflow: string;
  opencv: string;
  onnxRuntime: string;
}> {
  const { tf: t, cv: c, ort: o } = await getVision();

  const tensorflow = `ready (backend: ${t.getBackend()}, version: ${t.version})`;
  const opencv = c ? `ready (OpenCV WASM)` : "unavailable";
  const onnxRuntime = `ready (ort-node ${o.env.versions.node ?? "?"})`;

  return { tensorflow, opencv, onnxRuntime };
}

// ─── YOLO helper (stub — wire in a real .onnx model path to activate) ───────

export interface YoloDetection {
  classId: number;
  label: string;
  confidence: number;
  box: { x: number; y: number; w: number; h: number };
}

/**
 * Run a YOLO ONNX model on raw image bytes.
 * Provide the path to a YOLOv8 .onnx model file and the image as a Buffer.
 * Returns an array of detections above the confidence threshold.
 *
 * Not connected to any route yet — ready to activate when needed.
 */
export async function runYolo(
  modelPath: string,
  imageBuffer: Buffer,
  confidenceThreshold = 0.4,
  labels: string[] = []
): Promise<YoloDetection[]> {
  const { ort: o } = await getVision();

  const session = await o.InferenceSession.create(modelPath, {
    executionProviders: ["cpu"],
  });

  const inputName = session.inputNames[0];
  const outputName = session.outputNames[0];

  // Placeholder: caller must pre-process imageBuffer into a Float32Array
  // matching the model's expected input shape (e.g. [1, 3, 640, 640]).
  console.log(`[vision/yolo] session ready — inputs: ${inputName}, outputs: ${outputName}`);

  return [];
}
