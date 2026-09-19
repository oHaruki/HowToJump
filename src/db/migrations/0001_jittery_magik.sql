-- IF NOT EXISTS because databases set up before migrations were tracked
-- were built with db:push, which may have created these already.
CREATE INDEX IF NOT EXISTS "entries_bank_sort_idx" ON "entries" USING btree ("is_active","tier_order","stars");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "entries_bank_mod_idx" ON "entries" USING btree ("is_active","mod");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "entries_bank_pacing_idx" ON "entries" USING btree ("is_active","length_bucket","speed_bucket");