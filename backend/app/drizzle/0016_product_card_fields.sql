ALTER TABLE "products" ADD COLUMN "badge" text;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "unit" text;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "cta_label" text;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "features" text[] DEFAULT '{}'::text[] NOT NULL;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "featured" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "sort_order" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
-- Card copy used to live in code (PLANS) + site_texts overrides keyed plans.<slug>.*; carry it onto the rows.
UPDATE "products" SET "badge" = 'ชุดข้อสอบ', "unit" = '/ ชุด', "cta_label" = 'สมัครชุดข้อสอบ', "sort_order" = 1,
  "features" = ARRAY['ข้อสอบจำลอง 100 ข้อ ครบ 5 วิชา', 'จับเวลาเสมือนห้องสอบจริง', 'ตรวจอัตโนมัติ + สรุปรายบท', 'ทำซ้ำได้ 3 ครั้ง']
  WHERE "slug" = 'exam-pack';--> statement-breakpoint
UPDATE "products" SET "badge" = 'ยอดนิยม', "unit" = '/ คอร์ส', "cta_label" = 'สมัครคอร์สนี้', "sort_order" = 2, "featured" = true,
  "features" = ARRAY['ติวสด 24 ครั้ง + คลิปย้อนหลัง', 'เอกสารประกอบการเรียนแบบพิมพ์', 'ชุดข้อสอบเสมือนจริง 1 ชุด', 'กลุ่ม LINE ถามได้ตลอด', 'ติวเสริมเฉพาะกลุ่มก่อนสอบ']
  WHERE "slug" = 'full-course';--> statement-breakpoint
UPDATE "products" SET "badge" = 'คุ้มที่สุด', "unit" = '/ แพ็ก', "cta_label" = 'สมัครแพ็กนี้', "sort_order" = 3,
  "features" = ARRAY['ทุกอย่างในคอร์สเต็มรูปแบบ', 'คลังข้อสอบทุกชุด ไม่จำกัดครั้ง', 'รายงานวิเคราะห์รายสัปดาห์', 'ดูดวงแนวทางการสอบ 1 ครั้ง']
  WHERE "slug" = 'course-plus-packs';--> statement-breakpoint
-- title stays the admin's product title (the card now shows it); description only fills a blank.
UPDATE "products" p SET "description" = t."value" FROM "site_texts" t
  WHERE t."key" = 'plans.' || p."slug" || '.desc' AND btrim(t."value") <> '' AND p."description" IS NULL;--> statement-breakpoint
UPDATE "products" SET "description" = 'เหมาะกับคนที่อยากวัดระดับตัวเองก่อน' WHERE "slug" = 'exam-pack' AND "description" IS NULL;--> statement-breakpoint
UPDATE "products" SET "description" = 'คอร์สหลัก สอนสดครบทุกวิชาจนถึงวันสอบ' WHERE "slug" = 'full-course' AND "description" IS NULL;--> statement-breakpoint
UPDATE "products" SET "description" = 'ได้ทุกอย่างของคอร์สหลัก บวกคลังข้อสอบทุกชุด' WHERE "slug" = 'course-plus-packs' AND "description" IS NULL;--> statement-breakpoint
UPDATE "products" p SET "badge" = t."value" FROM "site_texts" t WHERE t."key" = 'plans.' || p."slug" || '.tag' AND btrim(t."value") <> '';--> statement-breakpoint
UPDATE "products" p SET "unit" = t."value" FROM "site_texts" t WHERE t."key" = 'plans.' || p."slug" || '.unit' AND btrim(t."value") <> '';--> statement-breakpoint
UPDATE "products" p SET "cta_label" = t."value" FROM "site_texts" t WHERE t."key" = 'plans.' || p."slug" || '.cta' AND btrim(t."value") <> '';--> statement-breakpoint
UPDATE "products" p SET "features" = array_remove(array(SELECT btrim(x) FROM unnest(string_to_array(t."value", E'\n')) x), '')
  FROM "site_texts" t WHERE t."key" = 'plans.' || p."slug" || '.feats' AND btrim(t."value") <> '';--> statement-breakpoint
DELETE FROM "site_texts" WHERE "key" LIKE 'plans.%';
