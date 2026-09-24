import Link from "next/link";
import type { ReactNode } from "react";

/* Primitives mirrored from figma-plugin/code.js: icon, pill, btn, card,
   iconTile, tick, sectionHead, slot, statCard, menuCard, faqItem, bar. */

export function Icon({
  name,
  size = 20,
  fill = false,
  className = "",
}: {
  name: string;
  size?: number;
  fill?: boolean;
  className?: string;
}) {
  return (
    <span
      aria-hidden
      className={`sym ${fill ? "fill" : ""} ${className}`}
      style={{ fontSize: size }}
    >
      {name}
    </span>
  );
}

export function Pill({
  children,
  icon,
  className = "bg-brand-50 text-brand-dark",
}: {
  children: ReactNode;
  icon?: string;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full py-2 pr-4 font-display text-[13.5px] font-medium leading-[1.4] ${
        icon ? "pl-3" : "pl-4"
      } ${className}`}
    >
      {icon ? <Icon name={icon} size={16} fill /> : null}
      {children}
    </span>
  );
}

export type ButtonKind = "primary" | "brand" | "line" | "ghost" | "light";

const BTN: Record<ButtonKind, string> = {
  primary: "bg-accent text-on-fill shadow-m",
  brand: "bg-brand text-on-fill shadow-m",
  line: "bg-line text-on-fill shadow-m",
  ghost: "bg-card text-ink border-[1.5px] border-border-strong",
  light: "bg-card text-brand-dark shadow-m",
};

export function Button({
  children,
  kind = "primary",
  icon,
  trailingIcon,
  href,
  size = "md",
  className = "",
  type = "button",
  onClick,
  disabled,
}: {
  children: ReactNode;
  kind?: ButtonKind;
  icon?: string;
  trailingIcon?: boolean;
  href?: string;
  size?: "md" | "sm";
  className?: string;
  type?: "button" | "submit";
  onClick?: () => void;
  disabled?: boolean;
}) {
  const cls = `inline-flex min-h-[44px] items-center justify-center gap-2 whitespace-nowrap rounded-full font-display text-[16px] font-medium leading-[1.3] transition-transform hover:-translate-y-px disabled:opacity-60 disabled:hover:translate-y-0 ${
    size === "sm" ? "px-5 py-3" : "px-[26px] py-4"
  } ${BTN[kind]} ${className}`;
  const inner = (
    <>
      {icon && !trailingIcon ? <Icon name={icon} size={20} /> : null}
      {children}
      {icon && trailingIcon ? <Icon name={icon} size={20} /> : null}
    </>
  );
  if (href) {
    return (
      <Link href={href} className={cls}>
        {inner}
      </Link>
    );
  }
  return (
    <button type={type} className={cls} onClick={onClick} disabled={disabled}>
      {inner}
    </button>
  );
}

export function Card({
  children,
  className = "",
  lifted = false,
  as: Tag = "div",
}: {
  children: ReactNode;
  className?: string;
  lifted?: boolean;
  as?: "div" | "section" | "aside" | "article";
}) {
  return (
    <Tag
      className={`rounded-[24px] border border-border bg-card p-6 ${
        lifted ? "shadow-m" : "shadow-s"
      } ${className}`}
    >
      {children}
    </Tag>
  );
}

export function IconTile({
  icon,
  size = 48,
  radius = 15,
  className = "bg-brand-50 text-brand",
  fill = true,
}: {
  icon: string;
  size?: number;
  radius?: number;
  className?: string;
  fill?: boolean;
}) {
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center ${className}`}
      style={{ width: size, height: size, borderRadius: radius }}
    >
      <Icon name={icon} size={Math.round(size * 0.52)} fill={fill} />
    </span>
  );
}

export function Tick({
  children,
  icon = "check_circle",
  iconClass = "text-teal",
  textClass = "text-ink",
}: {
  children: ReactNode;
  icon?: string;
  iconClass?: string;
  textClass?: string;
}) {
  return (
    <li className="flex items-start gap-[11px]">
      <Icon name={icon} size={21} fill className={`mt-[3px] ${iconClass}`} />
      <span className={`text-[15.5px] ${textClass}`}>{children}</span>
    </li>
  );
}

export function SectionHead({
  title,
  sub,
  center = false,
  light = false,
}: {
  title: string;
  sub?: string;
  center?: boolean;
  light?: boolean;
}) {
  return (
    <div className={`flex flex-col gap-3 ${center ? "items-center text-center" : ""}`}>
      <h2
        className={`text-[28px] font-semibold md:text-[34px] ${light ? "text-on-fill" : ""}`}
        style={{ textWrap: "balance" }}
      >
        {title}
      </h2>
      {sub ? (
        <p
          className={`text-[16px] ${light ? "text-on-grad-soft" : "text-ink2"} ${
            center ? "max-w-[760px]" : "max-w-[640px]"
          }`}
        >
          {sub}
        </p>
      ) : null}
    </div>
  );
}

