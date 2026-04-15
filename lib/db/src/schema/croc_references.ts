/**
 * croc_references — verified saltwater crocodile (Crocodylus porosus) photo library
 *
 * Populated from iNaturalist research-grade observations.
 * These photos (out-of-water body shape views) are injected into every
 * sonar analysis call as cross-modal shape references so the vision
 * model can compare sonar blob shapes against confirmed croc body outlines.
 *
 * Cross-modal reasoning: the AI learns what a croc looks like from above/side
 * and maps that silhouette to the large filled blob seen on 2D sonar or
 * live scope when a croc glides near-surface in NT waterways.
 */
import { boolean, integer, pgTable, serial, text, timestamp, varchar } from "drizzle-orm/pg-core";

export const crocReferences = pgTable("croc_references", {
  id:            serial("id").primaryKey(),
  source:        varchar("source", { length: 32 }).notNull(),   // "inat" | "community"
  photoUrl:      text("photo_url").notNull(),
  thumbUrl:      text("thumb_url"),
  thumbBase64:   text("thumb_base64"),                          // compressed JPEG base64 stored for fast injection
  observationId: varchar("observation_id", { length: 64 }),     // iNaturalist observation ID
  location:      varchar("location", { length: 255 }),          // e.g. "Darwin, NT, Australia"
  qualityGrade:  varchar("quality_grade", { length: 32 }),      // "research" | "confirmed"
  description:   text("description"),
  viewingAngle:  varchar("viewing_angle", { length: 16 }),      // "top" | "side" | "angled" — classified by AI
  outOfWater:    boolean("out_of_water").default(true),         // prefer photos where full body shape is visible
  votes:         integer("votes").default(0),
  active:        boolean("active").default(true).notNull(),
  addedAt:       timestamp("added_at", { withTimezone: true }).defaultNow().notNull(),
});

export type CrocReference = typeof crocReferences.$inferSelect;
