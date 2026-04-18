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

// ─── GET /api/crocguard/status ────────────────────────────────────────────────

router.get("/crocguard/status", (_req, res) => {
  res.json({ ok: true, ...getStatus() });
});

// ─── GET /api/crocguard/cameras ───────────────────────────────────────────────

router.get("/crocguard/cameras", (_req, res) => {
  res.json({ ok: true, cameras: listCameras() });
});

// ─── POST /api/crocguard/cameras ──────────────────────────────────────────────

router.post("/crocguard/cameras", async (req, res) => {
  const { name, streamUrl, type } = req.body as {
    name?: string;
    streamUrl?: string;
    type?: string;
  };

  if (!name || typeof name !== "string" || !name.trim()) {
    res.status(400).json({ ok: false, error: "name is required" });
    return;
  }
  if (!streamUrl || typeof streamUrl !== "string" || !streamUrl.trim()) {
    res.status(400).json({ ok: false, error: "streamUrl is required" });
    return;
  }
  const validTypes = ["mjpeg", "hls", "snapshot"];
  const camType = type && validTypes.includes(type) ? type : "mjpeg";

  try {
    const cam = await addCamera(name.trim(), streamUrl.trim(), camType);
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

router.post("/crocguard/sonar", async (req, res) => {
  const { unit_id, unit_name, signal_level, movement_detected } = req.body as {
    unit_id?: string;
    unit_name?: string;
    signal_level?: number;
    movement_detected?: boolean;
  };

  if (!unit_id || typeof unit_id !== "string") {
    res.status(400).json({ ok: false, error: "unit_id is required" });
    return;
  }
  if (typeof signal_level !== "number" || signal_level < 0 || signal_level > 100) {
    res.status(400).json({ ok: false, error: "signal_level must be a number 0-100" });
    return;
  }

  try {
    await ingestSonar(
      unit_id,
      unit_name,
      signal_level,
      Boolean(movement_detected),
      JSON.stringify(req.body),
    );
    // Trigger status re-evaluation after sonar update
    notifySonarUpdate();
    res.status(201).json({ ok: true, status: getStatus() });
  } catch (err) {
    res.status(500).json({ ok: false, error: String(err) });
  }
});

// ─── GET /api/crocguard/alerts ────────────────────────────────────────────────

router.get("/crocguard/alerts", async (req, res) => {
  const page  = Math.max(1, parseInt(String(req.query["page"]  ?? "1"),  10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(String(req.query["limit"] ?? "20"), 10) || 20));
  try {
    const result = await listAlerts(page, limit);
    res.json({ ok: true, ...result });
  } catch (err) {
    res.status(500).json({ ok: false, error: String(err) });
  }
});

// ─── POST /api/crocguard/alerts/resolve/:id ───────────────────────────────────

router.post("/crocguard/alerts/resolve/:id", async (req, res) => {
  const id = parseInt(req.params["id"] ?? "", 10);
  if (!id || isNaN(id)) {
    res.status(400).json({ ok: false, error: "Invalid alert id" });
    return;
  }
  try {
    const alert = await resolveAlert(id);
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