/** Media placeholder — the tinted "slot" the plugin draws where a photo goes. */
export function Slot({
  icon,
  title,
  note,
  ratio = "4 / 3",
  className = "",
  tint = "from-brand-50 to-brand-100",
}: {
  icon: string;
  title: string;
  note?: string;
  ratio?: string;
  className?: string;
  tint?: string;
}) {
  return (
    <div
      className={`flex w-full max-w-full flex-col items-center justify-center gap-1.5 rounded-[28px] bg-gradient-to-br p-6 text-center ${tint} ${className}`}
      style={{ aspectRatio: ratio }}
      role="img"
      aria-label={title}
    >
      <Icon name={icon} size={40} className="text-brand/60" />
      <span className="font-display text-[15px] font-medium text-ink2">{title}</span>
      {note ? <span className="text-[13px] text-ink3">{note}</span> : null}
    </div>
  );
}

export function StatCard({
  icon,
  tileClass,
  value,
  label,
}: {
  icon: string;
  tileClass: string;
  value: string;
  label: string;
}) {
  return (
    <div className="flex items-center gap-3.5 rounded-[20px] border border-border bg-card px-5 py-[18px] shadow-s">
      <IconTile icon={icon} size={44} radius={14} className={tileClass} />
      <div className="min-w-0">
        <p className="display text-[21px] font-semibold leading-[1.24]">{value}</p>
        <p className="text-[13.5px] text-ink3">{label}</p>
      </div>
    </div>
  );
}

export function MenuCard({
  icon,
  tileClass,
  title,
  desc,
  meta,
  href,
}: {
  icon: string;
  tileClass: string;
  title: string;
  desc: string;
  meta: string;
  href?: string;
}) {
  const body = (
    <>
      <IconTile icon={icon} size={48} radius={15} className={tileClass} />
      <h3 className="text-[18px] font-medium">{title}</h3>
      <p className="text-[14.5px] text-ink2">{desc}</p>
      <div className="mt-auto flex items-center justify-between gap-2.5 pt-1">
        <span className="text-[13px] text-ink3">{meta}</span>
        <Icon name="arrow_forward" size={19} className="text-brand" />
      </div>
    </>
  );
  const cls = "flex h-full flex-col gap-3 rounded-[22px] border border-border bg-card p-6 shadow-s";
  return href ? (
    <Link href={href} className={`${cls} transition-transform hover:-translate-y-0.5`}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}

export function FaqItem({ q, a, open = false }: { q: string; a: string; open?: boolean }) {
  return (
    <details className="group rounded-[18px] border border-border bg-card p-5 shadow-s" open={open}>
      <summary className="flex cursor-pointer list-none items-center justify-between gap-4 [&::-webkit-details-marker]:hidden">
        <span className="font-display text-[16.5px] font-medium leading-[1.45]">{q}</span>
        <Icon name="add" size={23} className="text-brand group-open:hidden" />
        <Icon name="remove" size={23} className="hidden text-brand group-open:inline-block" />
      </summary>
      <p className="mt-2.5 text-[15.5px] text-ink2">{a}</p>
    </details>
  );
}

export function Bar({ pct, colorClass }: { pct: number; colorClass: string }) {
  return (
    <div className="h-[11px] w-full overflow-hidden rounded-full bg-page" aria-hidden>
      <div className={`h-full rounded-full ${colorClass}`} style={{ width: `${Math.round(pct * 100)}%` }} />
    </div>
  );
}

export function Note({
  icon,
  children,
  className = "bg-brand-50",
  iconClass = "text-brand",
}: {
  icon: string;
  children: ReactNode;
  className?: string;
  iconClass?: string;
}) {
  return (
    <div className={`flex items-start gap-[11px] rounded-[16px] px-4 py-3.5 ${className}`}>
      <Icon name={icon} size={20} fill className={`mt-[3px] ${iconClass}`} />
      <p className="text-[14.5px] text-ink2">{children}</p>
    </div>
  );
}

/** Page band: gutter + vertical rhythm from band() in the plugin. */
export function Band({
  children,
  className = "",
  id,
  tone = "page",
}: {
  children: ReactNode;
  className?: string;
  id?: string;
  tone?: "page" | "card" | "brand" | "mystic" | "none";
}) {
  const bg =
    tone === "card"
      ? "bg-card"
      : tone === "brand"
        ? "bg-brand-grad"
        : tone === "mystic"
          ? "bg-mystic-grad"
          : tone === "page"
            ? "bg-page"
            : "";
  return (
    <section id={id} className={`w-full px-5 md:px-10 lg:px-[72px] ${bg} ${className}`}>
      <div className="mx-auto w-full max-w-[1296px]">{children}</div>
    </section>
  );
}
