"use client";
import { TimeReview } from "@/components/time-review";
import { useEffect, useState } from "react";
import {
  Button,
  Card,
  Field,
  Note,
  PageHeader,
  inputClass,
} from "@/components/ui";
import { useAdmin, errorMessage } from "@/lib/admin";
import type { Pack } from "@/lib/types";
type Metric = "score" | "rank" | "mean" | "sd" | "z" | "percentile";
const labels: Record<Metric, string> = {
  score: "คะแนน",
  rank: "อันดับ",
  mean: "เฉลี่ย",
  sd: "SD",
  z: "Z-score",
  percentile: "เปอร์เซ็นไทล์",
};
type Row = {
  userId: string;
  attemptId: string;
  name: string;
  email: string;
  activeSeconds: number | null;
  flags: string[];
  reference: boolean;
  calculated: Record<Metric, number | null>;
  official: Record<Metric, number | null>;
  review: Metric[];
  overrides: Partial<Record<Metric, unknown>>;
};
type Snapshot = {
  nRank: number;
  nRef: number;
  mean: number | null;
  sd: number | null;
  policy: string;
  publishedFinal: boolean;
  visibility: Metric[];
  rows: Row[];
};
type Data = {
  version: number;
  versionId: string;
  snapshot: Snapshot;
  versions: {
    id: string;
    version: number;
    trigger: string;
    affectedCount: number;
    reason: string | null;
  }[];
};
const fmt = (v: number | null) =>
  v === null
    ? "N/A"
    : v.toLocaleString("th-TH", {
        maximumFractionDigits: 2,
        minimumFractionDigits: 2,
      });
