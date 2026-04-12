import { integer, jsonb, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const communityInsights = pgTable("community_insights", {
  id: serial("id").primaryKey(),
  generatedAt: timestamp("generated_at", { withTimezone: true }).defaultNow().notNull(),
  reportCount: integer("report_count").notNull().default(0),
  hotSpecies: jsonb("hot_species"),
  hotDepths: jsonb("hot_depths"),
  hotTimes: jsonb("hot_times"),
  hotLocations: jsonb("hot_locations"),
  tips: jsonb("tips"),
  summary: text("summary"),
});

export const insertCommunityInsightSchema = createInsertSchema(communityInsights).omit({
  id: true,
  generatedAt: true,
});

export type CommunityInsight = typeof communityInsights.$inferSelect;
export type InsertCommunityInsight = z.infer<typeof insertCommunityInsightSchema>;
