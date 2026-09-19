-- IF NOT EXISTS because databases set up before migrations were tracked
-- were built with db:push, which may have added these already.
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "osu_play_count" integer;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "play_count_checked_at" timestamp with time zone;
