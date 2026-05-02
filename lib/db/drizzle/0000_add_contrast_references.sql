CREATE TABLE "conversations" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "messages" (
	"id" serial PRIMARY KEY NOT NULL,
	"conversation_id" integer NOT NULL,
	"role" text NOT NULL,
	"content" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "community_reports" (
	"id" serial PRIMARY KEY NOT NULL,
	"device_id" varchar(64),
	"species" varchar(255),
	"fish_count" integer,
	"depth" varchar(64),
	"location_name" varchar(255),
	"lat" double precision,
	"lng" double precision,
	"conditions" jsonb,
	"lure_suggestion" text,
	"raw_analysis" jsonb,
	"submitted_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "community_insights" (
	"id" serial PRIMARY KEY NOT NULL,
	"generated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"report_count" integer DEFAULT 0 NOT NULL,
	"hot_species" jsonb,
	"hot_depths" jsonb,
	"hot_times" jsonb,
	"hot_locations" jsonb,
	"tips" jsonb,
	"summary" text
);
--> statement-breakpoint
CREATE TABLE "brain_videos" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" varchar(255) NOT NULL,
	"description" text,
	"duration_secs" integer,
	"frame_count" integer DEFAULT 0,
	"status" varchar(16) DEFAULT 'queued' NOT NULL,
	"cv_summary" jsonb,
	"brain_insight" text,
	"detected_species" jsonb,
	"depth_ranges" jsonb,
	"ai_tips" jsonb,
	"video_uri" text,
	"submitted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"processed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "barra_references" (
	"id" serial PRIMARY KEY NOT NULL,
	"source" varchar(32) NOT NULL,
	"photo_url" text NOT NULL,
	"thumb_url" text,
	"thumb_base64" text,
	"observation_id" varchar(64),
	"location" varchar(255),
	"quality_grade" varchar(32),
	"description" text,
	"viewing_angle" varchar(16),
	"votes" integer DEFAULT 0,
	"active" boolean DEFAULT true NOT NULL,
	"added_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sonar_references" (
	"id" serial PRIMARY KEY NOT NULL,
	"source" varchar(32) NOT NULL,
	"image_base64" text NOT NULL,
	"brand" varchar(64),
	"arch_type" varchar(64),
	"description" text,
	"depth" varchar(32),
	"fish_count" integer,
	"confirmed_count" integer DEFAULT 1,
	"active" boolean DEFAULT true NOT NULL,
	"added_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "croc_references" (
	"id" serial PRIMARY KEY NOT NULL,
	"source" varchar(32) NOT NULL,
	"photo_url" text NOT NULL,
	"thumb_url" text,
	"thumb_base64" text,
	"observation_id" varchar(64),
	"location" varchar(255),
	"quality_grade" varchar(32),
	"description" text,
	"viewing_angle" varchar(16),
	"out_of_water" boolean DEFAULT true,
	"votes" integer DEFAULT 0,
	"active" boolean DEFAULT true NOT NULL,
	"added_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bird_references" (
	"id" serial PRIMARY KEY NOT NULL,
	"source" varchar(32) NOT NULL,
	"species" varchar(128),
	"taxon_name" varchar(128),
	"photo_url" text NOT NULL,
	"thumb_url" text,
	"thumb_base64" text,
	"observation_id" varchar(64),
	"location" varchar(255),
	"quality_grade" varchar(32),
	"description" text,
	"pose_type" varchar(24),
	"votes" integer DEFAULT 0,
	"active" boolean DEFAULT true NOT NULL,
	"added_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "crocguard_alerts" (
	"id" serial PRIMARY KEY NOT NULL,
	"source" varchar(64) NOT NULL,
	"severity" varchar(16) NOT NULL,
	"confidence" real NOT NULL,
	"snapshot" text,
	"resolved" boolean DEFAULT false NOT NULL,
	"resolved_at" timestamp with time zone,
	"metadata" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "crocguard_cameras" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(128) NOT NULL,
	"stream_url" text NOT NULL,
	"type" varchar(16) DEFAULT 'mjpeg' NOT NULL,
	"status" varchar(16) DEFAULT 'offline' NOT NULL,
	"last_seen" timestamp with time zone,
	"added_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "crocguard_sonar_readings" (
	"id" serial PRIMARY KEY NOT NULL,
	"unit_id" varchar(64) NOT NULL,
	"unit_name" varchar(128),
	"signal_level" real NOT NULL,
	"movement_detected" boolean DEFAULT false NOT NULL,
	"raw_payload" text,
	"recorded_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "visual_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"session_id" text NOT NULL,
	"sources" jsonb NOT NULL,
	"image_count" integer DEFAULT 0 NOT NULL,
	"sonar_context" jsonb,
	"brain_result" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "contrast_references" (
	"id" serial PRIMARY KEY NOT NULL,
	"species" varchar(64) NOT NULL,
	"scientific_name" varchar(128),
	"source" varchar(32) NOT NULL,
	"photo_url" text NOT NULL,
	"thumb_url" text,
	"thumb_base64" text,
	"observation_id" varchar(64),
	"location" varchar(255),
	"quality_grade" varchar(32),
	"votes" integer DEFAULT 0,
	"active" boolean DEFAULT true NOT NULL,
	"added_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE cascade ON UPDATE no action;