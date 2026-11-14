import type { ReactNode } from "react";

import { Icon } from "@/components/ui";
import { formatThaiDate } from "@/lib/format";

/** Round profile photo; falls back to an icon when there is none. */
export function ProfilePhoto({ src, size = 112, className = "" }: { src: string | null; size?: number; className?: string }) {
  const style = { width: size, height: size };
  return src ? (
    // eslint-disable-next-line @next/next/no-img-element -- uploaded or Google photo, already sized server-side
    <img src={src} alt="" referrerPolicy="no-referrer" style={style} className={`shrink-0 rounded-full object-cover ${className}`} />
  ) : (
    <span style={style} className={`flex shrink-0 items-center justify-center rounded-full bg-brand-100 text-brand ${className}`}>
      <Icon name="person" size={Math.round(size * 0.55)} fill />
    </span>
  );
}

/**
 * Social-style header: gradient cover, overlapping photo, nickname, bio and a
 * few non-sensitive stats. Never shows scores, legal name or email.
 */
export function ProfileCard({
  name,
  bio,
  photo,
  joinedAt,
  highestFire,
  certificates,
  action,
}: {
  name: string;
  bio: string | null;
  photo: string | null;
  joinedAt: string | null;
  highestFire: number;
  certificates: number;
  action?: ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-[28px] border border-border bg-card shadow-m">
      <div className="bg-brand-grad h-[120px] md:h-[150px]" aria-hidden />
      <div className="flex flex-col gap-4 px-5 pb-6 md:px-8 md:pb-8">
        <div className="-mt-14 flex items-end justify-between gap-3 md:-mt-16">
          <ProfilePhoto src={photo} size={112} className="border-4 border-card bg-card" />
          {action ? <div className="pb-1">{action}</div> : null}
        </div>
        <div className="flex flex-col gap-2">
          <h1 className="text-[26px] font-semibold leading-[1.35] md:text-[30px]">{name}</h1>
          {bio ? (
            <p className="whitespace-pre-wrap break-words text-[16px] leading-[1.8] text-ink2">{bio}</p>
          ) : (
            <p className="text-[15px] text-ink3">ยังไม่ได้เขียนแนะนำตัว</p>
          )}
        </div>
        <ul className="flex flex-wrap gap-x-6 gap-y-2 text-[14.5px] text-ink2">
          <li className="flex items-center gap-1.5">
            <Icon name="local_fire_department" size={18} fill className="text-amber-icon" />
            ไฟสูงสุด <b className="font-semibold text-ink">{highestFire}</b>
          </li>
          <li className="flex items-center gap-1.5">
            <Icon name="workspace_premium" size={18} fill className="text-brand" />
            เกียรติบัตร <b className="font-semibold text-ink">{certificates}</b> ใบ
          </li>
          {joinedAt ? (
            <li className="flex items-center gap-1.5">
              <Icon name="calendar_month" size={18} className="text-ink3" />
              เข้าร่วมเมื่อ {formatThaiDate(joinedAt)}
            </li>
          ) : null}
        </ul>
      </div>
    </section>
  );
}
