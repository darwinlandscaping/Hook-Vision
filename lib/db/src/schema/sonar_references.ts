/**
 * sonar_references — verified barramundi sonar arch library
 *
 * Community-confirmed sonar scans showing barramundi arches.
 * The 5 built-in demo images (loaded in memory from demoReference.ts)
 * are the primary reference pool; this table grows the pool over time
 * as HookVision users submit and confirm sonar scans.
 *
 * Each call to /api/analyze injects 2–3 reference images as few-shot
 * visual examples so the model sees confirmed barra arch patterns first.
 */
import { boolean, integer, pgTable, serial, text, timestamp, varchar } from "drizzle-orm/pg-core";

export const sonarReferences = pgTable("sonar_references", {
  id:            serial("id").primaryKey(),
  source:        varchar("source", { length: 32 }).notNull(),   // "community" | "curated"
  imageBase64:   text("image_base64").notNull(),                 // compressed JPEG base64
  brand:         varchar("brand", { length: 64 }),              // "Lowrance" | "Garmin" | "Humminbird" | "Simrad" | "Deeper"
  archType:      varchar("arch_type", { length: 64 }),          // "barra_arch" | "barra_shadow" | "negative_threadfin" | "multi_species"
  description:   text("description"),                            // what the ref shows
  depth:         varchar("depth", { length: 32 }),              // e.g. "8m"
  fishCount:     integer("fish_count"),
  confirmedCount:integer("confirmed_count").default(1),         // how many users confirmed this
  active:        boolean("active").default(true).notNull(),
  addedAt:       timestamp("added_at", { withTimezone: true }).defaultNow().notNull(),
});

export type SonarReference = typeof sonarReferences.$inferSelect;
