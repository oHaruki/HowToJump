ALTER TABLE "scores" ADD COLUMN "imported_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "progress_seen" jsonb;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "progress_seen_at" timestamp with time zone;--> statement-breakpoint
-- Scores that were already there landed when they were created.
UPDATE "scores" SET "imported_at" = "created_at";
