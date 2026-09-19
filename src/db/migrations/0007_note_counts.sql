-- Filled from osu! by db:deploy; until then a map's misses cost what they always did.
ALTER TABLE "beatmaps" ADD COLUMN IF NOT EXISTS "note_count" integer;
