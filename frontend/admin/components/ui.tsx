import type { ReactNode } from "react";

export function Icon({ name, size = 20, fill = false, className = "" }: { name: string; size?: number; fill?: boolean; className?: string }) {
  return (
    <span aria-hidden className={`sym ${fill ? "fill" : ""} ${className}`} style={{ fontSize: size }}>
      {name}
    </span>
  );
}

type ButtonKind = "primary" | "ghost" | "danger" | "subtle";
const BTN: Record<ButtonKind, string> = {
  primary: "bg-brand text-on-fill hover:bg-brand-dark",
  ghost: "bg-card text-ink border-[1.5px] border-border-strong hover:bg-page",
  danger: "bg-red-50 text-red border-[1.5px] border-red/30 hover:bg-red/10",
  subtle: "bg-transparent text-ink2 hover:bg-page",
};

export function Button({
  children,
  kind = "primary",
  icon,
  size = "md",
  className = "",
  type = "button",
  onClick,
  disabled,
  title,
}: {
  children?: ReactNode;
  kind?: ButtonKind;
  icon?: string;
  size?: "sm" | "md";
  className?: string;
  type?: "button" | "submit";
  onClick?: () => void;
  disabled?: boolean;
  title?: string;
}) {
  const pad = size === "sm" ? "min-h-[36px] px-3 text-[14px] gap-1.5" : "min-h-[44px] px-4 text-[15px] gap-2";
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`inline-flex items-center justify-center rounded-[12px] font-medium transition disabled:cursor-not-allowed disabled:opacity-50 ${pad} ${BTN[kind]} ${className}`}
    >
      {icon ? <Icon name={icon} size={size === "sm" ? 17 : 19} /> : null}
      {children}
    </button>
  );
}

export function Card({ children, className = "", as: Tag = "div" }: { children: ReactNode; className?: string; as?: "div" | "section" | "aside" | "form" }) {
  return <Tag className={`rounded-[20px] border border-border bg-card p-5 shadow-s ${className}`}>{children}</Tag>;
}

export function Note({ icon, children, tone = "info" }: { icon?: string; children: ReactNode; tone?: "info" | "ok" | "warn" | "error" }) {
  const cls = { info: "bg-brand-50 text-ink2", ok: "bg-green-50 text-ink2", warn: "bg-amber-50 text-amber-ink", error: "bg-red-50 text-ink2" }[tone];
  const iconCls = { info: "text-brand", ok: "text-green", warn: "text-amber-icon", error: "text-red" }[tone];
  const name = icon ?? { info: "info", ok: "check_circle", warn: "warning", error: "error" }[tone];
  return (
    <div role={tone === "error" ? "alert" : undefined} className={`flex items-start gap-2.5 rounded-[14px] px-4 py-3 text-[14.5px] ${cls}`}>
      <Icon name={name} size={19} fill className={`mt-[3px] ${iconCls}`} />
      <div className="flex-1">{children}</div>
    </div>
  );
}

export const inputClass =
  "w-full min-h-[44px] rounded-[12px] border-[1.5px] border-border bg-page px-3.5 py-2.5 text-[15.5px] text-ink placeholder:text-ink3 disabled:opacity-60";

export function Field({ label, hint, error, children, id }: { label: string; hint?: string; error?: string; children: ReactNode; id?: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="display text-[14px] font-medium">
        {label}
      </label>
      {children}
      {error ? <p className="text-[13.5px] text-red">{error}</p> : hint ? <p className="text-[13.5px] text-ink3">{hint}</p> : null}
    </div>
  );
}

export function Tag({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "brand" | "green" | "red" | "amber" | "teal" | "mystic" }) {
  const cls = {
    neutral: "bg-page text-ink2 border-border",
    brand: "bg-brand-50 text-brand border-brand-100",
    green: "bg-green-50 text-green border-green/20",
    red: "bg-red-50 text-red border-red/20",
    amber: "bg-amber-50 text-amber-ink border-amber/30",
    teal: "bg-teal-50 text-teal border-teal/20",
    mystic: "bg-mystic-50 text-mystic border-mystic/20",
  }[tone];
  return <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[12.5px] font-medium ${cls}`}>{children}</span>;
}

export const SUBJECT_TONE = { math: "brand", science: "teal", general_aptitude: "mystic", thai: "amber", english: "green" } as const;

export function PageHeader({ title, sub, actions }: { title: string; sub?: string; actions?: ReactNode }) {
  return (
    <header className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
      <div>
        <h1 className="text-[26px] font-semibold md:text-[30px]">{title}</h1>
        {sub ? <p className="text-[15px] text-ink2">{sub}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </header>
  );
}

export function Spinner({ label = "กำลังโหลด…" }: { label?: string }) {
  return (
    <p className="flex items-center gap-2 py-8 text-[15px] text-ink3" role="status">
      <Icon name="progress_activity" className="animate-spin" /> {label}
    </p>
  );
}

export function Empty({ icon = "inbox", children }: { icon?: string; children: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-[16px] border border-dashed border-border-strong px-4 py-10 text-center text-[15px] text-ink3">
      <Icon name={icon} size={32} />
      <div>{children}</div>
    </div>
  );
}

/** Simple modal; closes on Escape and backdrop click. */
export function Modal({ title, onClose, children, wide = false }: { title: string; onClose: () => void; children: ReactNode; wide?: boolean }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-ink/50 p-0 sm:items-center sm:p-6"
      onClick={onClose}
      onKeyDown={(e) => e.key === "Escape" && onClose()}
    >
      <div
        role="dialog"
        aria-modal
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
        className={`flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-[20px] bg-card shadow-l sm:rounded-[20px] ${wide ? "sm:max-w-[960px]" : "sm:max-w-[640px]"}`}
      >
        <div className="flex items-center justify-between border-b border-border px-5 py-3.5">
          <h2 className="text-[18px] font-semibold">{title}</h2>
          <Button kind="subtle" size="sm" icon="close" onClick={onClose} title="ปิด" />
        </div>
        <div className="overflow-y-auto px-5 py-4">{children}</div>
      </div>
    </div>
  );
}
