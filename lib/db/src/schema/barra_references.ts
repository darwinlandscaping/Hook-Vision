/**
 * barra_references — verified barramundi photo library
 *
 * Populated from two sources:
 *  1. iNaturalist research-grade observations (auto-fetched at server startup)
 *  2. Community-confirmed catches from HookVision users
 *
 * These URLs are injected as few-shot visual examples into every
 * /api/barra-check call so the vision model compares against real specimens.
 */
import { boolean, integer, pgTable, serial, text, timestamp, varchar } from "drizzle-orm/pg-core";

export const barraReferences = pgTable("barra_references", {
  id:            serial("id").primaryKey(),
  source:        varchar("source", { length: 32 }).notNull(),  // "inat" | "community"
  photoUrl:      text("photo_url").notNull(),                   // URL or "community" sentinel for base64-only refs
  thumbUrl:      text("thumb_url"),                            // smaller version if available
  thumbBase64:   text("thumb_base64"),                         // compressed JPEG base64 (~3 KB) — stored for community catches
  observationId: varchar("observation_id", { length: 64 }),    // iNaturalist observation ID
  location:      varchar("location", { length: 255 }),         // e.g. "Darwin, NT, Australia"
  qualityGrade:  varchar("quality_grade", { length: 32 }),     // "research" | "needs_id" | "confirmed"
  description:   text("description"),                          // optional caption / feature notes
  viewingAngle:  varchar("viewing_angle", { length: 16 }),     // "top" | "side" | "angled" — classified by AI
  votes:         integer("votes").default(0),                  // iNat faves or community upvotes
  active:        boolean("active").default(true).notNull(),    // false = excluded from rotation
  addedAt:       timestamp("added_at", { withTimezone: true }).defaultNow().notNull(),
});

export type BarraReference = typeof barraReferences.$inferSelect;
