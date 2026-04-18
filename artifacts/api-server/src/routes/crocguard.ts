/**
 * CrocGuard REST API Routes
 * ────────────────────────────────────────────────────────────────────────────
 * All routes are prefixed /api/crocguard by the parent router.
 * (Downstream consumers — phone app and web dashboard — use these paths.)
 *
 *  GET  /crocguard/status
 *  GET  /crocguard/cameras
 *  POST /crocguard/cameras
 *  GET  /crocguard/sonar
 *  POST /crocguard/sonar
 *  GET  /crocguard/alerts
 *  POST /crocguard/alerts/resolve/:id
 *
 * URL policy: CrocGuard is a local-network / edge (Raspberry Pi) product.
 * Camera streams are expected to be on LAN addresses (192.168.x, 10.x, etc.).
 * Protocol validation ensures only http, https, or rtsp are accepted; no
 * server-side SSRF risk exists since consumers control their own camera URLs.
 */

import { Router } from "express";
import type { AlertRow } from "../lib/crocguardDb.js";
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

// ─── Response normalisers ─────────────────────────────────────────────────────

/** Convert a raw SQLite alert row to a clean API-shaped object */
function normaliseAlert(row: AlertRow) {
  return {
    id:         row.id,
    source:     row.source,
    severity:   row.severity,
    confidence: row.confidence,
    snapshot:   row.snapshot ?? null,
    resolved:   Boolean(row.resolved),
    resolvedAt: row.resolved_at != null ? new Date(row.resolved_at).toISOString() : null,
    timestamp:  new Date(row.created_at).toISOString(),
    metadata:   row.metadata ? (JSON.parse(row.metadata) as unknown) : null,
  };
}

// ─── URL validation (protocol-only; LAN addresses allowed) ───────────────────

function validateStreamUrl(raw: unknown): string {
  if (!raw || typeof raw !== "string" || !raw.trim()) {
    throw new Error("streamUrl must be a non-empty string");
  }
  let parsed: URL;
  try {
    parsed = new URL(raw.trim());
  } catch {
    throw new Error("streamUrl is not a valid URL");
  }
  if (!["http:", "https:", "rtsp:"].includes(parsed.protocol)) {
    throw new Error("streamUrl must use http, https, or rtsp");
  }
  return parsed.toString();
}

// ─── GET /api/crocguard/status ────────────────────────────────────────────────

router.get("/crocguard/status", (_req, res) => {
  res.json({ ok: true, ...getStatus() });
});

// ─── GET /api/crocguard/cameras ───────────────────────────────────────────────

router.get("/crocguard/cameras", (_req, res) => {
  const cameras = listCameras().map(c => ({
    id:        c.id,
    name:      c.name,
    streamUrl: c.streamUrl,
    type:      c.type,
    status:    c.status,
    lastSeen:  c.lastSeen?.toISOString() ?? null,
  }));
  res.json({ ok: true, cameras });
});

// ─── POST /api/crocguard/cameras ──────────────────────────────────────────────

router.post("/crocguard/cameras", (req, res) => {
  const { name, streamUrl, type } = req.body as Record<string, unknown>;

  if (!name || typeof name !== "string" || !name.trim()) {
    res.status(400).json({ ok: false, error: "name is required" });
    return;
  }

  let safeUrl: string;
  try {
    safeUrl = validateStreamUrl(streamUrl);
  } catch (err) {
    res.status(400).json({ ok: false, error: (err as Error).message });
    return;
  }

  const validTypes = ["mjpeg", "hls", "snapshot"];
  const camType = typeof type === "string" && validTypes.includes(type) ? type : "mjpeg";

  try {
    const cam = addCamera(name.trim(), safeUrl, camType);
    res.status(201).json({
      ok: true,
      camera: {
        id: cam.id, name: cam.name, streamUrl: cam.streamUrl,
        type: cam.type, status: cam.status, lastSeen: null,
      },
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: String(err) });
  }
});

// ─── GET /api/crocguard/sonar ─────────────────────────────────────────────────

router.get("/crocguard/sonar", (_req, res) => {
  const units = listSonar().map(u => ({
    unitId:           u.unitId,
    name:             u.unitName,
    signalLevel:      u.signalLevel,
    movementDetected: u.movementDetected,
    timestamp:        u.updatedAt.toISOString(),
  }));
  res.json({ ok: true, units, anyMovement: units.some(u => u.movementDetected) });
});

// ─── POST /api/crocguard/sonar ────────────────────────────────────────────────

router.post("/crocguard/sonar", (req, res) => {
  const { unit_id, unit_name, signal_level, movement_detected } = req.body as Record<string, unknown>;

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
    const { alerts, total } = listAlerts(page, limit);
    res.json({ ok: true, alerts: alerts.map(normaliseAlert), total, page, limit });
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
    const row = resolveAlert(id);
    if (!row) {
      res.status(404).json({ ok: false, error: "Alert not found" });
      return;
    }
    res.json({ ok: true, alert: normaliseAlert(row) });
  } catch (err) {
    res.status(500).json({ ok: false, error: String(err) });
  }
});

export default router;
