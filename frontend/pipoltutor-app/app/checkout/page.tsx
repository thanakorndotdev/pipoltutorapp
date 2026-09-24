import Link from "next/link";

import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { Band } from "@/components/ui";
import { fetchProducts, type Product } from "@/lib/api";
import { formatBaht } from "@/lib/format";
import { CheckoutForm } from "./checkout-form";

export const metadata = { title: "ชำระเงิน · PIPOL TUTOR" };

const DEFAULT_PRODUCT = "full-course";

export default async function CheckoutPage({
  searchParams,
}: {
  searchParams: Promise<{ product?: string | string[] }>;
}) {
  const { product: requested } = await searchParams;
  const slug = typeof requested === "string" ? requested : DEFAULT_PRODUCT;

  let product: Product | undefined;
  let loadError: string | null = null;
  try {
    const products = await fetchProducts();
    product = products.find((p) => p.slug === slug && p.active);
  } catch {
    loadError = "ติดต่อระบบไม่ได้ในขณะนี้ กรุณาลองใหม่อีกครั้ง";
  }

  return (
    <>
      <SiteHeader current="courses" />
      <main className="flex-1">
        <Band className="pb-14 pt-10 md:pb-[72px] md:pt-12">
        <header className="mb-7 flex flex-col gap-2">
          <h1 className="text-[30px] font-medium md:text-[36px]">ชำระเงิน</h1>
          <p className="text-[16px] text-ink2">ขั้นตอนที่ 2 จาก 3 · กรอกข้อมูลผู้เรียนและเลือกวิธีชำระเงิน</p>
        </header>

        {loadError || !product ? (
          <section className="rounded-[18px] border border-border bg-card p-6 shadow-s">
            <p className="text-[16px] text-ink2">
              {loadError ?? "ไม่พบคอร์สที่เลือก"}
            </p>
            <Link href="/courses" className="mt-4 inline-block text-[16px] font-medium text-brand">
              กลับไปหน้าคอร์สเรียน
            </Link>
          </section>
        ) : (
          <div className="flex flex-col gap-7 lg:flex-row lg:items-start lg:gap-10">
            <div className="min-w-0 flex-1">
              <CheckoutForm productId={product.id} />
            </div>
            <OrderSummary product={product} />
          </div>
        )}
        </Band>
      </main>
      <SiteFooter />
    </>
  );
}

function OrderSummary({ product }: { product: Product }) {
  return (
    <aside className="w-full rounded-[18px] border border-border bg-card p-6 shadow-m lg:w-[380px] lg:shrink-0">
      <h3 className="text-[19px] font-medium">สรุปคำสั่งซื้อ</h3>
      <div className="mt-4 flex items-start gap-3.5">
        <div className="flex size-[34px] shrink-0 items-center justify-center rounded-[11px] bg-brand-50 font-display text-[15px] font-medium text-brand-dark">
          จภ
        </div>
        <div className="min-w-0">
          <p className="display text-[15.5px] font-medium">{product.title}</p>
          {product.description ? (
            <p className="text-[14px] text-ink3">{product.description}</p>
          ) : null}
        </div>
      </div>
      <hr className="my-5 border-border" />
      <dl className="flex flex-col gap-1 text-[15px]">
        <div className="flex justify-between gap-4">
          <dt className="text-ink2">ราคาคอร์ส</dt>
          <dd>{formatBaht(product.priceSatang)}</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-ink2">ค่าจัดส่งเอกสาร</dt>
          <dd>ฟรี</dd>
        </div>
      </dl>
      <hr className="my-5 border-border" />
      <div className="flex items-baseline justify-between gap-4">
        <span className="text-[16px] font-medium">ยอดที่ต้องชำระ</span>
        <span className="display text-[28px] font-medium">{formatBaht(product.priceSatang)}</span>
      </div>
      <p className="mt-4 rounded-[16px] bg-brand-50 px-4 py-3.5 text-[14px] text-ink2">
        ระบบเปิดสิทธิ์เข้าเรียนอัตโนมัติทันทีที่ชำระสำเร็จ
      </p>
    </aside>
  );
}
