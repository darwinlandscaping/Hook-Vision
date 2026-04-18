/**
 * CrocGuard REST API Routes
 * ────────────────────────────────────────────────────────────────────────────
 * All routes are prefixed /api/crocguard by the parent router.
 *
 *  GET  /status
 *  GET  /cameras
 *  POST /cameras
 *  GET  /sonar
 *  POST /sonar
 *  GET  /alerts
 *  POST /alerts/resolve/:id
 */

import { Router } from "express";
import {
  addCamera,
  ingestSonar,
  listCameras,
  listSonar,
  listAlerts,
  resolveAlert,
} from "../lib/crocguardDb.js";
import { getStatus, notifySonarUpdate } from "../lib/crocguardStatus.js";

const router = Router();

// ─── URL safety helpers (SSRF prevention) ─────────────────────────────────────

const PRIVATE_RANGE_RE = /^(10\.|127\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.|::1|localhost)/i;

/**
 * Validate and sanitise a camera stream URL.
 * Returns the normalised URL string or throws with a user-friendly message.
 */
function sanitizeStreamUrl(raw: unknown): string {
  if (!raw || typeof raw !== "string") throw new Error("streamUrl must be a non-empty string");

  let parsed: URL;
  try {
    parsed = new URL(raw.trim());
  } catch {
    throw new Error("streamUrl is not a valid URL");
  }

  if (!["http:", "https:", "rtsp:"].includes(parsed.protocol)) {
    throw new Error("streamUrl must use http, https, or rtsp protocol");
  }

  // Block requests that would probe private infrastructure from the server
  if (PRIVATE_RANGE_RE.test(parsed.hostname)) {
    throw new Error(
      "streamUrl must not reference a private/loopback address — use a publicly reachable camera URL"
    );
  }

  return parsed.toString();
}

// ─── GET /api/crocguard/status ────────────────────────────────────────────────

router.get("/crocguard/status", (_req, res) => {
  res.json({ ok: true, ...getStatus() });
});

// ─── GET /api/crocguard/cameras ───────────────────────────────────────────────

router.get("/crocguard/cameras", (_req, res) => {
  res.json({ ok: true, cameras: listCameras() });
});

// ─── POST /api/crocguard/cameras ──────────────────────────────────────────────

router.post("/crocguard/cameras", (req, res) => {
  const { name, streamUrl, type } = req.body as {
    name?: unknown;
    streamUrl?: unknown;
    type?: unknown;
  };

  if (!name || typeof name !== "string" || !name.trim()) {
    res.status(400).json({ ok: false, error: "name is required" });
    return;
  }

  let safeUrl: string;
  try {
    safeUrl = sanitizeStreamUrl(streamUrl);
  } catch (err) {
    res.status(400).json({ ok: false, error: String(err instanceof Error ? err.message : err) });
    return;
  }

  const validTypes = ["mjpeg", "hls", "snapshot"];
  const camType = typeof type === "string" && validTypes.includes(type) ? type : "mjpeg";

  try {
    const cam = addCamera(name.trim(), safeUrl, camType);
    res.status(201).json({ ok: true, camera: cam });
  } catch (err) {
    res.status(500).json({ ok: false, error: String(err) });
  }
});

// ─── GET /api/crocguard/sonar ─────────────────────────────────────────────────

router.get("/crocguard/sonar", (_req, res) => {
  const units = listSonar();
  res.json({
    ok: true,
    units,
    anyMovement: units.some(u => u.movementDetected),
  });
});

// ─── POST /api/crocguard/sonar ────────────────────────────────────────────────

router.post("/crocguard/sonar", (req, res) => {
  const { unit_id, unit_name, signal_level, movement_detected } = req.body as {
    unit_id?: unknown;
    unit_name?: unknown;
    signal_level?: unknown;
    movement_detected?: unknown;
  };

  if (!unit_id || typeof unit_id !== "string" || !unit_id.trim()) {
    res.status(400).json({ ok: false, error: "unit_id is required" });
    return;
  }
  const sigLevel = Number(signal_level);
  if (isNaN(sigLevel) || sigLevel < 0 || sigLevel > 100) {
    res.status(400).json({ ok: false, error: "signal_level must be a number 0-100" });
    return;
  }

  try {
    ingestSonar(
      unit_id.trim(),
      typeof unit_name === "string" ? unit_name : undefined,
      sigLevel,
      Boolean(movement_detected),
      JSON.stringify(req.body),
    );
    notifySonarUpdate();
    res.status(201).json({ ok: true, status: getStatus() });
  } catch (err) {
    res.status(500).json({ ok: false, error: String(err) });
  }
});

// ─── GET /api/crocguard/alerts ────────────────────────────────────────────────

router.get("/crocguard/alerts", (req, res) => {
  const page  = Math.max(1, parseInt(String(req.query["page"]  ?? "1"),  10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(String(req.query["limit"] ?? "20"), 10) || 20));
  try {
    const result = listAlerts(page, limit);
    res.json({ ok: true, ...result });
  } catch (err) {
    res.status(500).json({ ok: false, error: String(err) });
  }
});

// ─── POST /api/crocguard/alerts/resolve/:id ───────────────────────────────────

router.post("/crocguard/alerts/resolve/:id", (req, res) => {
  const id = parseInt(req.params["id"] ?? "", 10);
  if (!id || isNaN(id)) {
    res.status(400).json({ ok: false, error: "Invalid alert id" });
    return;
  }
  try {
    const alert = resolveAlert(id);
    if (!alert) {
      res.status(404).json({ ok: false, error: "Alert not found" });
      return;
    }
    res.json({ ok: true, alert });
  } catch (err) {
    res.status(500).json({ ok: false, error: String(err) });
  }
});

export default router;
