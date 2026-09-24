CREATE TABLE "pack_products" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"pack_id" uuid NOT NULL,
	"product_id" uuid NOT NULL
);
--> statement-breakpoint
ALTER TABLE "exam_packs" DROP CONSTRAINT "exam_packs_product_id_products_id_fk";
--> statement-breakpoint
ALTER TABLE "pack_products" ADD CONSTRAINT "pack_products_pack_id_exam_packs_id_fk" FOREIGN KEY ("pack_id") REFERENCES "public"."exam_packs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pack_products" ADD CONSTRAINT "pack_products_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "pack_products_pack_product_key" ON "pack_products" USING btree ("pack_id","product_id");--> statement-breakpoint
CREATE INDEX "pack_products_product_id_idx" ON "pack_products" USING btree ("product_id");--> statement-breakpoint
INSERT INTO "pack_products" ("pack_id", "product_id") SELECT "id", "product_id" FROM "exam_packs" WHERE "product_id" IS NOT NULL;--> statement-breakpoint
ALTER TABLE "exam_packs" DROP COLUMN "product_id";