ALTER TABLE "entries" ADD COLUMN IF NOT EXISTS "categories" varchar(48)[] DEFAULT '{}' NOT NULL;--> statement-breakpoint
ALTER TABLE "suggestions" ADD COLUMN IF NOT EXISTS "proposed_categories" varchar(48)[] DEFAULT '{}' NOT NULL;--> statement-breakpoint
-- A map can sit in several categories now; each keeps the one it had, spelled as it was.
UPDATE "entries" SET "categories" = ARRAY["category"] WHERE "category" <> '' AND "categories" = '{}';--> statement-breakpoint
UPDATE "suggestions" SET "proposed_categories" = ARRAY["proposed_category"] WHERE "proposed_category" <> '' AND "proposed_categories" = '{}';
