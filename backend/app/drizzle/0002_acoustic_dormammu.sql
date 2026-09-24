CREATE TABLE "exam_settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" text DEFAULT 'default' NOT NULL,
	"exam_date" timestamp with time zone NOT NULL,
	"exam_venue_label" text DEFAULT 'จภ.' NOT NULL,
	"enroll_close_at" timestamp with time zone NOT NULL,
	"urgent_days" integer DEFAULT 30 NOT NULL,
	"time_multiplier_percent" integer DEFAULT 150 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "exam_settings_key_key" ON "exam_settings" USING btree ("key");