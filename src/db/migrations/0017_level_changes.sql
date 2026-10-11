CREATE TABLE "level_changes" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"entry_id" integer,
	"kind" varchar(16) NOT NULL,
	"detail" jsonb,
	"before" jsonb NOT NULL,
	"after" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "changes_seen_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "level_changes" ADD CONSTRAINT "level_changes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "level_changes" ADD CONSTRAINT "level_changes_entry_id_entries_id_fk" FOREIGN KEY ("entry_id") REFERENCES "public"."entries"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "level_changes_user_idx" ON "level_changes" USING btree ("user_id","created_at");