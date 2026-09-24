import type { ReactNode } from "react";

import { fetchProducts } from "@/lib/api";
import { PLANS, TUTOR_NAME, type Plan } from "@/lib/content";
import { formatBaht } from "@/lib/format";
import { getCopy } from "@/lib/site-texts";
import { SiteImage } from "./site-assets";
import { Button, Icon, IconTile, Pill, Slot, Tick } from "./ui";

/* Shared blocks from figma-plugin/code.js: trustChip, portrait, heroCopy,
   planCard. */

export function TrustChip({
  icon,
  title,
  sub,
  tileClass,
}: {
  icon: string;
  title: string;
  sub: string;
  tileClass: string;
}) {
  return (
    <span className="inline-flex items-center gap-2.5 rounded-[16px] border border-border bg-card py-2.5 pl-[11px] pr-[15px]">
      <IconTile icon={icon} size={33} radius={11} className={tileClass} />
      <span className="flex flex-col">
        <span className="whitespace-nowrap font-display text-[14.5px] font-medium leading-[1.32]">{title}</span>
        <span className="whitespace-nowrap text-[12.5px] leading-[1.35] text-ink3">{sub}</span>
      </span>
    </span>
  );
}

const CHIP_STYLES = [
  ["workspace_premium", "bg-brand-50 text-brand"],
  ["history_edu", "bg-accent-50 text-accent-dark"],
  ["groups", "bg-teal-50 text-teal"],
] as const;

export const DEFAULT_HERO_CHIPS: string[][] = [
  ["ศิษย์เก่า จภ.", "เข้า ม.1 ปี 2560"],
  [`${TUTOR_NAME}สอนเองทุกคาบ`, "สอนสด + คลิปย้อนหลัง"],
];
export const DEFAULT_HERO_FOOTNOTE = `เข้าสู่ระบบแล้วได้เพิ่ม — ทำข้อสอบจำลอง 100 ข้อ · ดูคะแนนรายบทย้อนหลัง · ดูคลิปติวย้อนหลัง · เข้ากลุ่ม LINE ถาม${TUTOR_NAME}`;

export function HeroCopy({
  pill,
  pillIcon,
  title,
  lede,
  ctas,
  chips = DEFAULT_HERO_CHIPS,
  footnote = DEFAULT_HERO_FOOTNOTE,
}: {
  pill: string;
  pillIcon: string;
  title: ReactNode;
  lede: string;
  ctas: ReactNode;
  /** [title, sub] pairs, max 3; from site copy `home.hero_chips`. */
  chips?: string[][];
  footnote?: string;
}) {
  return (
    <div className="flex min-w-0 flex-1 flex-col">
      <div>
        <Pill icon={pillIcon}>{pill}</Pill>
      </div>
      <h1 className="mt-[18px] text-[34px] font-semibold leading-[1.28] md:text-[46px]" style={{ textWrap: "balance" }}>
        {title}
      </h1>
      <p className="mt-[18px] text-[17px] leading-[1.8] text-ink2 md:text-[18px]">{lede}</p>
      <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:flex-wrap">{ctas}</div>
      {chips.length ? (
        <div className="mt-3 flex flex-wrap gap-[11px]">
          {chips.slice(0, CHIP_STYLES.length).map(([title, sub = ""], i) => (
            <TrustChip key={title} icon={CHIP_STYLES[i][0]} title={title} sub={sub} tileClass={CHIP_STYLES[i][1]} />
          ))}
        </div>
      ) : null}
      {footnote ? <p className="mt-3 text-[13.5px] leading-[1.6] text-ink3">{footnote}</p> : null}
    </div>
  );
}

function FloatChip({
  icon,
  iconClass,
  title,
  sub,
  className,
}: {
  icon: string;
  iconClass: string;
  title: string;
  sub: string;
  className: string;
}) {
  return (
    <span className={`absolute flex items-center gap-2.5 rounded-[18px] border border-border bg-card px-[15px] py-[11px] shadow-m ${className}`}>
      <Icon name={icon} size={22} fill className={iconClass} />
      <span className="flex flex-col">
        <span className="whitespace-nowrap font-display text-[15px] font-medium leading-[1.28]">{title}</span>
        <span className="whitespace-nowrap text-[12.5px] leading-[1.35] text-ink3">{sub}</span>
      </span>
    </span>
  );
}

const DEFAULT_PORTRAIT_CHIPS: string[][] = [
  ["สอนสด 24 ครั้ง", "มีคลิปย้อนหลัง"],
  ["ข้อสอบจำลอง 100 ข้อ", "ตรวจอัตโนมัติ"],
];

