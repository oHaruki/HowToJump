ALTER TABLE "users" ADD COLUMN "roles" text[] DEFAULT '{}' NOT NULL;
--> statement-breakpoint
-- Everyone keeps the one role they held.
UPDATE "users" SET "roles" = ARRAY["role"] WHERE "role" <> 'user';