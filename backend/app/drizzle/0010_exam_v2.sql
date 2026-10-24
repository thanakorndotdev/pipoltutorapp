CREATE TYPE "public"."question_type" AS ENUM('single', 'multiple', 'short');--> statement-breakpoint
CREATE TYPE "public"."scoring_mode" AS ENUM('exact', 'partial');--> statement-breakpoint
-- The campus list had กาญจนบุรี where อุบลราชธานี belongs. Renaming the value
-- keeps any stored row; the declared order in schema.ts only affects display.
ALTER TYPE "public"."pcshs_campus" RENAME VALUE 'kanchanaburi' TO 'ubon_ratchathani';--> statement-breakpoint
ALTER TABLE "attempts" ALTER COLUMN "score" SET DATA TYPE numeric(10, 2);--> statement-breakpoint
ALTER TABLE "questions" ALTER COLUMN "correct_choice" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "attempt_answers" ADD COLUMN "selected_choices" text[] DEFAULT '{}'::text[] NOT NULL;--> statement-breakpoint
ALTER TABLE "attempt_answers" ADD COLUMN "text_answer" text;--> statement-breakpoint
ALTER TABLE "attempt_answers" ADD COLUMN "points_awarded" numeric(8, 2);--> statement-breakpoint
ALTER TABLE "attempts" ADD COLUMN "max_score" numeric(10, 2);--> statement-breakpoint
ALTER TABLE "attempts" ADD COLUMN "attempt_no" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "attempts" ADD COLUMN "student_first_name" text;--> statement-breakpoint
ALTER TABLE "attempts" ADD COLUMN "student_last_name" text;--> statement-breakpoint
ALTER TABLE "attempts" ADD COLUMN "student_nickname" text;--> statement-breakpoint
ALTER TABLE "attempts" ADD COLUMN "student_campus" "pcshs_campus";--> statement-breakpoint
ALTER TABLE "attempts" ADD COLUMN "student_email" text;--> statement-breakpoint
ALTER TABLE "attempts" ADD COLUMN "reset_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "attempts" ADD COLUMN "score_history" jsonb;--> statement-breakpoint
ALTER TABLE "exam_packs" ADD COLUMN "description" text;--> statement-breakpoint
ALTER TABLE "exam_packs" ADD COLUMN "max_attempts" integer DEFAULT 1;--> statement-breakpoint
ALTER TABLE "exam_packs" ADD COLUMN "opens_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "exam_packs" ADD COLUMN "closes_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "exam_packs" ADD COLUMN "published" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "exam_packs" ADD COLUMN "show_review" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "pack_questions" ADD COLUMN "section" text;--> statement-breakpoint
ALTER TABLE "questions" ADD COLUMN "type" "question_type" DEFAULT 'single' NOT NULL;--> statement-breakpoint
ALTER TABLE "questions" ADD COLUMN "points" numeric(8, 2) DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "questions" ADD COLUMN "scoring" "scoring_mode" DEFAULT 'exact' NOT NULL;--> statement-breakpoint
ALTER TABLE "questions" ADD COLUMN "correct_choices" text[] DEFAULT '{}'::text[] NOT NULL;--> statement-breakpoint
ALTER TABLE "questions" ADD COLUMN "accepted_answers" text[] DEFAULT '{}'::text[] NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "first_name" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "last_name" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "nickname" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "campus" "pcshs_campus";--> statement-breakpoint
-- Backfill: every existing question was single-choice with one key, and every
-- stored answer one picked key. Existing packs stay visible and reviewable as
-- they were before this migration; new packs start hidden.
UPDATE "questions" SET "correct_choices" = ARRAY["correct_choice"] WHERE "correct_choice" IS NOT NULL;--> statement-breakpoint
UPDATE "attempt_answers" SET "selected_choices" = ARRAY["selected_choice"] WHERE "selected_choice" IS NOT NULL;--> statement-breakpoint
UPDATE "attempt_answers" SET "points_awarded" = CASE WHEN "is_correct" THEN 1 ELSE 0 END WHERE "is_correct" IS NOT NULL;--> statement-breakpoint
UPDATE "attempts" a SET "max_score" = (SELECT count(*) FROM "pack_questions" pq WHERE pq."pack_id" = a."pack_id") WHERE a."status" <> 'in_progress';--> statement-breakpoint
UPDATE "attempts" a SET "attempt_no" = n.rn FROM (SELECT "id", row_number() OVER (PARTITION BY "user_id", "pack_id" ORDER BY "started_at") AS rn FROM "attempts") n WHERE n."id" = a."id";--> statement-breakpoint
UPDATE "attempts" a SET "student_email" = u."email" FROM "users" u WHERE u."id" = a."user_id";--> statement-breakpoint
UPDATE "exam_packs" SET "published" = true, "show_review" = true, "max_attempts" = 3;
