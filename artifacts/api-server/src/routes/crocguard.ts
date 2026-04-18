import { Router } from "express";
import type { AlertRow } from "../lib/crocguardDb.js";
import {
  addCamera, ingestSonar, listCameras, listSonar,
  listAlerts, resolveAlert,
} from "../lib/crocguardDb.js";
import { getStatus, notifySonarUpdate } from "../lib/crocguardStatus.js";

const router = Router();

function normaliseAlert(row: AlertRow) {
  return {
    id:         row.id,
    source:     row.source,
    severity:   row.severity,
    confidence: row.confidence,
    snapshot:   row.snapshot ?? null,
    resolved:   Boolean(row.resolved),
    resolved_at: row.resolved_at != null ? new Date(row.resolved_at).toISOString() : null,
    timestamp:  new Date(row.created_at).toISOString(),
    metadata:   row.metadata ? (JSON.parse(row.metadata) as unknown) : null,
  };
}

// Block loopback and cloud-metadata endpoints; LAN RFC1918 is allowed (edge/RPi product)
const BLOCKED_HOST_RE = /^(127\.|::1$|0\.0\.0\.0|localhost|169\.254\.169\.254)/i;

function validateStreamUrl(raw: unknown): string {
  if (!raw || typeof raw !== "string" || !raw.trim())
    throw new Error("stream_url must be a non-empty string");
  let parsed: URL;
  try { parsed = new URL(raw.trim()); } catch { throw new Error("stream_url is not a valid URL"); }
  if (!["http:", "https:", "rtsp:"].includes(parsed.protocol))
    throw new Error("stream_url must use http, https, or rtsp");
  if (BLOCKED_HOST_RE.test(parsed.hostname))
    throw new Error(`stream_url host not allowed: ${parsed.hostname}`);
  return parsed.toString();
}

router.get("/status", (_req, res) => {
  res.json({ ok: true, ...getStatus() });
});

router.get("/cameras", (_req, res) => {
  res.json({
    ok: true,
    cameras: listCameras().map(c => ({
      id: c.id, name: c.name, stream_url: c.streamUrl,
      type: c.type, status: c.status,
      last_seen: c.lastSeen?.toISOString() ?? null,
    })),
  });
});

router.post("/cameras", (req, res) => {
  const body = req.body as Record<string, unknown>;
  const { name, type } = body;
  // Accept both snake_case and camelCase for stream URL
  const rawUrl = body["stream_url"] ?? body["streamUrl"];
  if (!name || typeof name !== "string" || !name.trim()) {
    res.status(400).json({ ok: false, error: "name is required" }); return;
  }
  let safeUrl: string;
  try { safeUrl = validateStreamUrl(rawUrl); }
  catch (err) { res.status(400).json({ ok: false, error: (err as Error).message }); return; }

  const validTypes = ["mjpeg", "hls", "snapshot"];
  const camType = typeof type === "string" && validTypes.includes(type) ? type : "mjpeg";
  try {
    const cam = addCamera(name.trim(), safeUrl, camType);
    res.status(201).json({
      ok: true,
      camera: { id: cam.id, name: cam.name, stream_url: cam.streamUrl, type: cam.type, status: cam.status, last_seen: null },
    });
  } catch (err) { res.status(500).json({ ok: false, error: String(err) }); }
});

router.get("/sonar", (_req, res) => {
  const units = listSonar().map(u => ({
    unit_id:          u.unitId,
    unit_name:        u.unitName,
    signal_level:     u.signalLevel,
    movement_detected: u.movementDetected,
    timestamp:        u.updatedAt.toISOString(),
  }));
  res.json({ ok: true, units, any_movement: units.some(u => u.movement_detected) });
});

router.post("/sonar", (req, res) => {
  const { unit_id, unit_name, signal_level, movement_detected } = req.body as Record<string, unknown>;
  if (!unit_id || typeof unit_id !== "string" || !unit_id.trim()) {
    res.status(400).json({ ok: false, error: "unit_id is required" }); return;
  }
  const sig = Number(signal_level);
  if (isNaN(sig) || sig < 0 || sig > 100) {
    res.status(400).json({ ok: false, error: "signal_level must be 0-100" }); return;
  }
  try {
    ingestSonar(unit_id.trim(), typeof unit_name === "string" ? unit_name : undefined,
      sig, Boolean(movement_detected), JSON.stringify(req.body));
    notifySonarUpdate();
    res.status(201).json({ ok: true, status: getStatus() });
  } catch (err) { res.status(500).json({ ok: false, error: String(err) }); }
});

router.get("/alerts", (req, res) => {
  const page  = Math.max(1, parseInt(String(req.query["page"]  ?? "1"),  10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(String(req.query["limit"] ?? "20"), 10) || 20));
  try {
    const { alerts, total } = listAlerts(page, limit);
    res.json({ ok: true, alerts: alerts.map(normaliseAlert), total, page, limit });
  } catch (err) { res.status(500).json({ ok: false, error: String(err) }); }
});

router.post("/alerts/resolve/:id", (req, res) => {
  const id = parseInt(req.params["id"] ?? "", 10);
  if (!id || isNaN(id)) { res.status(400).json({ ok: false, error: "Invalid alert id" }); return; }
  try {
    const row = resolveAlert(id);
    if (!row) { res.status(404).json({ ok: false, error: "Alert not found" }); return; }
    res.json({ ok: true, alert: normaliseAlert(row) });
  } catch (err) { res.status(500).json({ ok: false, error: String(err) }); }
});

export default router;
