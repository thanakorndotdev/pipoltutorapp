"use client";
import { useState } from "react";
import { Button, Card, Note, PageHeader, inputClass } from "@/components/ui";
import { useAdmin, errorMessage } from "@/lib/admin";
type Log = {
  id: string;
  actorId?: string | null;
  actorKind?: string;
  revisionId?: string | null;
  sourceId?: string | null;
  result?: string;
  action?: string;
  module: string;
  targetId?: string | null;
  reason?: string | null;
  requestId?: string | null;
  createdAt: string;
  message?: string;
  before?: unknown;
  after?: unknown;
};
type Policy = {
  category: string;
  days: number | null;
  version: number;
  approvedAt: string | null;
};
export default function Page() {
  const { api } = useAdmin();
  const [logs, setLogs] = useState<Log[]>([]),
    [policies, setPolicies] = useState<Policy[]>([]),
    [module, setModule] = useState(""),
    [error, setError] = useState(""),
    [reason, setReason] = useState("");
  async function run(fn: () => Promise<void>) {
    setError("");
    try {
      await fn();
    } catch (e) {
      setError(errorMessage(e));
    }
  }
  return (
    <>
      <PageHeader
        title="ประวัติ ข้อผิดพลาด และระยะเก็บข้อมูล"
        sub="บันทึกผู้เปลี่ยนข้อมูล เหตุผล และเวอร์ชัน การอนุมัติระยะเก็บข้อมูลเป็นสิทธิ์ Owner"
      />
      {error ? <Note tone="error">{error}</Note> : null}
      <div className="flex flex-wrap gap-3">
        <input
          aria-label="กรองโมดูล"
          className={`${inputClass} flex-1`}
          value={module}
          onChange={(e) => setModule(e.target.value)}
          placeholder="โมดูล เช่น ranking, daily, article"
        />
        <Button
          onClick={() =>
            void run(async () =>
              setLogs(
                (
                  await api<{ logs: Log[] }>(
                    `/admin/audit?module=${encodeURIComponent(module)}`,
                  )
                ).logs,
              ),
            )
          }
        >
          ดูประวัติ
        </Button>
        <Button
          kind="ghost"
          onClick={() =>
            void run(async () =>
              setLogs((await api<{ errors: Log[] }>("/admin/errors")).errors),
            )
          }
        >
          ข้อผิดพลาด
        </Button>
        <Button
          kind="ghost"
          onClick={() =>
            void run(async () =>
              setPolicies(
                (await api<{ policies: Policy[] }>("/admin/retention"))
                  .policies,
              ),
            )
          }
        >
          ระยะเก็บข้อมูล
        </Button>
      </div>
      {logs.map((l) => (
        <Card key={l.id}>
          <p className="font-semibold">{l.action ?? l.message}</p>
          <p className="text-[14px] text-ink2">
            {l.module} · {new Date(l.createdAt).toLocaleString("th-TH")} ·{" "}
            {l.reason ?? ""}
          </p>
          <p className="break-all text-[14px]">
            ผู้กระทำ{" "}
            {l.actorId ??
              (l.actorKind === "system"
                ? "ระบบอัตโนมัติ"
                : l.actorKind === "api-key"
                  ? "ผู้ดูแลผ่าน API key"
                  : (l.actorKind ?? "—"))}{" "}
            · ผล {l.result ?? "—"}
          </p>
          <p className="break-all text-[14px]">
            เวอร์ชัน {l.revisionId ?? "—"} · แหล่งรายการ {l.sourceId ?? "—"}
          </p>
          <p className="break-all text-[14px]">
            รหัสคำขอ {l.requestId ?? "—"} · เป้าหมาย {l.targetId ?? "—"}
          </p>
          {l.before || l.after ? (
            <details>
              <summary className="min-h-[44px] cursor-pointer pt-2">
                ข้อมูลก่อนและหลัง
              </summary>
              <pre className="max-h-[300px] overflow-auto whitespace-pre-wrap text-[14px]">
                {JSON.stringify({ before: l.before, after: l.after }, null, 2)}
              </pre>
            </details>
          ) : null}
        </Card>
      ))}
      {policies.length ? (
        <Card className="flex flex-col gap-4">
          <h2 className="text-[20px] font-semibold">
            ระยะเก็บข้อมูลที่เสนอให้ Owner อนุมัติ
          </h2>
          <p className="text-[14px] text-ink2">
            เมื่ออนุมัติแล้ว ระบบลบ technical_logs (error log) และ
            learning_events (ยอดเข้าชม/คลิกบทความ) ที่เก่ากว่าจำนวนวันอัตโนมัติทุกชั่วโมง
            และบันทึกจำนวนที่ลบใน Audit เว้นว่างหมายถึงเก็บต่อ หมวดอื่นมีข้อมูลเชื่อมโยง
            (ผลสอบ เกียรติบัตร audit) ระบบบันทึกนโยบายไว้แต่ไม่ลบเอง ต้องใช้แผน lifecycle
            และทดสอบกู้คืนก่อน
          </p>
          <input
            aria-label="เหตุผลอนุมัติ"
            className={inputClass}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="เหตุผล"
          />
          {policies.map((p) => (
            <div key={p.category} className="flex flex-wrap items-center gap-3">
              <label className="flex min-h-[44px] items-center gap-3">
                {p.category}
                <input
                  aria-label={`จำนวนวัน ${p.category}`}
                  type="number"
                  min={1}
                  max={3650}
                  className={`${inputClass} max-w-[130px]`}
                  value={p.days ?? ""}
                  onChange={(e) =>
                    setPolicies(
                      policies.map((x) =>
                        x.category === p.category
                          ? {
                              ...x,
                              days: e.target.value
                                ? Number(e.target.value)
                                : null,
                            }
                          : x,
                      ),
                    )
                  }
                />
              </label>
              <span className="text-[14px]">
                {p.approvedAt ? "อนุมัติแล้ว" : "รออนุมัติ"}
                {["technical_logs", "learning_events"].includes(p.category)
                  ? " · ลบอัตโนมัติเมื่ออนุมัติ"
                  : " · บันทึกนโยบาย ไม่ลบเอง"}
              </span>
              <Button
                disabled={reason.trim().length < 3}
                onClick={() =>
                  void run(async () => {
                    await api(`/admin/retention/${p.category}`, {
                      method: "PUT",
                      json: { days: p.days, baseVersion: p.version, reason },
                    });
                    setPolicies(
                      (await api<{ policies: Policy[] }>("/admin/retention"))
                        .policies,
                    );
                  })
                }
              >
                อนุมัติ
              </Button>
            </div>
          ))}
        </Card>
      ) : null}
    </>
  );
}
