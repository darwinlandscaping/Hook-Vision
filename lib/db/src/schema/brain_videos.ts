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
 * Brain Video Library
 * Each row represents a video the user added to the brain.
 * Mobile extracts frames via expo-video-thumbnails and POSTs them
 * to /api/brain/video. The API CV pipeline (TF.js + OpenCV) analyses
 * every frame, then GPT-4.1 synthesises the findings into brain intelligence.
 */
export const brainVideos = pgTable("brain_videos", {
  id:              serial("id").primaryKey(),
  title:           varchar("title", { length: 255 }).notNull(),
  description:     text("description"),
  durationSecs:    integer("duration_secs"),
  frameCount:      integer("frame_count").default(0),

  // Processing status: queued → processing → done | failed
  status:          varchar("status", { length: 16 }).default("queued").notNull(),

  // Aggregated CV scan results (echoCoverage, speciesDist, etc.)
  cvSummary:       jsonb("cv_summary"),

  // GPT-4.1 brain synthesis — feeds back into community insights
  brainInsight:    text("brain_insight"),
  detectedSpecies: jsonb("detected_species"),   // string[]
  depthRanges:     jsonb("depth_ranges"),        // string[]
  aiTips:          jsonb("ai_tips"),             // string[]

  // Local device URI stored so the client can re-open the original video file
  videoUri:        text("video_uri"),

  submittedAt:     timestamp("submitted_at", { withTimezone: true }).defaultNow().notNull(),
  processedAt:     timestamp("processed_at", { withTimezone: true }),
});

export type BrainVideo    = typeof brainVideos.$inferSelect;
export type InsertBrainVideo = typeof brainVideos.$inferInsert;
