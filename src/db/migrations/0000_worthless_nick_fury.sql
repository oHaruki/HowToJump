CREATE TABLE "audit_log" (
	"id" serial PRIMARY KEY NOT NULL,
	"actor_id" integer,
	"actor_name" varchar(64),
	"action" varchar(64) NOT NULL,
	"entity_type" varchar(32),
	"entity_id" integer,
	"detail" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "beatmaps" (
	"id" serial PRIMARY KEY NOT NULL,
	"osu_beatmap_id" bigint NOT NULL,
	"osu_beatmapset_id" bigint,
	"artist" text,
	"title" text NOT NULL,
	"version" text,
	"mapper" text,
	"mapper_user_id" bigint,
	"stars" double precision,
	"bpm" double precision,
	"drain_seconds" integer,
	"total_seconds" integer,
	"cs" double precision,
	"ar" double precision,
	"od" double precision,
	"hp" double precision,
	"max_combo" integer,
	"status" varchar(24),
	"cover_url" text,
	"card_url" text,
	"list_url" text,
	"last_synced_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "entries" (
	"id" serial PRIMARY KEY NOT NULL,
	"beatmap_id" integer NOT NULL,
	"mod" varchar(16) DEFAULT 'NM' NOT NULL,
	"tier_order" integer NOT NULL,
	"category" varchar(48) NOT NULL,
	"length_bucket" varchar(24),
	"speed_bucket" varchar(24),
	"stars" double precision,
	"bpm" double precision,
	"drain_seconds" integer,
	"cs" double precision,
	"ar" double precision,
	"od" double precision,
	"custom_bg_url" text,
	"notes" text,
	"judged_by_id" integer,
	"judged_by_name" varchar(64),
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "grade_rules" (
	"id" serial PRIMARY KEY NOT NULL,
	"grade" varchar(8) NOT NULL,
	"sort_order" integer NOT NULL,
	"label" varchar(64) NOT NULL,
	"min_miss" integer,
	"max_miss" integer,
	"requires_fc" boolean DEFAULT false NOT NULL,
	"requires_perfect" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "scores" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"entry_id" integer NOT NULL,
	"osu_score_id" bigint,
	"miss_count" integer DEFAULT 0 NOT NULL,
	"accuracy" double precision,
	"max_combo" integer,
	"is_fc" boolean DEFAULT false NOT NULL,
	"is_perfect" boolean DEFAULT false NOT NULL,
	"mods" varchar(32) DEFAULT 'NM' NOT NULL,
	"grade" varchar(8) NOT NULL,
	"grade_rank" integer NOT NULL,
	"source" varchar(16) DEFAULT 'osu_api' NOT NULL,
	"is_hidden" boolean DEFAULT false NOT NULL,
	"hidden_by_id" integer,
	"hidden_reason" text,
	"played_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "site_config" (
	"key" varchar(64) PRIMARY KEY NOT NULL,
	"value" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "suggestion_batches" (
	"id" serial PRIMARY KEY NOT NULL,
	"created_by_id" integer,
	"source" varchar(24) DEFAULT 'paste' NOT NULL,
	"row_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "suggestion_votes" (
	"suggestion_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"vote" integer DEFAULT 1 NOT NULL,
	"proposed_tier_order" integer,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "suggestion_votes_suggestion_id_user_id_pk" PRIMARY KEY("suggestion_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "suggestions" (
	"id" serial PRIMARY KEY NOT NULL,
	"batch_id" integer,
	"submitted_by_id" integer,
	"status" varchar(16) DEFAULT 'pending' NOT NULL,
	"osu_beatmap_id" bigint NOT NULL,
	"osu_beatmapset_id" bigint,
	"raw_link" text,
	"raw_payload" jsonb,
	"title" text,
	"version" text,
	"mapper" text,
	"mod" varchar(16) DEFAULT 'NM' NOT NULL,
	"proposed_tier_order" integer,
	"proposed_category" varchar(48),
	"proposed_length" varchar(24),
	"proposed_speed" varchar(24),
	"stars" double precision,
	"bpm" double precision,
	"drain_seconds" integer,
	"cs" double precision,
	"ar" double precision,
	"od" double precision,
	"reviewer_id" integer,
	"review_note" text,
	"reviewed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sync_runs" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone,
	"plays_seen" integer DEFAULT 0 NOT NULL,
	"plays_matched" integer DEFAULT 0 NOT NULL,
	"scores_imported" integer DEFAULT 0 NOT NULL,
	"error" text
);
--> statement-breakpoint
CREATE TABLE "user_tier_progress" (
	"user_id" integer NOT NULL,
	"tier_order" integer NOT NULL,
	"entries_total" integer DEFAULT 0 NOT NULL,
	"entries_cleared" integer DEFAULT 0 NOT NULL,
	"best_grade_rank" integer,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_tier_progress_user_id_tier_order_pk" PRIMARY KEY("user_id","tier_order")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"osu_user_id" bigint NOT NULL,
	"username" varchar(64) NOT NULL,
	"avatar_url" text,
	"country_code" varchar(4),
	"global_rank" integer,
	"role" varchar(16) DEFAULT 'user' NOT NULL,
	"sync_enabled" boolean DEFAULT true NOT NULL,
	"last_played_at" timestamp with time zone,
	"last_synced_at" timestamp with time zone,
	"banned_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entries" ADD CONSTRAINT "entries_beatmap_id_beatmaps_id_fk" FOREIGN KEY ("beatmap_id") REFERENCES "public"."beatmaps"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entries" ADD CONSTRAINT "entries_judged_by_id_users_id_fk" FOREIGN KEY ("judged_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scores" ADD CONSTRAINT "scores_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scores" ADD CONSTRAINT "scores_entry_id_entries_id_fk" FOREIGN KEY ("entry_id") REFERENCES "public"."entries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scores" ADD CONSTRAINT "scores_hidden_by_id_users_id_fk" FOREIGN KEY ("hidden_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "suggestion_batches" ADD CONSTRAINT "suggestion_batches_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "suggestion_votes" ADD CONSTRAINT "suggestion_votes_suggestion_id_suggestions_id_fk" FOREIGN KEY ("suggestion_id") REFERENCES "public"."suggestions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "suggestion_votes" ADD CONSTRAINT "suggestion_votes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "suggestions" ADD CONSTRAINT "suggestions_batch_id_suggestion_batches_id_fk" FOREIGN KEY ("batch_id") REFERENCES "public"."suggestion_batches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "suggestions" ADD CONSTRAINT "suggestions_submitted_by_id_users_id_fk" FOREIGN KEY ("submitted_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "suggestions" ADD CONSTRAINT "suggestions_reviewer_id_users_id_fk" FOREIGN KEY ("reviewer_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sync_runs" ADD CONSTRAINT "sync_runs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_tier_progress" ADD CONSTRAINT "user_tier_progress_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "audit_created_idx" ON "audit_log" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "beatmaps_osu_id_idx" ON "beatmaps" USING btree ("osu_beatmap_id");--> statement-breakpoint
CREATE UNIQUE INDEX "entries_beatmap_mod_idx" ON "entries" USING btree ("beatmap_id","mod");--> statement-breakpoint
CREATE INDEX "entries_tier_idx" ON "entries" USING btree ("tier_order");--> statement-breakpoint
CREATE INDEX "entries_category_idx" ON "entries" USING btree ("category");--> statement-breakpoint
CREATE INDEX "entries_active_idx" ON "entries" USING btree ("is_active");--> statement-breakpoint
CREATE UNIQUE INDEX "scores_osu_score_id_idx" ON "scores" USING btree ("osu_score_id");--> statement-breakpoint
CREATE UNIQUE INDEX "scores_user_entry_idx" ON "scores" USING btree ("user_id","entry_id");--> statement-breakpoint
CREATE INDEX "scores_entry_rank_idx" ON "scores" USING btree ("entry_id","grade_rank");--> statement-breakpoint
CREATE INDEX "scores_user_idx" ON "scores" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "suggestions_status_idx" ON "suggestions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "suggestions_batch_idx" ON "suggestions" USING btree ("batch_id");--> statement-breakpoint
CREATE INDEX "suggestions_map_mod_idx" ON "suggestions" USING btree ("osu_beatmap_id","mod");--> statement-breakpoint
CREATE INDEX "sync_runs_user_idx" ON "sync_runs" USING btree ("user_id","started_at");--> statement-breakpoint
CREATE UNIQUE INDEX "users_osu_user_id_idx" ON "users" USING btree ("osu_user_id");--> statement-breakpoint
CREATE INDEX "users_role_idx" ON "users" USING btree ("role");--> statement-breakpoint
CREATE INDEX "users_sync_idx" ON "users" USING btree ("sync_enabled","last_synced_at");