export async function Portrait() {
  const c = await getCopy();
  const [a, b] = c.rows("home.portrait_chips", DEFAULT_PORTRAIT_CHIPS);
  return (
    <div className="relative mx-auto w-full max-w-[520px] pb-14 pt-3 lg:flex-none lg:basis-[520px]">
      <div className="absolute inset-x-5 top-8 -z-0 h-[85%] rounded-full bg-brand-grad opacity-[0.14]" aria-hidden />
      <div className="relative mx-auto w-[77%]">
        <SiteImage slot="hero_portrait" ratio="4 / 4.5" className="shadow-l">
          <Slot
            icon="account_box"
            title={`รูป${TUTOR_NAME} — ภาพหลัก`}
            note="แนวตั้ง 4:4.5 · ครึ่งตัว พื้นหลังโล่ง"
            ratio="4 / 4.5"
            className="shadow-l"
          />
        </SiteImage>
      </div>
      {a ? <FloatChip icon="menu_book" iconClass="text-accent" title={a[0]} sub={a[1] ?? ""} className="left-0 top-[18%]" /> : null}
      {b ? <FloatChip icon="task_alt" iconClass="text-teal" title={b[0]} sub={b[1] ?? ""} className="right-0 top-[46%]" /> : null}
    </div>
  );
}

export function PlanCard({ plan }: { plan: Plan }) {
  const hot = plan.hot;
  return (
    <article
      className={`flex h-full flex-col gap-[18px] rounded-[26px] p-7 ${
        hot
          ? "bg-brand-grad border-[1.5px] border-brand/40 text-white shadow-l"
          : "border border-border bg-card shadow-s"
      }`}
    >
      <div>
        <Pill className={hot ? "bg-accent text-on-fill" : "bg-brand-50 text-brand"}>{plan.tag}</Pill>
      </div>
      <h3 className={`text-[22px] font-semibold ${hot ? "text-white" : "text-ink"}`}>{plan.name}</h3>
      <p className={`text-[14.5px] ${hot ? "text-on-grad-soft" : "text-ink3"}`}>{plan.desc}</p>
      <p className="flex items-baseline gap-2">
        <span className={`font-display text-[40px] font-semibold leading-[1.1] ${hot ? "text-white" : "text-ink"}`}>
          {formatBaht(plan.price * 100)}
        </span>
        <span className={`text-[14px] ${hot ? "text-on-grad-soft" : "text-ink3"}`}>{plan.unit}</span>
      </p>
      <hr className={hot ? "border-white/25" : "border-border"} />
      <ul className="flex flex-col gap-[11px]">
        {plan.feats.map((f) => (
          <Tick key={f} iconClass={hot ? "text-[#5EE0D0]" : "text-teal"} textClass={hot ? "text-white" : "text-ink"}>
            {f}
          </Tick>
        ))}
      </ul>
      <div className="mt-auto flex flex-col gap-2.5 pt-1">
        <Button href={`/courses/${plan.slug}`} kind={hot ? "light" : "ghost"}>ดูรายละเอียด</Button>
        <Button href={`/checkout?product=${plan.slug}`} kind="primary">{plan.cta}</Button>
      </div>
    </article>
  );
}

/**
 * PLANS with the admin-edited copy (`plans.<slug>.*`) and the DB price applied;
 * slug/hot stay in code. The coded price is only a fallback if the backend is down.
 */
export async function getPlans(): Promise<Plan[]> {
  const [c, products] = await Promise.all([getCopy(), fetchProducts().catch(() => [])]);
  const priceBySlug = new Map(products.map((p) => [p.slug, p.priceSatang / 100]));
  return PLANS.map((p) => ({
    ...p,
    price: priceBySlug.get(p.slug) ?? p.price,
    tag: c.t(`plans.${p.slug}.tag`, p.tag),
    name: c.t(`plans.${p.slug}.name`, p.name),
    desc: c.t(`plans.${p.slug}.desc`, p.desc),
    unit: c.t(`plans.${p.slug}.unit`, p.unit),
    cta: c.t(`plans.${p.slug}.cta`, p.cta),
    feats: c.lines(`plans.${p.slug}.feats`, p.feats),
  }));
}

export async function PlanGrid() {
  const plans = await getPlans();
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 lg:gap-[22px]">
      {plans.map((p) => (
        <PlanCard key={p.slug} plan={p} />
      ))}
    </div>
  );
}

