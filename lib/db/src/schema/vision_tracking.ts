import {
  integer,
  pgTable,
  real,
  serial,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";

export const visionSessions = pgTable("vision_sessions", {
  id:               serial("id").primaryKey(),
  region:           varchar("region", { length: 4 }).notNull(),
  startedAt:        timestamp("started_at",   { withTimezone: true }).defaultNow().notNull(),
  endedAt:          timestamp("ended_at",     { withTimezone: true }),
  totalBursts:      integer("total_bursts").default(0).notNull(),
  totalDetections:  integer("total_detections").default(0).notNull(),
});

export type VisionSession       = typeof visionSessions.$inferSelect;
export type InsertVisionSession = typeof visionSessions.$inferInsert;

export const visionDetections = pgTable("vision_detections", {
  id:          serial("id").primaryKey(),
  sessionId:   integer("session_id").notNull(),
  burstNum:    integer("burst_num").notNull(),
  frameNum:    integer("frame_num").notNull(),
  trackId:     varchar("track_id", { length: 32 }).notNull(),
  label:       text("label").notNull(),
  confidence:  real("confidence").notNull(),
  bboxX:       real("bbox_x").notNull(),
  bboxY:       real("bbox_y").notNull(),
  bboxW:       real("bbox_w").notNull(),
  bboxH:       real("bbox_h").notNull(),
  velocityDx:  real("velocity_dx"),
  velocityDy:  real("velocity_dy"),
  detectedAt:  timestamp("detected_at", { withTimezone: true }).defaultNow().notNull(),
});

export type VisionDetection       = typeof visionDetections.$inferSelect;
export type InsertVisionDetection = typeof visionDetections.$inferInsert;
