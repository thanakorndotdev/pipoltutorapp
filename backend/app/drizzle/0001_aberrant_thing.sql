CREATE TYPE "public"."pcshs_campus" AS ENUM('chiang_rai', 'phitsanulok', 'lopburi', 'pathum_thani', 'chonburi', 'phetchaburi', 'nakhon_si_thammarat', 'trang', 'satun', 'mukdahan', 'loei', 'buriram', 'kalasin', 'kanchanaburi', 'kamphaeng_phet', 'lampang', 'sa_kaeo', 'suphan_buri');--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "student_name" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "current_school" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "target_campus" "pcshs_campus";--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "student_instagram" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "parent_phone" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "receipt_email" text;