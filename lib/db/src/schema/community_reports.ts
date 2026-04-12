import { doublePrecision, integer, jsonb, pgTable, serial, text, timestamp, varchar } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const communityReports = pgTable("community_reports", {
  id: serial("id").primaryKey(),
  deviceId: varchar("device_id", { length: 64 }),
  species: varchar("species", { length: 255 }),
  fishCount: integer("fish_count"),
  depth: varchar("depth", { length: 64 }),
  locationName: varchar("location_name", { length: 255 }),
  lat: doublePrecision("lat"),
  lng: doublePrecision("lng"),
  conditions: jsonb("conditions"),
  lureSuggestion: text("lure_suggestion"),
  rawAnalysis: jsonb("raw_analysis"),
  submittedAt: timestamp("submitted_at", { withTimezone: true }).defaultNow().notNull(),
});

export const insertCommunityReportSchema = createInsertSchema(communityReports).omit({
  id: true,
  submittedAt: true,
});

export type CommunityReport = typeof communityReports.$inferSelect;
export type InsertCommunityReport = z.infer<typeof insertCommunityReportSchema>;