export default function Page() {
  const { api, download } = useAdmin();
  const [timeAttempt,setTimeAttempt]=useState<string|null>(null);
  const [packs, setPacks] = useState<Pack[]>([]),
    [id, setId] = useState(""),
    [data, setData] = useState<Data | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [selected, setSelected] = useState<string[]>([]),
    [reason, setReason] = useState(""),
    [query, setQuery] = useState(""),
    [flag, setFlag] = useState(""),
    [layer, setLayer] = useState<"official" | "calculated">("official"),
    [plan, setPlan] = useState<{
      previewId: string;
      changes?: unknown;
      before?: unknown;
      after?: unknown;
      warnings?: string[];
    } | null>(null),
    [override, setOverride] = useState<{
      userId: string;
      metric: Metric;
      value: string;
    } | null>(null),
    [old, setOld] = useState<{
      id: string;
      snapshot: Snapshot;
      version: number;
    } | null>(null);
  useEffect(() => {
    api<{ packs: Pack[] }>("/admin/ranking")
      .then((r) => setPacks(r.packs))
      .catch((e) => setError(errorMessage(e)));
  }, [api]);
  async function load(packId = id) {
    if (!packId) return;
    setData(await api<Data>(`/admin/ranking/${packId}`));
    setPlan(null);
    setSelected([]);
  }
  useEffect(() => {
    let cancelled = false;
    if (id)
      api<Data>(`/admin/ranking/${id}`)
        .then((value) => {
          if (!cancelled) setData(value);
        })
        .catch((e) => {
          if (!cancelled) setError(errorMessage(e));
        });
    return () => {
      cancelled = true;
    };
  }, [api, id]);
  function selectPack(packId: string) {
    setData(null);
    setTimeAttempt(null);
    setPlan(null);
    setSelected([]);
    setOverride(null);
    setOld(null);
    setQuery("");
    setFlag("");
    setReason("");
    setError("");
    setId(packId);
  }
  async function run(fn: () => Promise<void>) {
    setBusy(true);
    setError("");
    try {
      await fn();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  const snapshot = data?.snapshot,
    rows =
      snapshot?.rows.filter(
        (r) =>
          (!query ||
            `${r.name} ${r.email} ${r.userId}`
              .toLowerCase()
              .includes(query.toLowerCase())) &&
          (!flag || r.flags.includes(flag)),
      ) ?? [];
  async function preview(included: boolean) {
    if (reason.trim().length < 3) throw new Error("ระบุเหตุผลก่อนแสดงตัวอย่าง");
    setPlan(
      await api(`/admin/ranking/${id}/preview`, {
        method: "POST",
        json: {
          changes: selected.map((userId) => ({ userId, included, reason })),
        },
      }),
    );
  }
  return (
    <>
      <PageHeader
        title="อันดับและสถิติ"
        sub="อันดับรวมผู้สอบทุกคน สถิติใช้กลุ่มอ้างอิงที่อนุมัติ ผลรับรองเก็บแยกจากคำตอบดิบ"
      />
      {error ? <Note tone="error">{error}</Note> : null}
      <Field id="pack" label="ชุดข้อสอบ">
        <select
          id="pack"
          disabled={busy}
          className={inputClass}
          value={id}
          onChange={(e) => {
            selectPack(e.target.value);
            setData(null);
            setPlan(null);
          }}
        >
          <option value="">เลือกชุดข้อสอบ</option>
          {packs.map((p) => (
            <option key={p.id} value={p.id}>
              {p.title}
            </option>
          ))}
        </select>
      </Field>
      {snapshot && data ? (
        <>
          <Card>
            <div className="flex flex-wrap gap-5 text-[16px]">
              <p>
                ผู้มีอันดับ <b>{snapshot.nRank}</b> คน
              </p>
              <p>
                กลุ่มอ้างอิง <b>{snapshot.nRef}</b> คน
              </p>
              <p>
                เฉลี่ย <b>{fmt(snapshot.mean)}</b>
              </p>
              <p>
                SD <b>{fmt(snapshot.sd)}</b>
              </p>
              <p>
                เวอร์ชัน {data.version} ·{" "}
                {snapshot.publishedFinal ? "ผลรับรอง" : "เบื้องต้น"}
              </p>
            </div>
            {snapshot.sd === 0 ? (
              <p className="mt-2 text-[14px] text-ink2">
                กลุ่มอ้างอิงมี SD=0 จึงแสดง Z-score=0.00
              </p>
            ) : null}
          </Card>
          <Card className="flex flex-col gap-4">
            <h2 className="text-[19px] font-semibold">นโยบายและการเปิดเผย</h2>
            <Field id="policy" label="เลือกครั้งสอบ">
              <select
                id="policy"
                className={inputClass}
                disabled={snapshot.publishedFinal}
                value={snapshot.policy}
                onChange={(e) =>
                  setData({
                    ...data,
                    snapshot: { ...snapshot, policy: e.target.value },
                  })
                }
              >
                <option value="best">คะแนนดีที่สุด → เวลาน้อยกว่า → เริ่มก่อน</option>
                <option value="first">ครั้งแรก</option>
                <option value="latest">ครั้งล่าสุด</option>
              </select>
            </Field>
            <div className="flex flex-wrap gap-4">
              {(Object.keys(labels) as Metric[]).map((m) => (
                <label key={m} className="flex min-h-[44px] items-center gap-2">
                  <input
                    type="checkbox"
                    checked={snapshot.visibility.includes(m)}
                    onChange={(e) =>
                      setData({
                        ...data,
                        snapshot: {
                          ...snapshot,
                          visibility: e.target.checked
                            ? [...snapshot.visibility, m]
                            : snapshot.visibility.filter((x) => x !== m),
                        },
                      })
                    }
                  />
                  {labels[m]}
                </label>
              ))}
            </div>
            <label className="flex min-h-[44px] items-center gap-2">
              <input
                type="checkbox"
                checked={snapshot.publishedFinal}
                onChange={(e) =>
                  setData({
                    ...data,
                    snapshot: { ...snapshot, publishedFinal: e.target.checked },
                  })
                }
              />
              เผยแพร่เป็นผลรับรอง (ค่าอัตโนมัติอัปเดตเมื่อข้อมูลเปลี่ยน)
            </label>
            <Field id="reason" label="เหตุผลสำหรับการเปลี่ยนแปลง">
              <input
                id="reason"
                className={inputClass}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                maxLength={500}
              />
            </Field>
            <Button
              disabled={busy || reason.trim().length < 3}
              onClick={() =>
                void run(async () => {
                  await api(`/admin/ranking/${id}/settings`, {
                    method: "PUT",
                    json: {
                      policy: snapshot.policy,
                      visibility: snapshot.visibility,
                      publishedFinal: snapshot.publishedFinal,
                      suspiciousSeconds: 30,
                      reason,
                      baseVersion: data.version,
                    },
                  });
                  await load();
                })
              }
            >
              บันทึกนโยบายและการเผยแพร่
            </Button>
          </Card>
          <div className="flex flex-wrap gap-3">
            <input
              aria-label="ค้นหาผู้สอบ"
              className={`${inputClass} flex-1`}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="ชื่อ อีเมล หรือรหัสผู้ใช้"
            />
            <select
              aria-label="กรองธงตรวจสอบ"
              className={inputClass}
              value={flag}
              onChange={(e) => setFlag(e.target.value)}
            >
              <option value="">ทุกสถานะ</option>
              <option value="unverified_time">เวลารอการตรวจรับ</option>
              <option value="short_duration">เวลาสั้นผิดปกติ</option>
              <option value="test_account">บัญชีทดสอบ</option>
            </select>
            <select
              aria-label="ชั้นข้อมูล"
              className={inputClass}
              value={layer}
              onChange={(e) => setLayer(e.target.value as typeof layer)}
            >
              <option value="official">ผลรับรอง</option>
              <option value="calculated">ค่าคำนวณ</option>
            </select>
            <Button
              kind="ghost"
              onClick={() =>
                void run(() => download(`/admin/ranking/${id}/export`))
              }
            >
              ส่งออก CSV
            </Button>
          </div>
          <div className="overflow-x-auto rounded-[16px] border border-border">
            <table className="w-full text-[14px]">
              <thead>
                <tr className="bg-card">
                  <th className="p-3">
                    <input
                      aria-label="เลือกผู้สอบที่แสดงทั้งหมด"
                      type="checkbox"
                      checked={
                        !!rows.length &&
                        rows.every((r) => selected.includes(r.userId))
                      }
                      onChange={(e) =>
                        setSelected(
                          e.target.checked ? rows.map((r) => r.userId) : [],
                        )
                      }
                    />
                  </th>
                  <th className="p-3 text-left">ผู้สอบ / ธงตรวจสอบ</th>
                  {(Object.keys(labels) as Metric[]).map((m) => (
                    <th key={m} className="p-3">
                      {labels[m]}
                    </th>
                  ))}
                  <th className="p-3">กลุ่มอ้างอิง</th>
                  <th className="p-3">การจัดการ</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.userId} className="border-t border-border bg-card">
                    <td className="p-3">
                      <input
                        aria-label={`เลือก ${r.name}`}
                        type="checkbox"
                        checked={selected.includes(r.userId)}
                        onChange={(e) =>
                          setSelected(
                            e.target.checked
                              ? [...selected, r.userId]
                              : selected.filter((x) => x !== r.userId),
                          )
                        }
                      />
                    </td>
                    <td className="min-w-[210px] p-3">
                      <p>{r.name || r.userId}</p>
                      <p className="text-ink2">{r.email}</p>
                      <p className="text-[13px] text-amber-ink">
                        {r.flags.join(" · ")}
                      </p>
                      <p className="text-ink2">
                        เวลาตรวจรับ {r.activeSeconds ?? "รอตรวจ"} วินาที
                      </p>
                      {r.review.length ? (
                        <p className="text-red">
                          ผลรับรองรอทบทวน:{" "}
                          {r.review.map((m) => labels[m]).join(", ")}
                        </p>
                      ) : null}
                    </td>
                    {(Object.keys(labels) as Metric[]).map((m) => (
                      <td key={m} className="p-3 text-right tabular-nums">
                        {fmt(r[layer][m])}
                        {r.overrides[m] ? " *" : ""}
                      </td>
                    ))}
                    <td className="p-3">{r.reference ? "รวม" : "ไม่รวม"}</td>
                    <td className="p-3">
                      <Button
                        kind="ghost"
                        onClick={() =>
                          setOverride({
                            userId: r.userId,
                            metric: "percentile",
                            value: String(r.official.percentile ?? 0),
                          })
                        }
                      >
                        รับรองค่าเอง
                      </Button>
                      <Button
                        kind="ghost"
                        disabled={
                          !Object.keys(r.overrides).length ||
                          reason.trim().length < 3
                        }
                        onClick={() =>
                          void run(async () =>
                            setPlan(
                              await api(`/admin/ranking/${id}/preview`, {
                                method: "POST",
                                json: {
                                  changes: [
                                    {
                                      userId: r.userId,
                                      clearMetrics: Object.keys(r.overrides),
                                      reason,
                                    },
                                  ],
                                },
                              }),
                            ),
                          )
                        }
                      >
                        คืนค่าคำนวณ
                      </Button>
                      <Button
                        kind="ghost"
                        onClick={()=>setTimeAttempt(r.attemptId)}
                      >
                        ตรวจรับเวลา
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              disabled={busy || !selected.length || reason.trim().length < 3}
              onClick={() => void run(() => preview(false))}
            >
              ตัวอย่างคัดออกจากสถิติ ({selected.length})
            </Button>
            <Button
              kind="ghost"
              disabled={busy || !selected.length || reason.trim().length < 3}
              onClick={() => void run(() => preview(true))}
            >
              ตัวอย่างรวมเข้ากลุ่ม
            </Button>
            <label className="flex min-h-[44px] cursor-pointer items-center rounded-[12px] border border-border px-4">
              นำเข้า XLSX/CSV
              <input
                type="file"
                accept=".csv,.xlsx"
                className="ml-3 max-w-[220px]"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f)
                    void run(async () => {
                      const form = new FormData();
                      form.set("file", f);
                      setPlan(
                        await api(`/admin/ranking/${id}/import`, {
                          method: "POST",
                          body: form,
                        }),
                      );
                    });
                }}
              />
            </label>
          </div>
          {timeAttempt ? <TimeReview key={`${id}:${timeAttempt}`} packId={id} attemptId={timeAttempt} onClose={()=>setTimeAttempt(null)} onSaved={load}/> : null}
          {override ? (
            <Card className="flex flex-col gap-3">
              <h2 className="text-[19px] font-semibold">
                รับรองค่าแยกจากผลคำนวณ
              </h2>
              <select
                aria-label="ตัวชี้วัด"
                className={inputClass}
                value={override.metric}
                onChange={(e) =>
                  setOverride({ ...override, metric: e.target.value as Metric })
                }
              >
                {(Object.keys(labels) as Metric[]).map((m) => (
                  <option key={m} value={m}>
                    {labels[m]}
                  </option>
                ))}
              </select>
              <input
                aria-label="ค่ารับรอง"
                type="number"
                step="any"
                className={inputClass}
                value={override.value}
                onChange={(e) =>
                  setOverride({ ...override, value: e.target.value })
                }
              />
              <Button
                disabled={busy || reason.trim().length < 3}
                onClick={() =>
                  void run(async () => {
                    setPlan(
                      await api(`/admin/ranking/${id}/preview`, {
                        method: "POST",
                        json: {
                          changes: [
                            {
                              userId: override.userId,
                              metrics: {
                                [override.metric]: Number(override.value),
                              },
                              reason,
                            },
                          ],
                        },
                      }),
                    );
                    setOverride(null);
                  })
                }
              >
                แสดงตัวอย่าง
              </Button>
              <Button kind="ghost" onClick={() => setOverride(null)}>
                ยกเลิก
              </Button>
            </Card>
          ) : null}
          {plan ? (
            <Card className="flex flex-col gap-3">
              <h2 className="text-[19px] font-semibold">ตรวจผลกระทบก่อนยืนยัน</h2>
              <p>
                ก่อน: {JSON.stringify(plan.before)} · หลัง:{" "}
                {JSON.stringify(plan.after)}
              </p>
              {plan.warnings?.map((w) => (
                <p key={w} className="text-amber-ink">
                  {w}
                </p>
              ))}
              <details>
                <summary className="cursor-pointer">ดูรายการเปลี่ยนแปลง</summary>
                <pre className="max-h-[300px] overflow-auto whitespace-pre-wrap text-[14px]">
                  {JSON.stringify(plan.changes, null, 2)}
                </pre>
              </details>
              <Button
                disabled={busy}
                onClick={() =>
                  void run(async () => {
                    await api(`/admin/ranking/${id}/commit`, {
                      method: "POST",
                      json: { previewId: plan.previewId },
                    });
                    await load();
                  })
                }
              >
                ยืนยันรายการที่ตรวจแล้ว
              </Button>
              <Button kind="ghost" onClick={() => setPlan(null)}>
                ยกเลิก
              </Button>
            </Card>
          ) : null}
          <Card className="flex flex-col gap-3">
            <h2 className="text-[19px] font-semibold">ประวัติผลรับรอง</h2>
            {data.versions.map((v) => (
              <div key={v.id} className="flex flex-wrap items-center gap-3">
                <span>
                  v{v.version} · {v.trigger} · กระทบ {v.affectedCount} ราย
                </span>
                <Button
                  kind="ghost"
                  onClick={() =>
                    void run(async () => {
                      const r = await api<{
                        version: {
                          id: string;
                          version: number;
                          snapshot: Snapshot;
                        };
                      }>(`/admin/ranking/${id}/versions/${v.id}`);
                      setOld(r.version);
                    })
                  }
                >
                  ดูเวอร์ชันนี้
                </Button>
              </div>
            ))}
            {old ? (
              <div className="flex flex-col gap-3 border-t border-border pt-4">
                <p>
                  จะย้อนผลรับรองเป็น v{old.version} · {old.snapshot.nRank} คน ·
                  เฉลี่ย {fmt(old.snapshot.mean)}
                </p>
                <Button
                  kind="danger"
                  disabled={busy || reason.trim().length < 3}
                  onClick={() =>
                    void run(async () => {
                      await api(`/admin/ranking/${id}/rollback`, {
                        method: "POST",
                        json: {
                          versionId: old.id,
                          baseVersion: data.version,
                          reason,
                        },
                      });
                      setOld(null);
                      await load();
                    })
                  }
                >
                  ยืนยันย้อนเวอร์ชัน โดยเก็บประวัติทั้งหมด
                </Button>
              </div>
            ) : null}
          </Card>
        </>
      ) : null}
    </>
  );
}
