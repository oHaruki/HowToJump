DROP INDEX IF EXISTS "entries_category_idx";--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "entries_categories_idx" ON "entries" USING gin ("categories");--> statement-breakpoint
ALTER TABLE "entries" DROP COLUMN IF EXISTS "category";--> statement-breakpoint
ALTER TABLE "suggestions" DROP COLUMN IF EXISTS "proposed_category";
