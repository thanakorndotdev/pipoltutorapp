import { SiteHeader } from "@/components/site-header";
import { SlimFooter } from "@/components/site-footer";
import { Band, Pill, Tick } from "@/components/ui";
import { fetchProducts } from "@/lib/api";
import { FortuneForm } from "./fortune-form";

export const metadata = { title: "ดูดวงแนวทางการสอบ · PIPOL TUTOR" };

const POINTS = ["ใช้เวลาไม่เกิน 1 นาที", "ผลคำทำนายเก็บไว้ในบัญชีของน้อง กลับมาดูซ้ำได้", "คำทำนายเป็นความบันเทิง ไม่ใช่การรับประกันผลสอบ"];

export default async function FortunePage() {
  // Each active fortune product is a topic with its own admin-set price.
  const topics = (await fetchProducts().catch(() => []))
    .filter((p) => p.kind === "fortune" && p.active)
    .sort((a, b) => a.priceSatang - b.priceSatang)
    .map((p) => ({ slug: p.slug, title: p.title, priceSatang: p.priceSatang }));
  return (
    <>
      <SiteHeader current="fortune" app />
      <main className="flex-1">
        <Band tone="mystic" className="pb-12 pt-10 md:pb-16 md:pt-14">
          <div className="flex flex-col gap-9 lg:flex-row lg:items-center lg:gap-12">
            <div className="flex min-w-0 flex-1 flex-col">
              <div>
                <Pill icon="auto_awesome" className="bg-[#4A2A9E] text-white">โมดูลดูดวงแนวทางการสอบ</Pill>
              </div>
              <h1 className="mt-4 text-[32px] font-semibold text-white md:text-[42px]" style={{ textWrap: "balance" }}>
                ดูดวงแนวทางการเตรียมสอบ
                <br />
                ของน้องในรอบนี้
              </h1>
              <p className="mt-3.5 text-[17px] text-[#D9CCFF]">
                กรอกข้อมูลให้ครบ ระบบจะประมวลผลคำทำนายตามกติกาที่ตกลงกับผู้สอนไว้ แล้วสรุปเป็นแนวทางการอ่านหนังสือและช่วงเวลาที่เหมาะกับน้อง
              </p>
              <ul className="mt-6 flex flex-col gap-3">
                {POINTS.map((p) => (
                  <Tick key={p} iconClass="text-[#FFC94D]" textClass="text-[#D9CCFF]">{p}</Tick>
                ))}
              </ul>
            </div>
            <FortuneForm topics={topics} />
          </div>
        </Band>
      </main>
      <SlimFooter />
    </>
  );
}
