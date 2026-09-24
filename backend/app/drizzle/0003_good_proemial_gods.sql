CREATE TYPE "public"."question_subject" AS ENUM('math', 'science', 'general_aptitude', 'thai', 'english');--> statement-breakpoint
CREATE TABLE "pack_questions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"pack_id" uuid NOT NULL,
	"question_id" uuid NOT NULL,
	"position" integer NOT NULL
);
--> statement-breakpoint
ALTER TABLE "questions" DROP CONSTRAINT "questions_pack_id_exam_packs_id_fk";
--> statement-breakpoint
DROP INDEX "questions_pack_position_key";--> statement-breakpoint
ALTER TABLE "questions" ADD COLUMN "subject" "question_subject" NOT NULL;--> statement-breakpoint
ALTER TABLE "questions" ADD COLUMN "active" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "questions" ADD COLUMN "created_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "questions" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "pack_questions" ADD CONSTRAINT "pack_questions_pack_id_exam_packs_id_fk" FOREIGN KEY ("pack_id") REFERENCES "public"."exam_packs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pack_questions" ADD CONSTRAINT "pack_questions_question_id_questions_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."questions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "pack_questions_pack_position_key" ON "pack_questions" USING btree ("pack_id","position");--> statement-breakpoint
CREATE UNIQUE INDEX "pack_questions_pack_question_key" ON "pack_questions" USING btree ("pack_id","question_id");--> statement-breakpoint
CREATE INDEX "questions_subject_idx" ON "questions" USING btree ("subject");--> statement-breakpoint
CREATE INDEX "questions_topic_idx" ON "questions" USING btree ("topic");--> statement-breakpoint
ALTER TABLE "questions" DROP COLUMN "pack_id";--> statement-breakpoint
ALTER TABLE "questions" DROP COLUMN "position";