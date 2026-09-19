-- IF NOT EXISTS because databases set up before migrations were tracked
-- were built with db:push, which may have created these already. The
-- foreign key sits inside CREATE TABLE for the same reason.
CREATE TABLE IF NOT EXISTS "user_levels" (
	"user_id" integer NOT NULL,
	"scope" varchar(48) NOT NULL,
	"exp" integer DEFAULT 0 NOT NULL,
	"tier_order" integer,
	"progress" integer,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_levels_user_id_scope_pk" PRIMARY KEY("user_id","scope"),
	CONSTRAINT "user_levels_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action
);
--> statement-breakpoint
ALTER TABLE "grade_rules" ADD COLUMN IF NOT EXISTS "exp_percent" integer DEFAULT 0 NOT NULL;
