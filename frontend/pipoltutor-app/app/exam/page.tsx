import Link from "next/link";

import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { Band, Card, Icon, Note, Pill } from "@/components/ui";
import { fetchExamPacks, fetchProducts, type ExamPack, type Product } from "@/lib/api";
import { getSessionUser, sessionHeaders } from "@/lib/auth";
import { PackChooser } from "./pack-chooser";

export const metadata = { title: "คลังข้อสอบ · PIPOL TUTOR" };

/**
 * Every pack with its lock state for the signed-in student. `unlocked` here
 * is what the backend computed from entitlements (or a staff role); it only
 * drives the UI — POST /attempts is the real gate, so a forged card cannot
 * open a paid pack.
 */
export default async function ExamPacksPage() {
  const user = await getSessionUser();
  let packs: ExamPack[] = [];
  let products: Product[] = [];
  let unavailable = false;
  try {
    [packs, products] = await Promise.all([fetchExamPacks(await sessionHeaders()), fetchProducts()]);
  } catch (error) {
    console.error("exam packs unavailable:", error);
    unavailable = true;
  }
  const openCount = packs.filter((p) => p.unlocked).length;

  return (
    <>
      <SiteHeader current="exam" app />
      <main className="flex-1">
        <Band className="pb-14 pt-10 md:pb-[72px] md:pt-12">
          <div className="flex flex-col gap-8">
            <header className="flex flex-col gap-3.5">
              <div>
                <Pill icon="quiz">คลังข้อสอบ</Pill>
              </div>
              <h1 className="text-[32px] font-semibold md:text-[42px]" style={{ textWrap: "balance" }}>
                ชุดข้อสอบเสมือนจริง
              </h1>
              <p className="max-w-[760px] text-[17px] text-ink2 md:text-[18px]">
                {packs.length > 0
                  ? `ทั้งหมด ${packs.length} ชุด ทำได้ตอนนี้ ${openCount} ชุด — ชุดที่ล็อกอยู่เลือกคอร์สที่ต้องการแล้วไปชำระเงินได้จากตรงนี้`
                  : "ชุดที่ล็อกอยู่จะเปิดให้ทันทีเมื่อชำระเงินสำเร็จ"}
              </p>
            </header>

            {unavailable ? (
              <Note icon="error" className="bg-red-50" iconClass="text-red">
                โหลดรายการชุดข้อสอบไม่ได้ในตอนนี้ ลองใหม่อีกครั้ง
              </Note>
            ) : null}

            {!user && packs.some((p) => !p.unlocked) ? (
              <Note icon="login">
                <Link href="/login?next=/exam" className="font-medium text-brand underline-offset-2 hover:underline">เข้าสู่ระบบ</Link>
                ก่อน ระบบจะได้เช็กสิทธิ์ที่ซื้อไว้และเปิดชุดให้ถูกต้อง
              </Note>
            ) : null}

            {!unavailable && packs.length === 0 ? (
              <Card className="flex flex-col items-center gap-3 py-14 text-center">
                <Icon name="inventory_2" size={40} className="text-ink3" />
                <p className="text-[17px] text-ink2">ยังไม่มีชุดข้อสอบ กลับมาดูใหม่เร็ว ๆ นี้</p>
              </Card>
            ) : null}

            {packs.length > 0 ? <PackChooser packs={packs} products={products.filter((p) => p.active)} /> : null}
          </div>
        </Band>
      </main>
      <SiteFooter />
    </>
  );
}

