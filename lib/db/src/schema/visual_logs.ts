import {
  integer,
  jsonb,
  pgTable,
  serial,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";

/**
 * Visual Log
 *
 * Each row represents one AI Brain analysis session triggered from the
 * Cameras tab. Captures which camera sources fed into the brain, what
 * sonar context was provided, and what the AI concluded.
 *
 * Images themselves are NOT stored here (too large for PG TEXT) — only
 * metadata describing what was captured. Object storage is a future step.
 */
export const visualLogs = pgTable("visual_logs", {
  id:           serial("id").primaryKey(),
  sessionId:    text("session_id").notNull(),               // UUID — groups sources per brain call
  sources:      jsonb("sources").notNull(),                  // string[] e.g. ["insta360_live","smartlife_live"]
  imageCount:   integer("image_count").notNull().default(0),
  sonarContext: jsonb("sonar_context"),                      // sonar fields at time of call
  brainResult:  jsonb("brain_result"),                       // AI JSON response
  createdAt:    timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export type VisualLog       = typeof visualLogs.$inferSelect;
export type InsertVisualLog = typeof visualLogs.$inferInsert;
