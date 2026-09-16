"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { DailyBars } from "@/components/bar-chart";
import { Button, Card, Empty, Icon, Note, PageHeader, Spinner, Tag } from "@/components/ui";
import { errorMessage, useAdmin } from "@/lib/admin";
import { formatBaht, formatNumber, formatThaiDateTime } from "@/lib/format";
import type { ExamSettings, Stats } from "@/lib/types";

const ORDER_TONE = { pending: "amber", paid: "green", failed: "red", refunded: "neutral" } as const;
const ORDER_LABEL = { pending: "รอชำระ", paid: "ชำระแล้ว", failed: "ไม่สำเร็จ", refunded: "คืนเงิน" } as const;

export function Dashboard() {
  const { api } = useAdmin();
  const [stats, setStats] = useState<Stats | null>(null);
  const [settings, setSettings] = useState<ExamSettings | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    Promise.all([api<Stats>("/admin/stats"), api<ExamSettings>("/settings/exam")])
      .then(([s, e]) => {
        if (cancelled) return;
        setStats(s);
        setSettings(e);
        setError(null);
      })
      .catch((e) => !cancelled && setError(errorMessage(e)));
    return () => {
      cancelled = true;
    };
  }, [api, tick]);

  return (
    <>
      <PageHeader
        title="ภาพรวมการใช้งาน"
        sub={stats ? `อัปเดต ${formatThaiDateTime(stats.generatedAt)}` : undefined}
        actions={
          <Button kind="ghost" icon="refresh" onClick={() => setTick((t) => t + 1)}>
            รีเฟรช
          </Button>
        }
      />
      {error ? <Note tone="error">{error}</Note> : null}
      {!stats && !error ? <Spinner /> : null}
      {stats ? (
        <>
          <section className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4" aria-label="ตัวเลขรวม">
            <Stat icon="group" tone="bg-brand-50 text-brand" value={formatNumber(stats.totals.users)} label="ผู้ใช้ทั้งหมด" />
            <Stat icon="payments" tone="bg-green-50 text-green" value={formatBaht(stats.totals.revenueSatang)} label={`รายได้ (ชำระแล้ว ${stats.totals.paidOrders} รายการ)`} />
            <Stat icon="play_circle" tone="bg-accent-50 text-accent-dark" value={formatNumber(stats.totals.attempts)} label={`เริ่มทำข้อสอบ · ส่งแล้ว ${stats.totals.submittedAttempts}`} />
            <Stat
              icon="insights"
              tone="bg-teal-50 text-teal"
              value={stats.totals.avgScore === null ? "—" : `${stats.totals.avgScore.toFixed(1)}`}
              label="คะแนนเฉลี่ย (ชุดที่ส่งแล้ว)"
            />
            <Stat icon="verified" tone="bg-mystic-50 text-mystic" value={formatNumber(stats.totals.activeEntitlements)} label="สิทธิ์ที่ใช้งานได้" />
            <Stat icon="receipt_long" tone="bg-amber-50 text-amber-icon" value={formatNumber(stats.ordersByStatus.pending ?? 0)} label="คำสั่งซื้อรอชำระ" />
            <Stat icon="quiz" tone="bg-brand-50 text-brand" value={`${formatNumber(stats.totals.activeQuestions)} / ${formatNumber(stats.totals.questions)}`} label="ข้อสอบพร้อมใช้ / ทั้งหมด" />
            <Stat
              icon="event"
              tone={settings?.status === "urgent" ? "bg-accent-50 text-accent-dark" : "bg-page text-ink2"}
              value={settings ? (settings.status === "passed" ? "ถึงวันสอบแล้ว" : `${settings.daysLeft} วัน`) : "—"}
              label="เหลือถึงวันสอบ"
            />
          </section>

          <section className="grid grid-cols-1 gap-4 lg:grid-cols-3" aria-label="แนวโน้มรายวัน">
            <Card>
              <DailyBars title="สมัครใหม่" data={stats.series.signups} unit="คน" />
            </Card>
            <Card>
              <DailyBars title="เริ่มทำข้อสอบ" data={stats.series.attempts} unit="ครั้ง" />
            </Card>
            <Card>
              <DailyBars title="ชำระเงินสำเร็จ" data={stats.series.paidOrders} unit="รายการ" />
            </Card>
          </section>

          <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Card className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <h2 className="text-[17px] font-semibold">ชุดข้อสอบ</h2>
                <Link href="/packs/" className="text-[14px] font-medium text-brand">
                  จัดการชุด
                </Link>
              </div>
              {stats.packs.length === 0 ? (
                <Empty icon="inventory_2">ยังไม่มีชุดข้อสอบ</Empty>
              ) : (
                <ul className="flex flex-col divide-y divide-border">
                  {stats.packs.map((p) => {
                    const full = p.assigned >= p.questionCount;
                    return (
                      <li key={p.id} className="flex items-center justify-between gap-3 py-2.5">
                        <div className="min-w-0">
                          <p className="truncate text-[15px] font-medium">{p.title}</p>
                          <p className="text-[13px] text-ink3">{p.slug}</p>
                        </div>
                        <Tag tone={full ? "green" : p.assigned === 0 ? "red" : "amber"}>
                          {p.assigned} / {p.questionCount} ข้อ
                        </Tag>
                      </li>
                    );
                  })}
                </ul>
              )}
            </Card>
            <Card className="flex flex-col gap-3">
              <h2 className="text-[17px] font-semibold">คำสั่งซื้อล่าสุด</h2>
              {stats.recentOrders.length === 0 ? (
                <Empty icon="receipt_long">ยังไม่มีคำสั่งซื้อ</Empty>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[420px] text-[14.5px]">
                    <thead className="text-left text-[13px] text-ink3">
                      <tr>
                        <th className="pb-2 font-medium">นักเรียน</th>
                        <th className="pb-2 font-medium">สินค้า</th>
                        <th className="pb-2 text-right font-medium">ยอด</th>
                        <th className="pb-2 font-medium">สถานะ</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {stats.recentOrders.map((o) => (
                        <tr key={o.id}>
                          <td className="py-2 pr-3">
                            <p className="font-medium">{o.studentName ?? "—"}</p>
                            <p className="text-[12.5px] text-ink3">{formatThaiDateTime(o.createdAt)}</p>
                          </td>
                          <td className="py-2 pr-3 text-ink2">{o.productTitle}</td>
                          <td className="tabular py-2 pr-3 text-right">{formatBaht(o.amountSatang)}</td>
                          <td className="py-2">
                            <Tag tone={ORDER_TONE[o.status]}>{ORDER_LABEL[o.status]}</Tag>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          </section>
        </>
      ) : null}
    </>
  );
}

function Stat({ icon, tone, value, label }: { icon: string; tone: string; value: string; label: string }) {
  return (
    <Card className="flex items-start gap-3 !p-4">
      <span className={`grid size-10 shrink-0 place-items-center rounded-[12px] ${tone}`}>
        <Icon name={icon} fill />
      </span>
      <div className="min-w-0">
        <p className="tabular font-display text-[22px] font-semibold leading-[1.3]">{value}</p>
        <p className="text-[13px] text-ink3">{label}</p>
      </div>
    </Card>
  );
}
