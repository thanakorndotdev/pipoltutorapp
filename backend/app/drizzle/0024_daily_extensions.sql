CREATE TABLE "daily_extensions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"local_date" text NOT NULL,
	"until" timestamp with time zone NOT NULL,
	"user_ids" jsonb,
	"source" uuid NOT NULL,
	"reason" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "daily_extensions_date_idx" ON "daily_extensions" USING btree ("local_date");--> statement-breakpoint
CREATE UNIQUE INDEX "daily_extensions_source_key" ON "daily_extensions" USING btree ("source");