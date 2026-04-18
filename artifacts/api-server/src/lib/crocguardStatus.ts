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
 * Auto-decay timers
 * ─────────────────
 * RED   → ORANGE after 30 s of no new RED-triggering detection
 * ORANGE → GREEN  after 60 s of no new ORANGE-triggering detection
 */

import { sonarCache } from "./crocguardDb.js";
import { createAlert } from "./crocguardDb.js";
import { logger } from "./logger.js";

// ─── Types ────────────────────────────────────────────────────────────────────

export type TrafficLight = "green" | "orange" | "red";

export interface StatusSnapshot {
  status:     TrafficLight;
  confidence: number;           // 0-100 — highest single-source score
  source:     string | null;    // which camera/sonar triggered the current level
  updatedAt:  string;           // ISO timestamp
}

// ─── Module state ─────────────────────────────────────────────────────────────

/** Latest visual confidence per camera id */
const visualScores = new Map<number, { conf: number; snapshot?: string; ts: number }>();

let currentStatus: TrafficLight = "green";
let currentConf   = 0;
let currentSource: string | null = null;
let lastStatusChange = Date.now();

let redDecayTimer:    ReturnType<typeof setTimeout> | null = null;
let orangeDecayTimer: ReturnType<typeof setTimeout> | null = null;

// ─── Decay helpers ────────────────────────────────────────────────────────────

function scheduleRedDecay() {
  if (redDecayTimer) clearTimeout(redDecayTimer);
  redDecayTimer = setTimeout(() => {
    if (currentStatus === "red") {
      updateStatus("orange", currentConf * 0.5, currentSource, true);
      scheduleOrangeDecay();
    }
  }, 30_000);
}

function scheduleOrangeDecay() {
  if (orangeDecayTimer) clearTimeout(orangeDecayTimer);
  orangeDecayTimer = setTimeout(() => {
    if (currentStatus === "orange") {
      updateStatus("green", 0, null, true);
    }
  }, 60_000);
}

function cancelDecayTimers() {
  if (redDecayTimer)    clearTimeout(redDecayTimer);
  if (orangeDecayTimer) clearTimeout(orangeDecayTimer);
  redDecayTimer = orangeDecayTimer = null;
}

// ─── Core fusion ─────────────────────────────────────────────────────────────

function fuse(): { status: TrafficLight; conf: number; source: string | null } {
  // Gather sonar state
  const sonarUnits    = Array.from(sonarCache.values());
  const sonarMovement = sonarUnits.some(u => u.movementDetected);

  // Gather visual state
  const now = Date.now();
  // Scores older than 5 s are considered stale
  const freshVisual = Array.from(visualScores.entries())
    .filter(([, v]) => now - v.ts < 5000);
  const maxVisual   = freshVisual.reduce<{ camId: number; conf: number } | null>((best, [id, v]) => {
    if (!best || v.conf > best.conf) return { camId: id, conf: v.conf };
    return best;
  }, null);

  const visualConf   = maxVisual?.conf ?? 0;
  const visualSource = maxVisual ? `camera:${maxVisual.camId}` : null;
  const movingSonar  = sonarUnits.find(u => u.movementDetected);

  // RED
  if (visualConf > 70) {
    return { status: "red", conf: visualConf, source: visualSource };
  }
  if (sonarMovement && visualConf > 0) {
    return {
      status: "red",
      conf: Math.min(visualConf + 20, 95),
      source: movingSonar ? `sonar:${movingSonar.unitId}` : visualSource,
    };
  }

  // ORANGE
  if (sonarMovement) {
    return {
      status: "orange",
      conf: Math.min(movingSonar!.signalLevel, 65),
      source: `sonar:${movingSonar!.unitId}`,
    };
  }
  if (visualConf >= 30) {
    return { status: "orange", conf: visualConf, source: visualSource };
  }

  // GREEN
  return { status: "green", conf: 0, source: null };
}

async function updateStatus(
  newStatus: TrafficLight, conf: number, source: string | null, decay = false,
) {
  const prev = currentStatus;
  currentStatus = newStatus;
  currentConf   = conf;
  currentSource = source;
  lastStatusChange = Date.now();

  if (!decay && prev !== newStatus) {
    logger.info({ prev, next: newStatus, conf, source }, "CrocGuard status changed");

    // Persist alert on escalation
    if (newStatus === "red" || newStatus === "orange") {
      const snapshot = source?.startsWith("camera:")
        ? (visualScores.get(Number(source.split(":")[1]))?.snapshot)
        : undefined;
      createAlert(source ?? "system", newStatus, conf, snapshot, { prev, decay }).catch(() => {});
    }

    // Manage decay timers
    if (newStatus === "red")    { cancelDecayTimers(); scheduleRedDecay(); }
    else if (newStatus === "orange") { cancelDecayTimers(); scheduleOrangeDecay(); }
    else                             { cancelDecayTimers(); }
  }
}

// ─── Called by detector on each frame ────────────────────────────────────────

export function pushVisualScore(camId: number, conf: number, snapshot?: string): void {
  visualScores.set(camId, { conf, snapshot, ts: Date.now() });
  const { status, conf: c, source } = fuse();
  updateStatus(status, c, source).catch(() => {});
}

/** Called externally when a new sonar reading is ingested */
export function notifySonarUpdate(): void {
  const { status, conf, source } = fuse();
  updateStatus(status, conf, source).catch(() => {});
}

// ─── Read state ───────────────────────────────────────────────────────────────

export function getStatus(): StatusSnapshot {
  return {
    status:     currentStatus,
    confidence: Math.round(currentConf),
    source:     currentSource,
    updatedAt:  new Date(lastStatusChange).toISOString(),
  };
}
