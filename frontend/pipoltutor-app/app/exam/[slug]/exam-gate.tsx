"use client";

import { useState } from "react";

import { Button, Icon } from "@/components/ui";
import type { ExamPackDetail } from "@/lib/api";
import { attemptsLabel, minutes, windowLabel, type PackAction } from "@/lib/exam-state";
import { ExamClient } from "./exam-client";

const TYPE_LABEL = { single: "ปรนัย (เลือก 1 ข้อ)", multiple: "เลือกได้หลายข้อ", short: "เติมคำตอบ" } as const;

const pts = (n: number) => `${Number.isInteger(n) ? n : n.toFixed(2).replace(/0$/, "")} คะแนน`;

/**
 * คำชี้แจง before the clock. Nothing is started until the student presses
 * the confirm button: that mounts the runner, whose first request creates
 * the attempt and fixes its deadline on the server.
 */
export function ExamGate({ pack, action, studentName }: { pack: ExamPackDetail; action: PackAction; studentName: string }) {
  const [started, setStarted] = useState(false);
  const [agreed, setAgreed] = useState(false);

  if (started) return <ExamClient packId={pack.id} packTitle={pack.title} studentName={studentName} />;

  const s = pack.summary;
  const named = s.sections.filter((x) => x.title);
  const window = windowLabel(pack);
  const canGo = action === "start" || action === "resume";
  const blocked =
    action === "used_up"
      ? "น้องทำชุดนี้ครบจำนวนครั้งแล้ว ดูคะแนนย้อนหลังได้ที่หน้าประวัติการสอบ"
      : action === "upcoming"
        ? `ชุดนี้ยังไม่เปิดให้ทำ${pack.opensAt ? ` — ${window}` : ""}`
        : action === "closed"
          ? "ชุดนี้ปิดรับคำตอบแล้ว"
          : null;

  return (
    <div className="w-full px-5 pb-14 pt-8 md:px-10 md:pt-12">
      <div className="mx-auto flex max-w-[860px] flex-col gap-6">
        <header className="flex flex-col gap-2">
          <p className="font-display text-[14.5px] font-medium text-brand">คำชี้แจงก่อนเริ่มทำข้อสอบ</p>
          <h1 className="text-[28px] font-semibold md:text-[34px]" style={{ textWrap: "balance" }}>{pack.title}</h1>
          <p className="text-[15px] text-ink3">ผู้สอบ: {studentName}</p>
        </header>

        <dl className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {[
            { icon: "format_list_numbered", label: "จำนวนข้อ", value: `${s.questions} ข้อ` },
            { icon: "view_agenda", label: "จำนวนตอน", value: `${Math.max(1, named.length)} ตอน` },
            { icon: "star", label: "คะแนนเต็ม", value: pts(s.totalPoints) },
            { icon: "timer", label: "เวลาทำ", value: minutes(pack.allowedSeconds) },
          ].map((x) => (
            <div key={x.label} className="flex flex-col gap-1 rounded-[20px] border border-border bg-card p-4 shadow-s">
              <Icon name={x.icon} size={22} className="text-brand" />
              <dt className="text-[13.5px] text-ink3">{x.label}</dt>
              <dd className="tabular font-display text-[20px] font-semibold">{x.value}</dd>
            </div>
          ))}
        </dl>

        {named.length > 0 ? (
          <section className="rounded-[22px] border border-border bg-card p-5 shadow-s">
            <h2 className="text-[17px] font-semibold">โครงสร้างข้อสอบ</h2>
            <ul className="mt-3 flex flex-col divide-y divide-border">
              {s.sections.map((x, i) => (
                <li key={i} className="flex items-baseline justify-between gap-3 py-2.5 text-[15.5px]">
                  <span>{x.title || "ไม่ระบุตอน"}</span>
                  <span className="tabular shrink-0 text-ink2">{x.questions} ข้อ · {pts(x.points)}</span>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <section className="flex flex-col gap-3 rounded-[22px] border border-border bg-card p-5 shadow-s">
          <h2 className="text-[17px] font-semibold">อ่านก่อนเริ่ม</h2>
          {pack.description ? <p className="whitespace-pre-line text-[15.5px] leading-[1.8] text-ink2">{pack.description}</p> : null}
          <ul className="flex flex-col gap-2 text-[15px] leading-[1.75] text-ink2">
            <li className="flex gap-2"><Icon name="timer" size={19} className="mt-1 text-accent-dark" />เวลา {minutes(pack.allowedSeconds)} เริ่มนับทันทีที่กดปุ่มเริ่มด้านล่าง และนับต่อแม้ปิดหน้าเว็บ หมดเวลาระบบส่งคำตอบให้อัตโนมัติ</li>
            {pack.closesAt ? <li className="flex gap-2"><Icon name="event_busy" size={19} className="mt-1 text-red" />{window} — ถึงเวลาปิดรับ ระบบส่งให้ทันทีแม้เวลาทำยังเหลือ</li> : null}
            <li className="flex gap-2"><Icon name="replay" size={19} className="mt-1 text-brand" />{attemptsLabel(pack)}</li>
            <li className="flex gap-2"><Icon name="cloud_done" size={19} className="mt-1 text-green" />ตอบแล้วระบบเซฟให้ทันที ข้ามข้อหรือย้อนกลับได้ ส่งแล้วแก้ไม่ได้</li>
            <li className="flex gap-2">
              <Icon name="rule" size={19} className="mt-1 text-brand" />
              รูปแบบคำถาม: {(Object.keys(TYPE_LABEL) as (keyof typeof TYPE_LABEL)[]).filter((k) => s.types[k] > 0).map((k) => `${TYPE_LABEL[k]} ${s.types[k]} ข้อ`).join(" · ")}
            </li>
            {s.types.short > 0 ? (
              <li className="flex gap-2"><Icon name="keyboard" size={19} className="mt-1 text-brand" />ข้อเติมคำตรวจแบบตรงทุกตัวอักษร ตัวพิมพ์เล็ก–ใหญ่ ช่องว่าง และรูปแบบตัวเลขมีผล เช่น 0.5 กับ 0.50 ถือว่าต่างกัน ยกเว้นข้อที่ระบุว่ารับได้หลายแบบ</li>
            ) : null}
          </ul>
        </section>

        {blocked ? (
          <div className="flex flex-col items-start gap-3 rounded-[20px] bg-amber-50 px-5 py-4">
            <p className="text-[15.5px] text-amber-ink">{blocked}</p>
            <Button href={action === "used_up" ? "/dashboard" : "/exam"} kind="ghost" icon="arrow_back" size="sm">
              {action === "used_up" ? "ไปหน้าประวัติการสอบ" : "กลับไปเลือกชุดอื่น"}
            </Button>
          </div>
        ) : null}

        {canGo ? (
          <div className="flex flex-col gap-4 rounded-[22px] border-2 border-brand bg-brand-50 p-5">
            {action === "resume" ? (
              <p className="text-[15.5px] text-ink2">น้องเริ่มทำชุดนี้ไว้แล้ว เวลายังเดินอยู่ กดทำต่อได้เลย คำตอบที่ตอบไว้ยังอยู่ครบ</p>
            ) : (
              <label className="flex cursor-pointer items-start gap-3 text-[15.5px]">
                <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} className="mt-1 size-5 shrink-0 accent-brand" />
                อ่านคำชี้แจงครบแล้ว พร้อมเริ่มจับเวลา
              </label>
            )}
            <div className="flex flex-wrap gap-2.5">
              <Button href="/exam" kind="ghost" icon="arrow_back">ยังไม่พร้อม</Button>
              <Button
                kind={action === "resume" ? "primary" : "brand"}
                icon="play_arrow"
                disabled={action === "start" && !agreed}
                onClick={() => setStarted(true)}
              >
                {action === "resume" ? "ทำต่อ" : "เริ่มทำข้อสอบ (เริ่มจับเวลา)"}
              </Button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
