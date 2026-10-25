-- One figure per question becomes an ordered list; the old figure becomes the first.
ALTER TABLE "questions" ADD COLUMN "image_urls" text[] DEFAULT '{}'::text[] NOT NULL;--> statement-breakpoint
UPDATE "questions" SET "image_urls" = ARRAY["image_url"] WHERE "image_url" IS NOT NULL AND "image_url" <> '';--> statement-breakpoint
ALTER TABLE "questions" DROP COLUMN "image_url";
