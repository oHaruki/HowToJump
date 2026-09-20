-- The bottom miss bands are worth well under one percent of a pack, which an
-- integer column rounded to nothing. Widened before db:deploy reseeds the
-- table from the code; every value the column held is representable.
ALTER TABLE "grade_rules" ALTER COLUMN "exp_percent" TYPE numeric(6, 3);
ALTER TABLE "grade_rules" ALTER COLUMN "exp_percent" SET DEFAULT 0;
