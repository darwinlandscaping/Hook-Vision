/**
 * bird_references — verified NT water bird photo library
 *
 * Populated from iNaturalist research-grade observations.
 * Species targeted are the seabirds and wading birds of Northern Territory
 * waters that fishers use as live bait-bird indicators:
 *
 *   • Frigatebirds (Lesser / Greater) — steep divers, bait-fish indicators
 *   • Crested Tern / Little Tern / Bridled Tern — tight-wheeling over busts
 *   • Brown Booby / Masked Booby / Red-footed Booby — plunge divers
 *   • Australian Pelican — large, conspicuous, pushes bait schools
 *   • Osprey — fishing raptor, circles over active bait balls
 *   • Brahminy Kite — scavenges near surface, follows fish activity
 *   • Little Black Cormorant / Little Pied Cormorant — low-level pack hunters
 *   • Australasian Darter — surface swimmer, anhingas-style dive
 *
 * Photos are injected as few-shot visual references into the surface-detect
 * pipeline so the model can recognise each species in real-world camera frames
 * and report with confidence when a species is spotted.
 */
import { boolean, integer, pgTable, serial, text, timestamp, varchar } from "drizzle-orm/pg-core";

export const birdReferences = pgTable("bird_references", {
  id:            serial("id").primaryKey(),
  source:        varchar("source", { length: 32 }).notNull(),     // "inat"
  species:       varchar("species", { length: 128 }),              // common name, e.g. "Crested Tern"
  taxonName:     varchar("taxon_name", { length: 128 }),           // scientific name
  photoUrl:      text("photo_url").notNull(),
  thumbUrl:      text("thumb_url"),
  thumbBase64:   text("thumb_base64"),                             // compressed JPEG base64 for fast injection
  observationId: varchar("observation_id", { length: 64 }),        // iNaturalist observation ID
  location:      varchar("location", { length: 255 }),             // e.g. "Darwin, NT, Australia"
  qualityGrade:  varchar("quality_grade", { length: 32 }),         // "research"
  description:   text("description"),
  poseType:      varchar("pose_type", { length: 24 }),             // "diving" | "aerial" | "perched" | "water" — AI classified
  votes:         integer("votes").default(0),
  active:        boolean("active").default(true).notNull(),
  addedAt:       timestamp("added_at", { withTimezone: true }).defaultNow().notNull(),
});

export type BirdReference = typeof birdReferences.$inferSelect;
