/**
 * Vision Service — TensorFlow.js + React Native · COCO-SSD object detection
 *
 * Not connected to any screen yet. Import { getVision } when you are
 * ready to add on-device CV analysis to the analyzer or live camera.
 *
 * Usage (future):
 *   import { getVision } from "@/services/vision";
 *   const { tf, model } = await getVision();
 *   const predictions = await model.detect(imageTensor);
 */

import * as tf from "@tensorflow/tfjs";
import "@tensorflow/tfjs-react-native";
import * as cocoSsd from "@tensorflow-models/coco-ssd";

// ─── Lazy singletons ─────────────────────────────────────────────────────────

let _tf: typeof tf | null = null;
let _model: cocoSsd.ObjectDetection | null = null;
let _initialised = false;

export interface VisionService {
  tf: typeof tf;
  model: cocoSsd.ObjectDetection;
}

export interface Detection {
  class: string;
  score: number;
  bbox: [number, number, number, number];
}

/**
 * Initialise the React Native TF.js backend and load the COCO-SSD model
 * (80-class object detector — identifies fish, boats, people, etc.).
 *
 * Call once at app startup or lazily on first use. Returns cached instances
 * on subsequent calls.
 */
export async function getVision(): Promise<VisionService> {
  if (_initialised && _tf && _model) {
    return { tf: _tf, model: _model };
  }

  // ── TensorFlow.js — React Native backend ─────────────────────────────────
  _tf = tf;
  await _tf.ready();
  console.log(`[vision] TF.js ready — backend: ${_tf.getBackend()}`);

  // ── COCO-SSD — 80-class detector (YOLO-compatible output format) ─────────
  _model = await cocoSsd.load({ base: "mobilenet_v2" });
  console.log("[vision] COCO-SSD model loaded");

  _initialised = true;
  return { tf: _tf, model: _model };
}

/**
 * Run object detection on a TF.js tensor from a camera frame or image.
 * Returns detections sorted by confidence (highest first).
 *
 * Not connected to any screen yet.
 */
export async function detectObjects(
  imageTensor: tf.Tensor3D,
  minScore = 0.4
): Promise<Detection[]> {
  const { model } = await getVision();
  const raw = await model.detect(imageTensor as any);
  return (raw as Detection[])
    .filter((d) => d.score >= minScore)
    .sort((a, b) => b.score - a.score);
}

/**
 * Status check — returns a human-readable string confirming the vision
 * stack is ready. Safe to call without running a full detection.
 */
export async function visionStatus(): Promise<string> {
  const { tf: t } = await getVision();
  return `TF.js ${t.version} · backend: ${t.getBackend()} · COCO-SSD loaded`;
}
