/**
 * CrocGuard Database Layer
 * ────────────────────────────────────────────────────────────────────────────
 * Thin helpers over Drizzle/PostgreSQL for CrocGuard persisted data.
 * In-memory caches provide <1ms read access; the DB is only hit for writes
 * and initial hydration.
 *
 * Edge/RPi note: swap the import for better-sqlite3 + drizzle-orm/sqlite-core
 * to run offline without a PostgreSQL server.
 */
import { db, crocguardCameras, crocguardSonarReadings, crocguardAlerts } from "@workspace/db";
import { eq, desc, sql } from "drizzle-orm";
import { logger } from "./logger.js";

export type { CrocguardCamera, CrocguardSonarReading, CrocguardAlert } from "@workspace/db";

// ─── In-memory caches ────────────────────────────────────────────────────────

/** Keyed by camera id */
export const cameraCache = new Map<number, {
  id: number;
  name: string;
  streamUrl: string;
  type: string;
  status: string;
  lastSeen: Date | null;
}>();

/** Keyed by unit_id — only the LATEST reading per sonar unit */
export const sonarCache = new Map<string, {
  unitId: string;
  unitName: string | null;
  signalLevel: number;
  movementDetected: boolean;
  updatedAt: Date;
}>();

// ─── Schema migration guard ───────────────────────────────────────────────────

export async function initCrocguardDb(): Promise<void> {
  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS crocguard_cameras (
        id          SERIAL PRIMARY KEY,
        name        VARCHAR(128) NOT NULL,
        stream_url  TEXT         NOT NULL,
        type        VARCHAR(16)  NOT NULL DEFAULT 'mjpeg',
        status      VARCHAR(16)  NOT NULL DEFAULT 'offline',
        last_seen   TIMESTAMPTZ,
        added_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS crocguard_sonar_readings (
        id                SERIAL PRIMARY KEY,
        unit_id           VARCHAR(64)  NOT NULL,
        unit_name         VARCHAR(128),
        signal_level      REAL         NOT NULL,
        movement_detected BOOLEAN      NOT NULL DEFAULT FALSE,
        raw_payload       TEXT,
        recorded_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS crocguard_alerts (
        id          SERIAL PRIMARY KEY,
        source      VARCHAR(64)  NOT NULL,
        severity    VARCHAR(16)  NOT NULL,
        confidence  REAL         NOT NULL,
        snapshot    TEXT,
        resolved    BOOLEAN      NOT NULL DEFAULT FALSE,
        resolved_at TIMESTAMPTZ,
        metadata    TEXT,
        created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
      );
    `);
    await hydrateCaches();
    logger.info("CrocGuard DB initialised");
  } catch (err) {
    logger.warn({ err }, "CrocGuard DB init failed — running in memory-only mode");
  }
}

async function hydrateCaches(): Promise<void> {
  const cameras = await db.select().from(crocguardCameras);
  cameras.forEach(c => cameraCache.set(c.id, {
    id: c.id, name: c.name, streamUrl: c.streamUrl,
    type: c.type, status: c.status, lastSeen: c.lastSeen ?? null,
  }));

  const sonar = await db
    .select()
    .from(crocguardSonarReadings)
    .orderBy(desc(crocguardSonarReadings.recordedAt))
    .limit(200);

  for (const r of sonar) {
    if (!sonarCache.has(r.unitId)) {
      sonarCache.set(r.unitId, {
        unitId: r.unitId,
        unitName: r.unitName ?? null,
        signalLevel: r.signalLevel,
        movementDetected: r.movementDetected,
        updatedAt: r.recordedAt,
      });
    }
  }
}

// ─── Camera helpers ───────────────────────────────────────────────────────────

export async function addCamera(name: string, streamUrl: string, type: string) {
  const [row] = await db
    .insert(crocguardCameras)
    .values({ name, streamUrl, type, status: "offline" })
    .returning();
  if (!row) throw new Error("Camera insert returned no row");
  cameraCache.set(row.id, {
    id: row.id, name: row.name, streamUrl: row.streamUrl,
    type: row.type, status: row.status, lastSeen: null,
  });
  return row;
}

export async function setCameraStatus(id: number, status: "online" | "offline") {
  const now = new Date();
  await db
    .update(crocguardCameras)
    .set({ status, lastSeen: status === "online" ? now : undefined })
    .where(eq(crocguardCameras.id, id));
  const cached = cameraCache.get(id);
  if (cached) {
    cached.status = status;
    if (status === "online") cached.lastSeen = now;
  }
}

export function listCameras() {
  return Array.from(cameraCache.values());
}

// ─── Sonar helpers ────────────────────────────────────────────────────────────

export async function ingestSonar(
  unitId: string, unitName: string | undefined,
  signalLevel: number, movementDetected: boolean, raw?: string,
) {
  const now = new Date();
  await db.insert(crocguardSonarReadings).values({
    unitId, unitName, signalLevel, movementDetected, rawPayload: raw,
  });
  sonarCache.set(unitId, { unitId, unitName: unitName ?? null, signalLevel, movementDetected, updatedAt: now });
}

export function listSonar() {
  return Array.from(sonarCache.values());
}

// ─── Alert helpers ────────────────────────────────────────────────────────────

export async function createAlert(
  source: string, severity: "orange" | "red",
  confidence: number, snapshot?: string, metadata?: object,
) {
  const [row] = await db
    .insert(crocguardAlerts)
    .values({
      source, severity, confidence,
      snapshot: snapshot ?? null,
      metadata: metadata ? JSON.stringify(metadata) : null,
    })
    .returning();
  return row;
}

export async function resolveAlert(id: number) {
  const [row] = await db
    .update(crocguardAlerts)
    .set({ resolved: true, resolvedAt: new Date() })
    .where(eq(crocguardAlerts.id, id))
    .returning();
  return row;
}

export async function listAlerts(page = 1, limit = 20) {
  const offset = (page - 1) * limit;
  const rows = await db
    .select()
    .from(crocguardAlerts)
    .orderBy(desc(crocguardAlerts.createdAt))
    .limit(limit)
    .offset(offset);
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(crocguardAlerts);
  return { alerts: rows, total: count, page, limit };
}
