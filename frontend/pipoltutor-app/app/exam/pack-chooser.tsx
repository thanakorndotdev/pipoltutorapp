"use client";

import Link from "next/link";
import { useId, useState } from "react";

import { Icon, Pill } from "@/components/ui";
import type { ExamPack, Product } from "@/lib/api";
import { formatBaht } from "@/lib/format";

function minutes(seconds: number) {
  return `${Math.round(seconds / 60)} นาที`;
}

/**
 * Two-step chooser. Step one picks a pack; an unlocked pack goes straight
 * to the runner. A locked pack opens step two: the products that unlock it
 * as radio rows, and one checkout button for the chosen one. `unlocked` is
 * the backend's verdict for the session user; POST /attempts is the gate.
 */
export function PackChooser({ packs, products }: { packs: ExamPack[]; products: Product[] }) {
  const [packId, setPackId] = useState<string>(() => (packs.find((p) => p.unlocked) ?? packs[0])!.id);
  const [productId, setProductId] = useState<string | null>(null);
  const groupId = useId();

  const pack = packs.find((p) => p.id === packId) ?? packs[0]!;
  const byId = new Map(products.map((p) => [p.id, p]));
  const unlockers = pack.productIds
    .map((id) => byId.get(id))
    .filter((p): p is Product => p !== undefined)
    .sort((a, b) => a.priceSatang - b.priceSatang);
  const chosenProduct = unlockers.find((p) => p.id === productId) ?? unlockers[0] ?? null;

  function pick(id: string) {
    setPackId(id);
    setProductId(null);
  }

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,5fr)_minmax(0,4fr)] lg:gap-5">
      <ul role="radiogroup" aria-labelledby={`${groupId}-packs`} className="flex flex-col gap-2.5">
        <span id={`${groupId}-packs`} className="sr-only">เลือกชุดข้อสอบ</span>
        {packs.map((p) => {
          const on = p.id === pack.id;
          return (
            <li key={p.id}>
              <button
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => pick(p.id)}
                className={`flex w-full items-center gap-3.5 rounded-[18px] border-[1.5px] px-4 py-3.5 text-left transition-[border-color,box-shadow,transform] ${
                  on ? "border-brand bg-card shadow-m" : "border-border bg-card shadow-s hover:-translate-y-px hover:border-border-strong"
                }`}
              >
                <span
                  className={`flex size-11 shrink-0 items-center justify-center rounded-[14px] ${
                    p.unlocked ? "bg-teal-50 text-teal" : "bg-amber-50 text-amber-icon"
                  }`}
                >
                  <Icon name={p.unlocked ? "quiz" : "lock"} size={22} fill />
                </span>
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="truncate font-display text-[16px] font-medium leading-[1.34] text-ink">{p.title}</span>
                  <span className="text-[13.5px] leading-[1.6] text-ink3">
                    {p.questionCount} ข้อ · {minutes(p.allowedSeconds)}
                    {p.productIds.length === 0 ? " · ชุดฟรี" : ""}
                  </span>
                </span>
                <span
                  aria-hidden
                  className={`flex size-6 shrink-0 items-center justify-center rounded-full border-[1.5px] transition-colors ${
                    on ? "border-brand bg-brand text-on-fill" : "border-border-strong"
                  }`}
                >
                  {on ? <Icon name="check" size={16} /> : null}
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      <div className="flex flex-col gap-4 rounded-[22px] border border-border bg-card p-5 shadow-s">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 flex-col gap-1">
            <h3 className="font-display text-[18px] font-medium leading-[1.34]">{pack.title}</h3>
            <p className="text-[13.5px] leading-[1.6] text-ink3">
              เวลาที่ได้ {minutes(pack.allowedSeconds)} ({pack.timeMultiplierPercent}% ของ {minutes(pack.durationSeconds)})
            </p>
          </div>
          {pack.unlocked ? (
            <Pill icon="check_circle" className="bg-green-50 text-green">ทำได้เลย</Pill>
          ) : (
            <Pill icon="lock" className="bg-amber-50 text-amber-ink">ยังไม่เปิด</Pill>
          )}
        </div>

        {pack.unlocked ? (
          <>
            <p className="text-[15px] leading-[1.7] text-ink2">
              จับเวลาเสมือนห้องสอบจริง ตอบแล้วระบบบันทึกให้อัตโนมัติ ส่งแล้วได้สรุปคะแนนรายบททันที
            </p>
            <Link
              href={`/exam/${encodeURIComponent(pack.slug)}`}
              className="mt-auto inline-flex min-h-[48px] items-center justify-center gap-2 rounded-full bg-brand px-6 font-display text-[16px] font-medium text-on-fill shadow-m transition-transform hover:-translate-y-px"
            >
              <Icon name="play_arrow" size={20} />
              เริ่มทำข้อสอบ
            </Link>
          </>
        ) : unlockers.length === 0 ? (
          <p className="text-[15px] leading-[1.7] text-ink2">ชุดนี้ยังไม่เปิดขาย กลับมาดูใหม่เร็ว ๆ นี้</p>
        ) : (
          <>
            <div role="radiogroup" aria-labelledby={`${groupId}-products`} className="flex flex-col gap-2">
              <p id={`${groupId}-products`} className="text-[14.5px] leading-[1.7] text-ink2">
                เลือกคอร์สที่จะปลดล็อกชุดนี้
              </p>
              {unlockers.map((p) => {
                const on = p.id === chosenProduct?.id;
                return (
                  <button
                    key={p.id}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    onClick={() => setProductId(p.id)}
                    className={`flex items-center gap-3 rounded-[14px] border-[1.5px] px-3.5 py-3 text-left transition-colors ${
                      on ? "border-brand bg-brand-50" : "border-border bg-page hover:border-border-strong"
                    }`}
                  >
                    <span
                      aria-hidden
                      className={`flex size-5 shrink-0 items-center justify-center rounded-full border-[1.5px] ${
                        on ? "border-brand bg-brand text-on-fill" : "border-border-strong bg-card"
                      }`}
                    >
                      {on ? <Icon name="check" size={14} /> : null}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-[15px] text-ink">{p.title}</span>
                    <span className="shrink-0 font-display text-[15px] font-medium text-ink">{formatBaht(p.priceSatang)}</span>
                  </button>
                );
              })}
            </div>
            {chosenProduct ? (
              <Link
                href={`/checkout?product=${encodeURIComponent(chosenProduct.slug)}`}
                className="mt-auto inline-flex min-h-[48px] items-center justify-center gap-2 rounded-full bg-accent px-6 font-display text-[16px] font-medium text-on-fill shadow-m transition-transform hover:-translate-y-px"
              >
                <Icon name="shopping_cart" size={20} />
                ไปชำระเงิน {formatBaht(chosenProduct.priceSatang)}
              </Link>
            ) : null}
            <p className="text-[13px] leading-[1.7] text-ink3">ชำระเงินสำเร็จแล้วชุดนี้เปิดให้ทำทันที</p>
          </>
        )}
      </div>
    </div>
  );
}
