/**
 * CrocGuard Database Layer — SQLite (better-sqlite3)
 * ────────────────────────────────────────────────────────────────────────────
 * Uses its own SQLite file (crocguard.db) — fully self-contained, no external
 * database server required. Designed to run on Raspberry Pi 4 or any Linux
 * device.  In-memory Maps provide <1 ms read access for hot-path camera and
 * sonar state; SQLite is used for writes and alert history only.
 */

import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";
import { logger } from "./logger.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = process.env["CROCGUARD_DB_PATH"]
  ?? path.join(__dirname, "../../crocguard.db");

let _db: Database.Database | null = null;

function getDb(): Database.Database {
  if (!_db) throw new Error("CrocGuard DB not initialised — call initCrocguardDb() first");
  return _db;
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CrocCamera {
  id: number;
  name: string;
  streamUrl: string;
  type: string;         // mjpeg | hls | snapshot
  status: string;       // online | offline
  lastSeen: Date | null;
}

export interface SonarReading {
  unitId: string;
  unitName: string | null;
  signalLevel: number;  // 0-100
  movementDetected: boolean;
  updatedAt: Date;
}

/** Raw SQLite row — column names match the alerts table (snake_case). */
export interface AlertRow {
  id: number;
  source: string;
  severity: string;       // orange | red
  confidence: number;
  snapshot: string | null;
  resolved: number;       // SQLite INTEGER: 0 | 1
  resolved_at: number | null; // epoch ms (INTEGER)
  metadata: string | null;
  created_at: number;     // epoch ms (INTEGER)
}

// ─── In-memory caches ────────────────────────────────────────────────────────

/** Live camera registry — keyed by camera id */
export const cameraCache = new Map<number, CrocCamera>();

/** Latest sonar reading per unit_id — keyed by unitId */
export const sonarCache = new Map<string, SonarReading>();

// ─── Initialisation ───────────────────────────────────────────────────────────

export function initCrocguardDb(): void {
  _db = new Database(DB_PATH, { verbose: undefined });

  // WAL mode for better concurrent read performance (important on RPi SD cards)
  _db.pragma("journal_mode = WAL");
  _db.pragma("foreign_keys = ON");

  _db.exec(`
    CREATE TABLE IF NOT EXISTS cameras (
      id        INTEGER PRIMARY KEY AUTOINCREMENT,
      name      TEXT    NOT NULL,
      stream_url TEXT   NOT NULL,
      type      TEXT    NOT NULL DEFAULT 'mjpeg',
      status    TEXT    NOT NULL DEFAULT 'offline',
      last_seen INTEGER,           -- unix epoch ms
      added_at  INTEGER NOT NULL DEFAULT (unixepoch('now') * 1000)
    );

    CREATE TABLE IF NOT EXISTS sonar_readings (
      id                INTEGER PRIMARY KEY AUTOINCREMENT,
      unit_id           TEXT    NOT NULL,
      unit_name         TEXT,
      signal_level      REAL    NOT NULL,
      movement_detected INTEGER NOT NULL DEFAULT 0,
      raw_payload       TEXT,
      recorded_at       INTEGER NOT NULL DEFAULT (unixepoch('now') * 1000)
    );

    CREATE INDEX IF NOT EXISTS idx_sonar_unit_time
      ON sonar_readings (unit_id, recorded_at DESC);

    CREATE TABLE IF NOT EXISTS alerts (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      source      TEXT    NOT NULL,
      severity    TEXT    NOT NULL,
      confidence  REAL    NOT NULL,
      snapshot    TEXT,
      resolved    INTEGER NOT NULL DEFAULT 0,
      resolved_at INTEGER,
      metadata    TEXT,
      created_at  INTEGER NOT NULL DEFAULT (unixepoch('now') * 1000)
    );

    CREATE INDEX IF NOT EXISTS idx_alerts_created
      ON alerts (created_at DESC);
  `);

  hydrateCaches();
  logger.info({ dbPath: DB_PATH }, "CrocGuard SQLite DB initialised");
}

function msToDate(ms: number | null): Date | null {
  return ms != null ? new Date(ms) : null;
}

function hydrateCaches(): void {
  const db = getDb();

  const cameras = db.prepare("SELECT * FROM cameras").all() as Array<{
    id: number; name: string; stream_url: string; type: string;
    status: string; last_seen: number | null;
  }>;
  cameras.forEach(c => cameraCache.set(c.id, {
    id: c.id, name: c.name, streamUrl: c.stream_url,
    type: c.type, status: c.status, lastSeen: msToDate(c.last_seen),
  }));

  // Only load latest reading per unit
  const rows = db.prepare(`
    SELECT s.*
    FROM   sonar_readings s
    INNER JOIN (
      SELECT unit_id, MAX(recorded_at) AS max_ts
      FROM   sonar_readings
      GROUP  BY unit_id
    ) latest ON s.unit_id = latest.unit_id AND s.recorded_at = latest.max_ts
  `).all() as Array<{
    unit_id: string; unit_name: string | null;
    signal_level: number; movement_detected: number; recorded_at: number;
  }>;
  rows.forEach(r => sonarCache.set(r.unit_id, {
    unitId: r.unit_id, unitName: r.unit_name,
    signalLevel: r.signal_level,
    movementDetected: Boolean(r.movement_detected),
    updatedAt: new Date(r.recorded_at),
  }));

  logger.info(
    { cameras: cameraCache.size, sonarUnits: sonarCache.size },
    "CrocGuard caches hydrated",
  );
}

// ─── Camera CRUD ──────────────────────────────────────────────────────────────

export function addCamera(name: string, streamUrl: string, type: string): CrocCamera {
  const db = getDb();
  const info = db.prepare(
    "INSERT INTO cameras (name, stream_url, type) VALUES (?, ?, ?)"
  ).run(name, streamUrl, type);
  const id = info.lastInsertRowid as number;
  const cam: CrocCamera = { id, name, streamUrl, type, status: "offline", lastSeen: null };
  cameraCache.set(id, cam);
  return cam;
}

export function setCameraStatus(id: number, status: "online" | "offline"): void {
  const db = getDb();
  const now = Date.now();
  if (status === "online") {
    db.prepare("UPDATE cameras SET status = ?, last_seen = ? WHERE id = ?").run(status, now, id);
    const cached = cameraCache.get(id);
    if (cached) { cached.status = status; cached.lastSeen = new Date(now); }
  } else {
    db.prepare("UPDATE cameras SET status = ? WHERE id = ?").run(status, id);
    const cached = cameraCache.get(id);
    if (cached) cached.status = status;
  }
}

export function listCameras(): CrocCamera[] {
  return Array.from(cameraCache.values());
}

// ─── Sonar CRUD ───────────────────────────────────────────────────────────────

export function ingestSonar(
  unitId: string, unitName: string | undefined,
  signalLevel: number, movementDetected: boolean, raw?: string,
): void {
  const db = getDb();
  db.prepare(
    `INSERT INTO sonar_readings (unit_id, unit_name, signal_level, movement_detected, raw_payload)
     VALUES (?, ?, ?, ?, ?)`
  ).run(unitId, unitName ?? null, signalLevel, movementDetected ? 1 : 0, raw ?? null);

  sonarCache.set(unitId, {
    unitId, unitName: unitName ?? null,
    signalLevel, movementDetected, updatedAt: new Date(),
  });
}

export function listSonar(): SonarReading[] {
  return Array.from(sonarCache.values());
}

// ─── Alert CRUD ───────────────────────────────────────────────────────────────

export function createAlert(
  source: string, severity: "orange" | "red",
  confidence: number, snapshot?: string, metadata?: object,
): AlertRow {
  const db = getDb();
  const info = db.prepare(
    `INSERT INTO alerts (source, severity, confidence, snapshot, metadata)
     VALUES (?, ?, ?, ?, ?)`
  ).run(source, severity, confidence, snapshot ?? null, metadata ? JSON.stringify(metadata) : null);
  const id = info.lastInsertRowid as number;
  return db.prepare("SELECT * FROM alerts WHERE id = ?").get(id) as AlertRow;
}

export function resolveAlert(id: number): AlertRow | null {
  const db = getDb();
  const now = Date.now();
  db.prepare("UPDATE alerts SET resolved = 1, resolved_at = ? WHERE id = ?").run(now, id);
  return (db.prepare("SELECT * FROM alerts WHERE id = ?").get(id) as AlertRow) ?? null;
}

export function listAlerts(page = 1, limit = 20): { alerts: AlertRow[]; total: number; page: number; limit: number } {
  const db = getDb();
  const offset = (page - 1) * limit;
  const alerts = db.prepare(
    "SELECT * FROM alerts ORDER BY created_at DESC LIMIT ? OFFSET ?"
  ).all(limit, offset) as AlertRow[];
  const { total } = db.prepare("SELECT COUNT(*) AS total FROM alerts").get() as { total: number };
  return { alerts, total, page, limit };
}
