-- Reference links shown under the prompt, separate from the figures in image_urls.
ALTER TABLE "questions" ADD COLUMN "link_urls" text[] DEFAULT '{}'::text[] NOT NULL;