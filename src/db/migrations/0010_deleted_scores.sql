CREATE TABLE "deleted_scores" (
	"osu_score_id" bigint PRIMARY KEY NOT NULL,
	"deleted_by_id" integer,
	"deleted_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "deleted_scores" ADD CONSTRAINT "deleted_scores_deleted_by_id_users_id_fk" FOREIGN KEY ("deleted_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;