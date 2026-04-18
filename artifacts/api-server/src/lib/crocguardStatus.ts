import { sonarCache, createAlert } from "./crocguardDb.js";
import { logger } from "./logger.js";

export type TrafficLight = "green" | "orange" | "red";

export interface StatusSnapshot {
  status:     TrafficLight;
  confidence: number;
  source:     string | null;
  timestamp:  string;
}

let currentStatus: TrafficLight = "green";
let currentConf   = 0;
let currentSource: string | null = null;
let statusAt = Date.now();

const RANK: Record<TrafficLight, number> = { green: 0, orange: 1, red: 2 };

let lastRedTs    = 0;
let lastOrangeTs = 0;

const RED_SILENCE    = 30_000;
const ORANGE_SILENCE = 60_000;
const DECAY_TICK     = 5_000;

const visualScores = new Map<number, { conf: number; snapshot?: string; ts: number }>();

function checkDecay() {
  const now = Date.now();
  if (currentStatus === "red" && lastRedTs > 0 && now - lastRedTs >= RED_SILENCE) {
    logger.info("CrocGuard: RED → ORANGE (30s silence)");
    lastOrangeTs = now;
    lastRedTs    = 0;
    applyStatus("orange", Math.round(currentConf * 0.5), currentSource);
  }
  if (currentStatus === "orange" && lastOrangeTs > 0 && now - lastOrangeTs >= ORANGE_SILENCE) {
    logger.info("CrocGuard: ORANGE → GREEN (60s silence)");
    lastOrangeTs = 0;
    lastRedTs    = 0;
    applyStatus("green", 0, null);
  }
}

function applyStatus(s: TrafficLight, conf: number, source: string | null) {
  const prev = currentStatus;
  currentStatus = s;
  currentConf   = conf;
  currentSource = source;
  statusAt      = Date.now();

  if (prev !== s) {
    logger.info({ prev, next: s, conf, source }, "CrocGuard status changed");
    const snap = source?.startsWith("camera:")
      ? visualScores.get(Number(source.split(":")[1]))?.snapshot
      : undefined;
    try {
      createAlert(source ?? "system", s, conf, snap, { prev });
    } catch (err) {
      logger.warn({ err }, "CrocGuard: alert persist failed");
    }
  }
}

function fuse(): { status: TrafficLight; conf: number; source: string | null } {
  const now = Date.now();
  const movingSonar = Array.from(sonarCache.values()).find(u => u.movementDetected);
  const fresh = Array.from(visualScores.entries()).filter(([, v]) => now - v.ts < 5000);
  const best  = fresh.reduce<{ camId: number; conf: number } | null>((b, [id, v]) =>
    !b || v.conf > b.conf ? { camId: id, conf: v.conf } : b, null);

  const vis    = best?.conf ?? 0;
  const visSrc = best ? `camera:${best.camId}` : null;

  if (vis > 70)
    return { status: "red", conf: vis, source: visSrc };
  if (movingSonar && vis > 0)
    return { status: "red", conf: Math.min(vis + 20, 95), source: visSrc ?? `sonar:${movingSonar.unitId}` };
  if (movingSonar)
    return { status: "orange", conf: Math.min(movingSonar.signalLevel, 65), source: `sonar:${movingSonar.unitId}` };
  if (vis >= 30)
    return { status: "orange", conf: vis, source: visSrc };
  return { status: "green", conf: 0, source: null };
}

export function pushVisualScore(camId: number, conf: number, snapshot?: string) {
  visualScores.set(camId, { conf, snapshot, ts: Date.now() });
  evaluate();
}

export function notifySonarUpdate() {
  evaluate();
}

function evaluate() {
  const { status: fused, conf, source } = fuse();
  const now = Date.now();

  if (fused === "red")    { lastRedTs = now; lastOrangeTs = now; }
  else if (fused === "orange") { lastOrangeTs = now; }

  // Only escalate immediately; de-escalation is handled by checkDecay
  if (RANK[fused] >= RANK[currentStatus]) {
    applyStatus(fused, conf, source);
  }
}

export function getStatus(): StatusSnapshot {
  return {
    status:     currentStatus,
    confidence: Math.round(currentConf),
    source:     currentSource,
    timestamp:  new Date(statusAt).toISOString(),
  };
}

export function startDecayTick() {
  setInterval(checkDecay, DECAY_TICK);
}
