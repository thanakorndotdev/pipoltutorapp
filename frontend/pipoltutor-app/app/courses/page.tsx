import { PlanGrid } from "@/components/blocks";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { Band, Button, Icon, Pill } from "@/components/ui";
import { getCopy } from "@/lib/site-texts";

export const metadata = { title: "คอร์สและชุดข้อสอบ · PIPOL TUTOR" };

export default async function CatalogPage() {
  const c = await getCopy();
  return (
    <>
      <SiteHeader current="courses" />
      <main className="flex-1">
        <Band className="pb-14 pt-10 md:pb-[72px] md:pt-12">
          <div className="flex flex-col gap-8">
            <header className="flex flex-col gap-3.5">
              <div>
                <Pill icon="shopping_bag">{c.t("courses.catalog_pill", "คอร์สและชุดข้อสอบทั้งหมด")}</Pill>
              </div>
              <h1 className="text-[32px] font-semibold md:text-[42px]" style={{ textWrap: "balance" }}>
                {c.t("courses.catalog_title", "เลือกสิ่งที่ตรงกับจังหวะของน้อง")}
              </h1>
              <p className="max-w-[760px] text-[17px] text-ink2 md:text-[18px]">
                {c.t("courses.catalog_lede", "ซื้อครั้งเดียว ใช้ได้ถึงวันสอบ ชำระเงินสำเร็จระบบเปิดสิทธิ์ให้อัตโนมัติทันที")}
              </p>
            </header>

            <PlanGrid />

            <div className="flex flex-col gap-4 rounded-[20px] border border-border bg-card p-[22px] sm:flex-row sm:items-center">
              <Icon name="shield" size={24} fill className="text-brand" />
              <div className="flex-1">
                <p className="font-display text-[16px] font-medium">{c.t("courses.refund_title", "ไม่พอใจภายใน 7 วันแรก คืนเงินเต็มจำนวน")}</p>
                <p className="text-[14.5px] text-ink3">{c.t("courses.refund_sub", "เงื่อนไขเป็นไปตามนโยบายการคืนเงิน")}</p>
              </div>
              <Button kind="ghost" size="sm" href="#">อ่านนโยบาย</Button>
            </div>
          </div>
        </Band>
      </main>
      <SiteFooter />
    </>
  );
}
