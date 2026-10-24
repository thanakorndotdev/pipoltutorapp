"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { Button, Card, Empty, Modal, Note, PageHeader, Spinner, Tag, inputClass } from "@/components/ui";
import { errorMessage, useAdmin } from "@/lib/admin";
import { formatThaiDateTime } from "@/lib/format";
import {
  ATTEMPT_STATUS,
  CAMPUS_LABEL,
  fmtPoints,
  typeMeta,
  type AdminAttempt,
  type AttemptDetail,
  type Pack,
  type RegradeResult,
} from "@/lib/types";

const fullName = (a: Pick<AdminAttempt, "firstName" | "lastName">) => [a.firstName, a.lastName].filter(Boolean).join(" ") || "—";

function used(a: AdminAttempt): string {
  if (!a.submittedAt) return "—";
  const s = Math.round((new Date(a.submittedAt).getTime() - new Date(a.startedAt).getTime()) / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/**
 * Per-pack results: every attempt with the profile snapshot taken at start,
 * one student's answers on demand, quota reset, regrade with preview, and
 * the three CSV exports.
 */
export function Results() {
  const { api, download } = useAdmin();
  const router = useRouter();
  const packId = useSearchParams().get("pack") ?? "";
  const [packs, setPacks] = useState<Pack[] | null>(null);
  // Keyed by pack so switching packs shows the spinner instead of the old table.
  const [loaded, setLoaded] = useState<{ packId: string; rows: AdminAttempt[] } | null>(null);
  const rows = loaded?.packId === packId ? loaded.rows : null;
  const [q, setQ] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [detail, setDetail] = useState<AttemptDetail | null>(null);
  const [resetFor, setResetFor] = useState<AdminAttempt | null>(null);
  const [regrade, setRegrade] = useState<RegradeResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    api<{ packs: Pack[] }>("/admin/packs")
      .then((r) => !cancelled && setPacks(r.packs))
      .catch((e) => !cancelled && setError(errorMessage(e)));
    return () => {
      cancelled = true;
    };
  }, [api]);

  useEffect(() => {
    if (!packId) return;
    let cancelled = false;
    api<{ attempts: AdminAttempt[] }>(`/admin/packs/${packId}/attempts`)
      .then((r) => {
        if (cancelled) return;
        setLoaded({ packId, rows: r.attempts });
        setError(null);
      })
      .catch((e) => !cancelled && setError(errorMessage(e)));
    return () => {
      cancelled = true;
    };
  }, [api, packId, tick]);

  const pack = packs?.find((p) => p.id === packId) ?? null;
  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!rows || !needle) return rows ?? [];
    return rows.filter((a) =>
      [a.firstName, a.lastName, a.nickname, a.email, a.campus ? CAMPUS_LABEL[a.campus] : ""].some((v) => v?.toLowerCase().includes(needle))
    );
  }, [rows, q]);
  const finished = rows?.filter((a) => a.status !== "in_progress") ?? [];
  const avg = finished.length ? finished.reduce((s, a) => s + (a.score ?? 0), 0) / finished.length : null;

  async function openDetail(a: AdminAttempt) {
    try {
      setDetail(await api<AttemptDetail>(`/admin/attempts/${a.id}`));
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  async function doReset() {
    if (!resetFor) return;
    setBusy(true);
    try {
      const r = await api<{ reset: number }>(`/admin/packs/${packId}/reset`, { method: "POST", json: { userId: resetFor.userId } });
      setNotice(`รีเซ็ตสิทธิ์ ${fullName(resetFor)} แล้ว (${r.reset} ครั้งไม่นับสิทธิ์) — ทำใหม่ได้ ประวัติเดิมยังอยู่`);
      setResetFor(null);
      setTick((t) => t + 1);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  async function runRegrade(apply: boolean) {
    setBusy(true);
    try {
      const r = await api<RegradeResult>(`/admin/packs/${packId}/regrade`, { method: "POST", json: { apply } });
      if (apply) {
        setRegrade(null);
        setNotice(`ตรวจใหม่แล้ว ${r.checked} ครั้ง คะแนนเปลี่ยน ${r.changes.length} ครั้ง (เก็บคะแนนเดิมไว้ในประวัติ)`);
        setTick((t) => t + 1);
      } else setRegrade(r);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  async function exportCsv(format: "summary" | "wide" | "long") {
    try {
      await download(`/admin/packs/${packId}/export?format=${format}`);
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  const byId = new Map(rows?.map((a) => [a.id, a]) ?? []);

  return (
    <>
      <PageHeader
        title="ผลสอบ"
        sub="คะแนนและคำตอบรายบุคคล ข้อมูลนักเรียนเป็นข้อมูล ณ วันที่เริ่มสอบ"
        actions={
          <select
            aria-label="เลือกชุดข้อสอบ"
            className={`${inputClass} min-w-[240px]`}
            value={packId}
            onChange={(e) => {
              setNotice(null);
              router.push(`/results/?pack=${e.target.value}`);
            }}
          >
            <option value="" disabled>
              เลือกชุดข้อสอบ
            </option>
            {packs?.map((p) => (
              <option key={p.id} value={p.id}>
                {p.title}
              </option>
            ))}
          </select>
        }
      />
      {error ? <Note tone="error">{error}</Note> : null}
      {notice ? <Note tone="ok">{notice}</Note> : null}
      {!packId ? <Empty icon="leaderboard">เลือกชุดข้อสอบด้านบนเพื่อดูผล</Empty> : null}
      {packId && rows === null && !error ? <Spinner /> : null}

      {packId && rows ? (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Card className="flex flex-col gap-1">
              <span className="text-[13px] text-ink3">ทำทั้งหมด</span>
              <span className="tabular text-[22px] font-semibold">{rows.length} ครั้ง</span>
            </Card>
            <Card className="flex flex-col gap-1">
              <span className="text-[13px] text-ink3">ส่งแล้ว</span>
              <span className="tabular text-[22px] font-semibold">{finished.length}</span>
            </Card>
            <Card className="flex flex-col gap-1">
              <span className="text-[13px] text-ink3">คะแนนเฉลี่ย</span>
              <span className="tabular text-[22px] font-semibold">{avg === null ? "—" : fmtPoints(Math.round(avg * 100) / 100)}</span>
            </Card>
            <Card className="flex flex-col gap-1">
              <span className="text-[13px] text-ink3">คะแนนเต็ม</span>
              <span className="tabular text-[22px] font-semibold">{fmtPoints(pack?.totalPoints ?? 0)}</span>
            </Card>
          </div>

          <Card className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[14px] font-medium">Export CSV</span>
              <Button kind="ghost" size="sm" icon="download" onClick={() => exportCsv("summary")} title="หนึ่งแถวต่อการทำข้อสอบ">
                สรุปรายครั้ง
              </Button>
              <Button kind="ghost" size="sm" icon="table_view" onClick={() => exportCsv("wide")} title="หนึ่งแถวต่อครั้ง คำตอบและคะแนนรายข้อเป็นคอลัมน์">
                Wide (รายข้อเป็นคอลัมน์)
              </Button>
              <Button kind="ghost" size="sm" icon="table_rows" onClick={() => exportCsv("long")} title="หนึ่งแถวต่อคำตอบ">
                Long (หนึ่งแถวต่อคำตอบ)
              </Button>
              <Button kind="primary" size="sm" icon="published_with_changes" className="ml-auto" disabled={busy} onClick={() => runRegrade(false)}>
                ตรวจใหม่ (ดูผลก่อน)
              </Button>
            </div>
            <p className="text-[13px] text-ink3">
              ทุกไฟล์มีเวลาเริ่ม เวลาส่ง ชื่อ นามสกุล ชื่อเล่น จภ. และอีเมล เปิดใน Excel ได้ภาษาไทยไม่เพี้ยน · “ตรวจใหม่” ใช้หลังแก้เฉลย/คะแนนในคลังข้อสอบ
            </p>
          </Card>

          <input type="search" className={inputClass} placeholder="ค้นหาชื่อ ชื่อเล่น อีเมล หรือ จภ." value={q} onChange={(e) => setQ(e.target.value)} aria-label="ค้นหานักเรียน" />

          {shown.length === 0 ? (
            <Empty icon="person_search">{rows.length === 0 ? "ยังไม่มีใครทำชุดนี้" : "ไม่พบนักเรียนที่ค้นหา"}</Empty>
          ) : (
            <div className="overflow-x-auto rounded-[20px] border border-border bg-card shadow-s">
              <table className="w-full min-w-[960px] text-left text-[14px]">
                <thead className="border-b border-border bg-page text-[13px] text-ink3">
                  <tr>
                    <th className="px-3 py-2.5 font-medium">นักเรียน</th>
                    <th className="px-3 py-2.5 font-medium">จภ.</th>
                    <th className="px-3 py-2.5 font-medium">ครั้งที่</th>
                    <th className="px-3 py-2.5 font-medium">เริ่ม</th>
                    <th className="px-3 py-2.5 font-medium">ส่ง</th>
                    <th className="px-3 py-2.5 font-medium">ใช้เวลา</th>
                    <th className="px-3 py-2.5 font-medium">สถานะ</th>
                    <th className="px-3 py-2.5 text-right font-medium">คะแนน</th>
                    <th className="px-3 py-2.5" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {shown.map((a) => (
                    <tr key={a.id} className={a.resetAt ? "text-ink3" : ""}>
                      <td className="px-3 py-2.5">
                        <p className="font-medium text-ink">
                          {fullName(a)} {a.nickname ? <span className="font-normal text-ink3">({a.nickname})</span> : null}
                        </p>
                        <p className="text-[12.5px] text-ink3">{a.email}</p>
                      </td>
                      <td className="px-3 py-2.5">{a.campus ? (CAMPUS_LABEL[a.campus] ?? a.campus) : "—"}</td>
                      <td className="tabular px-3 py-2.5">
                        {a.attemptNo}
                        {a.resetAt ? <span className="ml-1 text-[12px]">(รีเซ็ตแล้ว)</span> : null}
                      </td>
                      <td className="tabular px-3 py-2.5">{formatThaiDateTime(a.startedAt)}</td>
                      <td className="tabular px-3 py-2.5">{a.submittedAt ? formatThaiDateTime(a.submittedAt) : "—"}</td>
                      <td className="tabular px-3 py-2.5">{used(a)}</td>
                      <td className="px-3 py-2.5">
                        <Tag tone={ATTEMPT_STATUS[a.status].tone}>{ATTEMPT_STATUS[a.status].label}</Tag>
                      </td>
                      <td className="tabular px-3 py-2.5 text-right font-semibold">
                        {a.score === null ? "—" : `${fmtPoints(a.score)}/${fmtPoints(a.maxScore)}`}
                        {a.scoreHistory?.length ? <p className="text-[11.5px] font-normal text-ink3">เดิม {fmtPoints(a.scoreHistory[0].score)}</p> : null}
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="flex justify-end gap-1.5">
                          <Button kind="ghost" size="sm" icon="visibility" onClick={() => openDetail(a)}>
                            คำตอบ
                          </Button>
                          {!a.resetAt ? (
                            <Button kind="subtle" size="sm" icon="restart_alt" title="ให้ทำใหม่ได้" onClick={() => setResetFor(a)}>
                              รีเซ็ต
                            </Button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      ) : null}

      {detail ? (
        <Modal wide title={`${fullName(detail.attempt)} · ${detail.attempt.pack.title} ครั้งที่ ${detail.attempt.attemptNo}`} onClose={() => setDetail(null)}>
          <div className="flex flex-col gap-3">
            <p className="text-[14px] text-ink2">
              {detail.attempt.email} · {detail.attempt.campus ? CAMPUS_LABEL[detail.attempt.campus] : "—"} · คะแนน{" "}
              <b>
                {fmtPoints(detail.attempt.score)}/{fmtPoints(detail.attempt.maxScore)}
              </b>
            </p>
            <ol className="flex flex-col gap-2">
              {detail.questions.map((x) => {
                const given = x.type === "short" ? x.textAnswer : x.selectedChoices.join(", ");
                const key = x.type === "short" ? x.acceptedAnswers.join(" / ") : x.correctChoices.join(", ");
                const full = x.pointsAwarded !== null && x.pointsAwarded >= x.points;
                const zero = !x.pointsAwarded;
                return (
                  <li key={x.questionId} className={`rounded-[14px] border p-3 ${full ? "border-green/40 bg-green-50" : zero ? "border-red/30 bg-red-50" : "border-amber-icon/40 bg-amber-50"}`}>
                    <div className="flex flex-wrap items-center gap-2 text-[13px]">
                      <span className="font-semibold">ข้อ {x.position}</span>
                      {x.section ? <Tag>{x.section}</Tag> : null}
                      <Tag tone="teal">{typeMeta(x.type).short}</Tag>
                      <span className="tabular ml-auto font-semibold">
                        {fmtPoints(x.pointsAwarded ?? 0)}/{fmtPoints(x.points)}
                      </span>
                    </div>
                    <p className="mt-1 line-clamp-2 text-[14px]">{x.prompt}</p>
                    <p className="mt-1 text-[13.5px]">
                      ตอบ: <b>{given || "ไม่ได้ตอบ"}</b> · เฉลย: {key}
                    </p>
                  </li>
                );
              })}
            </ol>
          </div>
        </Modal>
      ) : null}

      {resetFor ? (
        <Modal title="รีเซ็ตสิทธิ์สอบ" onClose={() => setResetFor(null)}>
          <div className="flex flex-col gap-4">
            <p className="text-[15px]">
              ให้ <b>{fullName(resetFor)}</b> ({resetFor.email}) ทำชุด “{pack?.title}” ใหม่ได้
            </p>
            <Note tone="warn">ครั้งที่ทำไปแล้วจะไม่ถูกลบ ยังดูและ export ได้ แต่ไม่นับเป็นสิทธิ์ ถ้ากำลังทำอยู่ ระบบจะส่งคำตอบของครั้งนั้นให้ก่อน</Note>
            <div className="flex justify-end gap-2">
              <Button kind="ghost" onClick={() => setResetFor(null)}>
                ยกเลิก
              </Button>
              <Button icon="restart_alt" disabled={busy} onClick={doReset}>
                ยืนยันรีเซ็ต
              </Button>
            </div>
          </div>
        </Modal>
      ) : null}

      {regrade ? (
        <Modal title="ตรวจใหม่ — ดูผลก่อนยืนยัน" onClose={() => setRegrade(null)}>
          <div className="flex flex-col gap-4">
            <p className="text-[15px]">
              ตรวจ {regrade.checked} ครั้งที่ส่งแล้วด้วยเฉลยและคะแนนปัจจุบัน — คะแนนจะเปลี่ยน <b>{regrade.changes.length}</b> ครั้ง
            </p>
            {regrade.changes.length > 0 ? (
              <ul className="flex max-h-[40vh] flex-col divide-y divide-border overflow-y-auto rounded-[14px] border border-border">
                {regrade.changes.map((c) => {
                  const a = byId.get(c.attemptId);
                  return (
                    <li key={c.attemptId} className="flex items-center justify-between gap-3 px-3 py-2 text-[14px]">
                      <span>{a ? `${fullName(a)} (ครั้งที่ ${a.attemptNo})` : c.attemptId}</span>
                      <span className="tabular">
                        {fmtPoints(c.oldScore)}/{fmtPoints(c.oldMaxScore)} → <b>{fmtPoints(c.newScore)}/{fmtPoints(c.newMaxScore)}</b>
                      </span>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <Note tone="ok">คะแนนทุกคนตรงกับเฉลยปัจจุบันแล้ว ไม่ต้องตรวจใหม่</Note>
            )}
            <div className="flex justify-end gap-2">
              <Button kind="ghost" onClick={() => setRegrade(null)}>
                ปิด
              </Button>
              <Button icon="published_with_changes" disabled={busy || regrade.changes.length === 0} onClick={() => runRegrade(true)}>
                ยืนยันตรวจใหม่
              </Button>
            </div>
          </div>
        </Modal>
      ) : null}
    </>
  );
}
