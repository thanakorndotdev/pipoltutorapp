CREATE TABLE "attempt_activity_streams" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"attempt_id" uuid NOT NULL,
	"client_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"sequence" integer DEFAULT 0 NOT NULL,
	"elapsed_ms" integer DEFAULT 0 NOT NULL,
	"active_ms" integer DEFAULT 0 NOT NULL,
	"offline_ms" integer DEFAULT 0 NOT NULL,
	"checkpoints" jsonb DEFAULT '[]'::jsonb NOT NULL
);
--> statement-breakpoint
ALTER TABLE "attempts" ADD COLUMN "active_remainder_ms" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "attempts" ADD COLUMN "active_reviewed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "attempt_activity_streams" ADD CONSTRAINT "attempt_activity_streams_attempt_id_attempts_id_fk" FOREIGN KEY ("attempt_id") REFERENCES "public"."attempts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "attempt_activity_attempt_client_key" ON "attempt_activity_streams" USING btree ("attempt_id","client_id");