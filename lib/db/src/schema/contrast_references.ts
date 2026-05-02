/**
 * contrast_references — species contrast photo library
 *
 * Stores photos of NT priority species that are commonly confused with
 * Barramundi: Mangrove Jack, Threadfin Salmon, and Fingermark.
 *
 * These photos are injected alongside barramundi reference photos in AI
 * sonar analysis calls so the model can see what NOT to call a barramundi.
 * Cross-modal reasoning: body photo → expected sonar arch shape → verdict.
 *
 * Sources: iNaturalist research-grade observations (open CC license)
 */
import { boolean, integer, pgTable, serial, text, timestamp, varchar } from "drizzle-orm/pg-core";

export const contrastReferences = pgTable("contrast_references", {
  id:            serial("id").primaryKey(),
  species:       varchar("species", { length: 64 }).notNull(),   // "mangrove_jack" | "threadfin_salmon" | "fingermark"
  scientificName:varchar("scientific_name", { length: 128 }),    // e.g. "Lutjanus argentimaculatus"
  source:        varchar("source", { length: 32 }).notNull(),    // "inat" | "gbif" | "community"
  photoUrl:      text("photo_url").notNull(),
  thumbUrl:      text("thumb_url"),
  thumbBase64:   text("thumb_base64"),
  observationId: varchar("observation_id", { length: 64 }),
  location:      varchar("location", { length: 255 }),
  qualityGrade:  varchar("quality_grade", { length: 32 }),
  votes:         integer("votes").default(0),
  active:        boolean("active").default(true).notNull(),
  addedAt:       timestamp("added_at", { withTimezone: true }).defaultNow().notNull(),
});

export type ContrastReference = typeof contrastReferences.$inferSelect;
