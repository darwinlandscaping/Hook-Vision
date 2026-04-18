/**
 * CrocGuard DB Schema
 * ─────────────────────────────────────────────────────────────
 * Persists cameras, sonar units and detection alert history.
 * Designed for the CrocGuard floating-device detection system.
 *
 * NOTE: On edge/RPi deployments this schema is mirrored in a
 * local SQLite DB via better-sqlite3.  In the cloud environment
 * PostgreSQL (Drizzle) is used.
 */
import {
  boolean,
  integer,
  pgTable,
  real,
  serial,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";

// ─── Cameras ─────────────────────────────────────────────────────────────────

export const crocguardCameras = pgTable("crocguard_cameras", {
  id:        serial("id").primaryKey(),
  name:      varchar("name", { length: 128 }).notNull(),
  streamUrl: text("stream_url").notNull(),
  type:      varchar("type", { length: 16 }).notNull().default("mjpeg"), // mjpeg | hls | snapshot
  status:    varchar("status", { length: 16 }).notNull().default("offline"), // online | offline
  lastSeen:  timestamp("last_seen", { withTimezone: true }),
  addedAt:   timestamp("added_at",  { withTimezone: true }).defaultNow().notNull(),
});

export type CrocguardCamera = typeof crocguardCameras.$inferSelect;
export type CrocguardCameraInsert = typeof crocguardCameras.$inferInsert;

// ─── Sonar units ─────────────────────────────────────────────────────────────

export const crocguardSonarReadings = pgTable("crocguard_sonar_readings", {
  id:               serial("id").primaryKey(),
  unitId:           varchar("unit_id",   { length: 64 }).notNull(),
  unitName:         varchar("unit_name", { length: 128 }),
  signalLevel:      real("signal_level").notNull(), // 0-100
  movementDetected: boolean("movement_detected").notNull().default(false),
  rawPayload:       text("raw_payload"),
  recordedAt:       timestamp("recorded_at", { withTimezone: true }).defaultNow().notNull(),
});

export type CrocguardSonarReading = typeof crocguardSonarReadings.$inferSelect;

// ─── Detection alerts ─────────────────────────────────────────────────────────

export const crocguardAlerts = pgTable("crocguard_alerts", {
  id:         serial("id").primaryKey(),
  source:     varchar("source",   { length: 64 }).notNull(),  // camera id or "sonar:<unitId>"
  severity:   varchar("severity", { length: 16 }).notNull(),  // orange | red
  confidence: real("confidence").notNull(),                    // 0-100
  snapshot:   text("snapshot"),                               // base64 JPEG thumbnail (optional)
  resolved:   boolean("resolved").notNull().default(false),
  resolvedAt: timestamp("resolved_at", { withTimezone: true }),
  metadata:   text("metadata"),                               // JSON blob of extra context
  createdAt:  timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export type CrocguardAlert     = typeof crocguardAlerts.$inferSelect;
export type CrocguardAlertSeverity = "orange" | "red";
