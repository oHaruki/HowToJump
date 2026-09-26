CREATE TABLE "packs" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(40) NOT NULL,
	"color" varchar(7) NOT NULL,
	"description" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "entries" ADD COLUMN "pack_id" integer;--> statement-breakpoint
CREATE UNIQUE INDEX "packs_name_idx" ON "packs" USING btree (lower("name"));--> statement-breakpoint
ALTER TABLE "entries" ADD CONSTRAINT "entries_pack_id_packs_id_fk" FOREIGN KEY ("pack_id") REFERENCES "public"."packs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "entries_pack_idx" ON "entries" USING btree ("pack_id");