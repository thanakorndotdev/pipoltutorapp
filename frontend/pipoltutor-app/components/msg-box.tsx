"use client";

import { useEffect, useRef } from "react";

import { Button, Icon } from "@/components/ui";

export type MsgBoxTone = "info" | "warn" | "danger";

export type MsgBoxAction = { label: string; icon?: string; kind?: "primary" | "ghost"; onClick: () => void };

const TONE: Record<MsgBoxTone, { icon: string; cls: string }> = {
  info: { icon: "info", cls: "bg-brand-50 text-brand" },
  warn: { icon: "timer", cls: "bg-amber-50 text-amber-icon" },
  danger: { icon: "error", cls: "bg-red-50 text-red" },
};

/**
 * Modal message box on the native <dialog>, so focus trapping and Esc come
 * from the browser. `onClose` runs for Esc and for the backdrop; omit it to
 * make the box undismissable (e.g. while an exam is being submitted).
 */
export function MsgBox({
  open,
  tone = "info",
  title,
  children,
  actions = [],
  onClose,
}: {
  open: boolean;
  tone?: MsgBoxTone;
  title: string;
  children?: React.ReactNode;
  actions?: MsgBoxAction[];
  onClose?: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  const t = TONE[tone];
  return (
    <dialog
      ref={ref}
      aria-labelledby="msgbox-title"
      onCancel={(e) => {
        e.preventDefault();
        onClose?.();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose?.();
      }}
      className="m-auto w-[calc(100%-32px)] max-w-[440px] rounded-[24px] bg-card p-0 text-ink shadow-m backdrop:bg-black/40"
    >
      <div className="flex flex-col items-center gap-3 px-6 pb-6 pt-7 text-center">
        <span className={`flex size-14 items-center justify-center rounded-full ${t.cls}`}>
          <Icon name={t.icon} size={30} />
        </span>
        <h2 id="msgbox-title" className="font-display text-[20px] font-semibold leading-[1.4]">
          {title}
        </h2>
        {children ? <div className="text-[15px] leading-[1.7] text-ink2">{children}</div> : null}
        {actions.length > 0 ? (
          <div className="mt-2 flex w-full flex-col-reverse gap-2.5 sm:flex-row sm:justify-center">
            {actions.map((a) => (
              <Button key={a.label} kind={a.kind ?? "primary"} icon={a.icon} size="sm" onClick={a.onClick} className="sm:flex-1">
                {a.label}
              </Button>
            ))}
          </div>
        ) : null}
      </div>
    </dialog>
  );
}
