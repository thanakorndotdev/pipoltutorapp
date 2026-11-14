CREATE TYPE "public"."cert_job_status" AS ENUM('pending', 'running', 'done', 'failed');--> statement-breakpoint
CREATE TYPE "public"."cert_template_status" AS ENUM('draft', 'published', 'archived');--> statement-breakpoint
CREATE TYPE "public"."certificate_status" AS ENUM('queued', 'valid', 'render_failed', 'revoked', 'previous_valid', 'superseded');--> statement-breakpoint
CREATE TYPE "public"."pack_level" AS ENUM('m1', 'm4');--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor_id" uuid,
	"actor_kind" text NOT NULL,
	"action" text NOT NULL,
	"module" text NOT NULL,
	"target_id" text,
	"before" jsonb,
	"after" jsonb,
	"reason" text,
	"result" text DEFAULT 'ok' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cert_signing_keys" (
	"key_id" text PRIMARY KEY NOT NULL,
	"algorithm" text DEFAULT 'RSA-PSS-SHA256' NOT NULL,
	"public_key_pem" text NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"retired_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "cert_template_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"template_id" uuid NOT NULL,
	"version" integer NOT NULL,
	"layout" jsonb NOT NULL,
	"published_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cert_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"status" "cert_template_status" DEFAULT 'draft' NOT NULL,
	"layout" jsonb NOT NULL,
	"published_version" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "certificate_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"certificate_id" uuid NOT NULL,
	"status" "cert_job_status" DEFAULT 'pending' NOT NULL,
	"tries" integer DEFAULT 0 NOT NULL,
	"last_error" text,
	"run_after" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "certificates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"public_id" text NOT NULL,
	"serial_no" integer GENERATED ALWAYS AS IDENTITY (sequence name "certificates_serial_no_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"attempt_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"pack_id" uuid NOT NULL,
	"revision" integer DEFAULT 1 NOT NULL,
	"status" "certificate_status" DEFAULT 'queued' NOT NULL,
	"recipient_name" text NOT NULL,
	"template_version_id" uuid,
	"manifest" jsonb,
	"manifest_hash" text,
	"signature" text,
	"key_id" text,
	"issued_at" timestamp with time zone DEFAULT now() NOT NULL,
	"revoked_at" timestamp with time zone,
	"revoke_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"title" text NOT NULL,
	"body" text,
	"link" text,
	"dismissed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "exam_packs" ADD COLUMN "level" "pack_level";--> statement-breakpoint
ALTER TABLE "exam_packs" ADD COLUMN "subject_label" text;--> statement-breakpoint
ALTER TABLE "exam_packs" ADD COLUMN "certificate_enabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "exam_packs" ADD COLUMN "cert_on_auto_submit" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "exam_packs" ADD COLUMN "cert_on_hard_cutoff" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "exam_packs" ADD COLUMN "cert_on_reopen" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "exam_packs" ADD COLUMN "cert_template_id" uuid;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cert_template_versions" ADD CONSTRAINT "cert_template_versions_template_id_cert_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."cert_templates"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "certificate_jobs" ADD CONSTRAINT "certificate_jobs_certificate_id_certificates_id_fk" FOREIGN KEY ("certificate_id") REFERENCES "public"."certificates"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "certificates" ADD CONSTRAINT "certificates_attempt_id_attempts_id_fk" FOREIGN KEY ("attempt_id") REFERENCES "public"."attempts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "certificates" ADD CONSTRAINT "certificates_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "certificates" ADD CONSTRAINT "certificates_pack_id_exam_packs_id_fk" FOREIGN KEY ("pack_id") REFERENCES "public"."exam_packs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "certificates" ADD CONSTRAINT "certificates_template_version_id_cert_template_versions_id_fk" FOREIGN KEY ("template_version_id") REFERENCES "public"."cert_template_versions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "certificates" ADD CONSTRAINT "certificates_key_id_cert_signing_keys_key_id_fk" FOREIGN KEY ("key_id") REFERENCES "public"."cert_signing_keys"("key_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "audit_logs_module_created_idx" ON "audit_logs" USING btree ("module","created_at");--> statement-breakpoint
CREATE INDEX "audit_logs_target_idx" ON "audit_logs" USING btree ("target_id");--> statement-breakpoint
CREATE UNIQUE INDEX "cert_template_versions_template_version_key" ON "cert_template_versions" USING btree ("template_id","version");--> statement-breakpoint
CREATE UNIQUE INDEX "certificate_jobs_certificate_id_key" ON "certificate_jobs" USING btree ("certificate_id");--> statement-breakpoint
CREATE INDEX "certificate_jobs_status_run_after_idx" ON "certificate_jobs" USING btree ("status","run_after");--> statement-breakpoint
CREATE UNIQUE INDEX "certificates_public_id_key" ON "certificates" USING btree ("public_id");--> statement-breakpoint
CREATE INDEX "certificates_user_id_idx" ON "certificates" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "certificates_pack_id_idx" ON "certificates" USING btree ("pack_id");--> statement-breakpoint
CREATE UNIQUE INDEX "certificates_active_attempt_key" ON "certificates" USING btree ("attempt_id") WHERE "certificates"."status" in ('queued', 'valid', 'render_failed');--> statement-breakpoint
CREATE INDEX "notifications_user_id_idx" ON "notifications" USING btree ("user_id","dismissed_at");