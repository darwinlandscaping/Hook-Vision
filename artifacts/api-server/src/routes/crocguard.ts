import { Router } from "express";
import type { AlertRow } from "../lib/crocguardDb.js";
import {
  addCamera, ingestSonar, listCameras, listSonar,
  listAlerts, resolveAlert, getAlertStats,
} from "../lib/crocguardDb.js";
import { getStatus, notifySonarUpdate } from "../lib/crocguardStatus.js";

const router = Router();

// ─── Acoustic Deterrent State (in-memory) ────────────────────────────────────
type DeterrentMode  = "off" | "pulse" | "alarm" | "continuous";
type DeterrentSound = "siren" | "horn" | "dolphin" | "ultrasonic";

interface DeterrentState {
  mode:        DeterrentMode;
  sound:       DeterrentSound;
  autoMode:    boolean;
  triggeredAt: number | null;
  updatedAt:   number;
}

let deterrent: DeterrentState = {
  mode:        "off",
  sound:       "siren",
  autoMode:    true,
  triggeredAt: null,
  updatedAt:   Date.now(),
};

function normaliseDeterrent(overrideMode?: DeterrentMode) {
  return {
    mode:         overrideMode ?? deterrent.mode,
    sound:        deterrent.sound,
    auto_mode:    deterrent.autoMode,
    triggered_at: deterrent.triggeredAt ? new Date(deterrent.triggeredAt).toISOString() : null,
    updated_at:   new Date(deterrent.updatedAt).toISOString(),
  };
}

/** Called by other routes/services when croc status escalates to RED */
export function autoTriggerDeterrent() {
  if (deterrent.autoMode && deterrent.mode === "off") {
    deterrent.mode        = "alarm";
    deterrent.triggeredAt = Date.now();
    deterrent.updatedAt   = Date.now();
  }
}

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

// ─── GET /config — alert sensitivity thresholds (read-only) ──────────────────
router.get("/config", (_req, res) => {
  res.json({
    ok: true,
    thresholds: {
      red_visual: 70,
      orange_sonar_only: 65,
      red_combined_boost: 20,
    },
    decay: {
      red_to_orange_s: 30,
      orange_to_green_s: 60,
    },
    description: "red_visual: visual confidence % to trigger RED. orange_sonar_only: sonar-only max conf for ORANGE. decay times govern how quickly alert level drops when no new detections arrive.",
  });
});

// ─── GET /brain-context ───────────────────────────────────────────────────────
// Returns structured CrocGuard intelligence ready for injection into AI prompts.
// Used by the phone-app brain and the forecast AI to add live croc risk context.
router.get("/brain-context", (_req, res) => {
  const snap  = getStatus();
  let stats   = { total: 0, count24h: 0, latestAlert: null as null | ReturnType<typeof getAlertStats>["latestAlert"] };
  try { stats = getAlertStats(); } catch { /* DB not yet init on edge devices */ }

  const riskLabel: Record<string, string> = {
    green:  "LOW — no active detection",
    orange: "MEDIUM — movement detected, croc likely nearby",
    red:    "HIGH — active crocodile detection confirmed",
  };

  let aiBrief = `CrocGuard Waterway Safety Status: ${snap.status.toUpperCase()} — ${riskLabel[snap.status] ?? snap.status}.`;
  if (stats.count24h > 0) {
    aiBrief += ` ${stats.count24h} crocodile alert${stats.count24h > 1 ? "s" : ""} logged in the last 24 hours.`;
  }
  if (snap.status === "red") {
    aiBrief += " ACTIVE ALERT: Anglers must exercise extreme caution near water. Do not wade. Stay in vessel. CrocGuard device has detected a crocodile with high confidence.";
  } else if (snap.status === "orange") {
    aiBrief += " CAUTION: Crocodile movement detected. Avoid wading and use extra vigilance near water edges and boat ramps.";
  } else {
    aiBrief += " Conditions appear safe, but saltwater crocodiles are always a risk in these waterways — never wade or hang limbs over the water.";
  }

  res.json({
    ok: true,
    status:       snap.status,
    confidence:   snap.confidence,
    source:       snap.source,
    timestamp:    snap.timestamp,
    alerts_24h:   stats.count24h,
    alerts_total: stats.total,
    latest_alert: stats.latestAlert ? {
      id:         stats.latestAlert.id,
      severity:   stats.latestAlert.severity,
      confidence: stats.latestAlert.confidence,
      source:     stats.latestAlert.source,
      timestamp:  new Date(stats.latestAlert.created_at).toISOString(),
    } : null,
    ai_brief: aiBrief,
  });
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

// ─── Deterrent endpoints ──────────────────────────────────────────────────────

/** GET /api/crocguard/deterrent — current deterrent state
 *  If autoMode is on and CrocGuard is RED, effective mode is "alarm" regardless of stored mode. */
router.get("/deterrent", (_req, res) => {
  const snap = getStatus();
  let effective: DeterrentMode | undefined;
  if (deterrent.autoMode && snap.status === "red" && deterrent.mode === "off") {
    effective = "alarm";
  }
  res.json({ ok: true, croc_status: snap.status, deterrent: normaliseDeterrent(effective) });
});

/** POST /api/crocguard/deterrent — update mode / sound / auto_mode */
router.post("/deterrent", (req, res) => {
  const body = req.body as Record<string, unknown>;
  const validModes:  DeterrentMode[]  = ["off", "pulse", "alarm", "continuous"];
  const validSounds: DeterrentSound[] = ["siren", "horn", "dolphin", "ultrasonic"];

  if (body["mode"] !== undefined) {
    if (!validModes.includes(body["mode"] as DeterrentMode)) {
      res.status(400).json({ ok: false, error: `mode must be one of: ${validModes.join(", ")}` }); return;
    }
    deterrent.mode = body["mode"] as DeterrentMode;
  }
  if (body["sound"] !== undefined) {
    if (!validSounds.includes(body["sound"] as DeterrentSound)) {
      res.status(400).json({ ok: false, error: `sound must be one of: ${validSounds.join(", ")}` }); return;
    }
    deterrent.sound = body["sound"] as DeterrentSound;
  }
  if (body["auto_mode"] !== undefined) {
    deterrent.autoMode = Boolean(body["auto_mode"]);
  }
  deterrent.updatedAt = Date.now();
  res.json({ ok: true, deterrent: normaliseDeterrent() });
});

/** POST /api/crocguard/deterrent/trigger — manually fire one deterrent pulse */
router.post("/deterrent/trigger", (_req, res) => {
  deterrent.mode        = "pulse";
  deterrent.triggeredAt = Date.now();
  deterrent.updatedAt   = Date.now();
  res.json({ ok: true, deterrent: normaliseDeterrent(), message: "Acoustic deterrent triggered — one pulse fired" });
});

/** POST /api/crocguard/deterrent/off — silence / reset deterrent */
router.post("/deterrent/off", (_req, res) => {
  deterrent.mode      = "off";
  deterrent.updatedAt = Date.now();
  res.json({ ok: true, deterrent: normaliseDeterrent(), message: "Acoustic deterrent silenced" });
});

export default router;
