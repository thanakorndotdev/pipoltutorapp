CREATE TABLE "action_previews" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"module" text NOT NULL,
	"target_id" text NOT NULL,
	"actor_key" text NOT NULL,
	"base_version" text NOT NULL,
	"payload" jsonb NOT NULL,
	"digest" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"committed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "article_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"article_id" uuid NOT NULL,
	"visitor_key" text NOT NULL,
	"day" text NOT NULL,
	"kind" text NOT NULL,
	"referrer" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "article_redirects" (
	"slug" text PRIMARY KEY NOT NULL,
	"article_id" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE "article_revisions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"article_id" uuid NOT NULL,
	"version" integer NOT NULL,
	"snapshot" jsonb NOT NULL,
	"actor_id" uuid,
	"action" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "article_categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"kind" text DEFAULT 'category' NOT NULL,
	"parent_id" uuid,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"slug" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "article_comments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"article_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"parent_id" uuid,
	"text" text NOT NULL,
	"status" text DEFAULT 'published' NOT NULL,
	"flags" text[] DEFAULT '{}'::text[] NOT NULL,
	"notified_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "daily_assignments" (
	"local_date" text PRIMARY KEY NOT NULL,
	"challenge_id" uuid,
	"title" text NOT NULL,
	"questions" jsonb NOT NULL,
	"revision" integer DEFAULT 1 NOT NULL,
	"archived_question_ids" uuid[],
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "daily_challenges" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"local_date" text,
	"status" text DEFAULT 'draft' NOT NULL,
	"queue_order" integer DEFAULT 0 NOT NULL,
	"questions" jsonb NOT NULL,
	"revision" integer DEFAULT 1 NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "daily_responses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"local_date" text NOT NULL,
	"question_id" text NOT NULL,
	"try_no" integer NOT NULL,
	"request_id" uuid NOT NULL,
	"answer" jsonb NOT NULL,
	"correct" boolean NOT NULL,
	"hint_shown" boolean DEFAULT false NOT NULL,
	"verdict_history" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "daily_revisions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"challenge_id" uuid NOT NULL,
	"version" integer NOT NULL,
	"snapshot" jsonb NOT NULL,
	"actor_id" uuid,
	"reason" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "deletion_consents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"certificate_policy" text NOT NULL,
	"notice_version" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "error_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"module" text NOT NULL,
	"code" text NOT NULL,
	"request_id" text,
	"message" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "feature_settings" (
	"key" text PRIMARY KEY NOT NULL,
	"value" jsonb NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "fire_daily_ledger" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"local_date" text NOT NULL,
	"state" text NOT NULL,
	"increment" integer DEFAULT 0 NOT NULL,
	"source" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "fire_recovery" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"missed_date" text NOT NULL,
	"month" text NOT NULL,
	"used_quota" boolean DEFAULT true NOT NULL,
	"reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "fire_summary" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"current" integer DEFAULT 0 NOT NULL,
	"highest" integer DEFAULT 0 NOT NULL,
	"last_date" text NOT NULL,
	"pending_date" text,
	"version" integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ranking_configs" (
	"pack_id" uuid PRIMARY KEY NOT NULL,
	"policy" text DEFAULT 'best' NOT NULL,
	"visibility" text[] DEFAULT ARRAY['score','rank','mean','sd','z','percentile']::text[] NOT NULL,
	"published_final" boolean DEFAULT false NOT NULL,
	"version" integer DEFAULT 0 NOT NULL,
	"current_version_id" uuid,
	"suspicious_seconds" integer DEFAULT 30 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ranking_decisions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"pack_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"approved_reference" boolean DEFAULT true NOT NULL,
	"reason" text NOT NULL,
	"actor_id" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ranking_overrides" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"pack_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"metric" text NOT NULL,
	"value" double precision NOT NULL,
	"reason" text NOT NULL,
	"source" text NOT NULL,
	"actor_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ranking_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"pack_id" uuid NOT NULL,
	"version" integer NOT NULL,
	"trigger" text NOT NULL,
	"actor_id" uuid,
	"reason" text,
	"rollback_of" uuid,
	"snapshot" jsonb NOT NULL,
	"affected_count" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "retention_policies" (
	"category" text PRIMARY KEY NOT NULL,
	"days" integer,
	"approved_by" uuid,
	"approved_at" timestamp with time zone,
	"version" integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "article_search_queries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"query" text NOT NULL,
	"visitor_key" text NOT NULL,
	"day" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "articles" ADD COLUMN "kind" text DEFAULT 'lesson' NOT NULL;--> statement-breakpoint
ALTER TABLE "articles" ADD COLUMN "levels" text[] DEFAULT '{}'::text[] NOT NULL;--> statement-breakpoint
ALTER TABLE "articles" ADD COLUMN "subjects" text[] DEFAULT '{}'::text[] NOT NULL;--> statement-breakpoint
ALTER TABLE "articles" ADD COLUMN "category_ids" uuid[] DEFAULT '{}'::uuid[] NOT NULL;--> statement-breakpoint
ALTER TABLE "articles" ADD COLUMN "tags" text[] DEFAULT '{}'::text[] NOT NULL;--> statement-breakpoint
ALTER TABLE "articles" ADD COLUMN "workflow" text DEFAULT 'draft' NOT NULL;--> statement-breakpoint
ALTER TABLE "articles" ADD COLUMN "author_id" uuid;--> statement-breakpoint
ALTER TABLE "articles" ADD COLUMN "approved_by" uuid;--> statement-breakpoint
ALTER TABLE "articles" ADD COLUMN "scheduled_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "articles" ADD COLUMN "source_url" text;--> statement-breakpoint
ALTER TABLE "articles" ADD COLUMN "source_credit" text;--> statement-breakpoint
ALTER TABLE "articles" ADD COLUMN "source_date" text;--> statement-breakpoint
ALTER TABLE "articles" ADD COLUMN "deadline" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "articles" ADD COLUMN "view_mode" text DEFAULT 'none' NOT NULL;--> statement-breakpoint
ALTER TABLE "articles" ADD COLUMN "revision" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "articles" ADD COLUMN "published_snapshot" jsonb;--> statement-breakpoint
ALTER TABLE "attempts" ADD COLUMN "active_seconds" integer;--> statement-breakpoint
ALTER TABLE "attempts" ADD COLUMN "active_verified" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "attempts" ADD COLUMN "active_checkpoint_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "staff_role" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "module_permissions" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "deleted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "article_events" ADD CONSTRAINT "article_events_article_id_articles_id_fk" FOREIGN KEY ("article_id") REFERENCES "public"."articles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "article_redirects" ADD CONSTRAINT "article_redirects_article_id_articles_id_fk" FOREIGN KEY ("article_id") REFERENCES "public"."articles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "article_revisions" ADD CONSTRAINT "article_revisions_article_id_articles_id_fk" FOREIGN KEY ("article_id") REFERENCES "public"."articles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "article_comments" ADD CONSTRAINT "article_comments_article_id_articles_id_fk" FOREIGN KEY ("article_id") REFERENCES "public"."articles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "article_comments" ADD CONSTRAINT "article_comments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_assignments" ADD CONSTRAINT "daily_assignments_challenge_id_daily_challenges_id_fk" FOREIGN KEY ("challenge_id") REFERENCES "public"."daily_challenges"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_responses" ADD CONSTRAINT "daily_responses_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_responses" ADD CONSTRAINT "daily_responses_local_date_daily_assignments_local_date_fk" FOREIGN KEY ("local_date") REFERENCES "public"."daily_assignments"("local_date") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_revisions" ADD CONSTRAINT "daily_revisions_challenge_id_daily_challenges_id_fk" FOREIGN KEY ("challenge_id") REFERENCES "public"."daily_challenges"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fire_daily_ledger" ADD CONSTRAINT "fire_daily_ledger_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fire_recovery" ADD CONSTRAINT "fire_recovery_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fire_summary" ADD CONSTRAINT "fire_summary_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ranking_configs" ADD CONSTRAINT "ranking_configs_pack_id_exam_packs_id_fk" FOREIGN KEY ("pack_id") REFERENCES "public"."exam_packs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ranking_decisions" ADD CONSTRAINT "ranking_decisions_pack_id_exam_packs_id_fk" FOREIGN KEY ("pack_id") REFERENCES "public"."exam_packs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ranking_decisions" ADD CONSTRAINT "ranking_decisions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ranking_overrides" ADD CONSTRAINT "ranking_overrides_pack_id_exam_packs_id_fk" FOREIGN KEY ("pack_id") REFERENCES "public"."exam_packs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ranking_overrides" ADD CONSTRAINT "ranking_overrides_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ranking_versions" ADD CONSTRAINT "ranking_versions_pack_id_exam_packs_id_fk" FOREIGN KEY ("pack_id") REFERENCES "public"."exam_packs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "article_events_dedup_key" ON "article_events" USING btree ("article_id","visitor_key","day","kind");--> statement-breakpoint
CREATE UNIQUE INDEX "article_revisions_article_version_key" ON "article_revisions" USING btree ("article_id","version");--> statement-breakpoint
CREATE UNIQUE INDEX "article_categories_slug_key" ON "article_categories" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "article_comments_article_idx" ON "article_comments" USING btree ("article_id");--> statement-breakpoint
CREATE UNIQUE INDEX "daily_challenges_date_key" ON "daily_challenges" USING btree ("local_date") WHERE "daily_challenges"."status" <> 'draft';--> statement-breakpoint
CREATE UNIQUE INDEX "daily_responses_user_question_try_key" ON "daily_responses" USING btree ("user_id","local_date","question_id","try_no");--> statement-breakpoint
CREATE UNIQUE INDEX "daily_responses_user_request_key" ON "daily_responses" USING btree ("user_id","request_id");--> statement-breakpoint
CREATE UNIQUE INDEX "fire_ledger_user_date_key" ON "fire_daily_ledger" USING btree ("user_id","local_date");--> statement-breakpoint
CREATE UNIQUE INDEX "fire_recovery_user_missed_key" ON "fire_recovery" USING btree ("user_id","missed_date");--> statement-breakpoint
CREATE UNIQUE INDEX "ranking_decisions_pack_user_key" ON "ranking_decisions" USING btree ("pack_id","user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "ranking_overrides_pack_user_metric_key" ON "ranking_overrides" USING btree ("pack_id","user_id","metric");--> statement-breakpoint
CREATE UNIQUE INDEX "ranking_versions_pack_version_key" ON "ranking_versions" USING btree ("pack_id","version");--> statement-breakpoint
CREATE UNIQUE INDEX "search_queries_dedup_key" ON "article_search_queries" USING btree ("query","visitor_key","day");--> statement-breakpoint
ALTER TABLE "articles" ADD CONSTRAINT "articles_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "articles" ADD CONSTRAINT "articles_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
UPDATE articles SET workflow = 'published', published_snapshot = to_jsonb(articles) WHERE published = true;
