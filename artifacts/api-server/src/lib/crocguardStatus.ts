/**
 * CrocGuard Status Fusion Engine
 * ────────────────────────────────────────────────────────────────────────────
 * Combines visual-detection scores from cameras and sonar readings into a
 * single traffic-light status: green / orange / red.
 *
 * Fusion logic
 * ─────────────
 * RED    : visual confidence > 70%
 *          OR (sonar movement + any visual confidence > 0)
 * ORANGE : sonar movement detected
 *          OR visual confidence 30-70%
 * GREEN  : everything else
 *
 * Auto-decay — silence-based, not age-based
 * ──────────────────────────────────────────
 * "Silence" = no new qualifying detection has arrived within the threshold.
 * Every qualifying detection refreshes the relevant silence timer.
 *
 * RED   → ORANGE after 30 s of silence (no new RED-triggering detection)
 * ORANGE → GREEN  after 60 s of silence (no new ORANGE-triggering detection)
 *
 * A single 5-second setInterval checks whether the current status should decay.
 * This avoids the delayed-setTimeout anti-pattern where timers fire even when
 * new detections are continuing to arrive.
 */

import { sonarCache } from "./crocguardDb.js";
import { createAlert } from "./crocguardDb.js";
import { logger } from "./logger.js";

export type TrafficLight = "green" | "orange" | "red";

export interface StatusSnapshot {
  status:     TrafficLight;
  confidence: number;       // 0-100
  source:     string | null;
  updatedAt:  string;       // ISO timestamp
}

// ─── State ────────────────────────────────────────────────────────────────────

let currentStatus: TrafficLight = "green";
let currentConf   = 0;
let currentSource: string | null = null;
let statusChangedAt = Date.now();

/**
 * Last time a detection arrived that meets the RED escalation threshold.
 * Set to 0 when we leave RED (cleared on decay).
 */
let lastRedTriggerTs = 0;

/**
 * Last time a detection arrived that meets the ORANGE escalation threshold
 * (includes sonar movement and 30-70% visual confidence).
 * Set to 0 when we leave ORANGE (cleared on decay).
 */
let lastOrangeTriggerTs = 0;

const RED_SILENCE_MS    = 30_000;  // 30 s
const ORANGE_SILENCE_MS = 60_000;  // 60 s
const DECAY_TICK_MS     = 5_000;   // check decay every 5 s

/** Latest visual confidence per camera id — expires after 5 s of no updates */
const visualScores = new Map<number, { conf: number; snapshot?: string; ts: number }>();

// ─── Decay check (runs on interval) ──────────────────────────────────────────

function checkDecay() {
  const now = Date.now();

  if (currentStatus === "red" && lastRedTriggerTs > 0) {
    if (now - lastRedTriggerTs >= RED_SILENCE_MS) {
      logger.info("CrocGuard: RED → ORANGE (30 s silence)");
      applyStatus("orange", currentConf * 0.5, currentSource);
      lastRedTriggerTs = 0;
      // Immediately seed orange silence from now
      lastOrangeTriggerTs = now;
    }
  }

  if (currentStatus === "orange" && lastOrangeTriggerTs > 0) {
    if (now - lastOrangeTriggerTs >= ORANGE_SILENCE_MS) {
      logger.info("CrocGuard: ORANGE → GREEN (60 s silence)");
      applyStatus("green", 0, null);
      lastOrangeTriggerTs = 0;
    }
  }
}

// ─── Core status application ──────────────────────────────────────────────────

function applyStatus(
  newStatus: TrafficLight, conf: number, source: string | null,
): void {
  const prev = currentStatus;
  currentStatus  = newStatus;
  currentConf    = conf;
  currentSource  = source;
  statusChangedAt = Date.now();

  if (prev !== newStatus) {
    logger.info({ prev, next: newStatus, conf, source }, "CrocGuard status changed");

    if (newStatus === "red" || newStatus === "orange") {
      const snapshot = source?.startsWith("camera:")
        ? (visualScores.get(Number(source.split(":")[1]))?.snapshot)
        : undefined;
      try {
        createAlert(source ?? "system", newStatus, conf, snapshot, { prev });
      } catch (err) {
        logger.warn({ err }, "CrocGuard: failed to persist alert");
      }
    }
  }
}

// ─── Fusion ───────────────────────────────────────────────────────────────────

function fuse(): { status: TrafficLight; conf: number; source: string | null } {
  const now = Date.now();

  // Gather sonar
  const sonarUnits = Array.from(sonarCache.values());
  const movingSonar = sonarUnits.find(u => u.movementDetected);

  // Gather fresh visual scores (stale > 5 s)
  const fresh = Array.from(visualScores.entries()).filter(([, v]) => now - v.ts < 5000);
  const maxVis = fresh.reduce<{ camId: number; conf: number } | null>((best, [id, v]) => {
    if (!best || v.conf > best.conf) return { camId: id, conf: v.conf };
    return best;
  }, null);

  const visualConf   = maxVis?.conf ?? 0;
  const visualSource = maxVis ? `camera:${maxVis.camId}` : null;

  // RED
  if (visualConf > 70) {
    return { status: "red", conf: visualConf, source: visualSource };
  }
  if (movingSonar && visualConf > 0) {
    return {
      status: "red",
      conf: Math.min(visualConf + 20, 95),
      source: visualSource ?? `sonar:${movingSonar.unitId}`,
    };
  }

  // ORANGE
  if (movingSonar) {
    return {
      status: "orange",
      conf: Math.min(movingSonar.signalLevel, 65),
      source: `sonar:${movingSonar.unitId}`,
    };
  }
  if (visualConf >= 30) {
    return { status: "orange", conf: visualConf, source: visualSource };
  }

  // GREEN
  return { status: "green", conf: 0, source: null };
}

// ─── Called by detector / sonar endpoints ─────────────────────────────────────

export function pushVisualScore(camId: number, conf: number, snapshot?: string): void {
  visualScores.set(camId, { conf, snapshot, ts: Date.now() });
  evaluate();
}

export function notifySonarUpdate(): void {
  evaluate();
}

function evaluate(): void {
  const { status, conf, source } = fuse();
  const now = Date.now();

  // Refresh trigger timestamps for decay tracking
  if (status === "red") {
    lastRedTriggerTs    = now;
    lastOrangeTriggerTs = now; // red implies orange-level activity too
  } else if (status === "orange") {
    lastOrangeTriggerTs = now;
    // Do NOT reset lastRedTriggerTs — it keeps decaying in background
  }

  applyStatus(status, conf, source);
}

// ─── Exported read ────────────────────────────────────────────────────────────

export function getStatus(): StatusSnapshot {
  return {
    status:     currentStatus,
    confidence: Math.round(currentConf),
    source:     currentSource,
    updatedAt:  new Date(statusChangedAt).toISOString(),
  };
}

// ─── Start decay tick ─────────────────────────────────────────────────────────

export function startDecayTick(): void {
  setInterval(checkDecay, DECAY_TICK_MS);
}
