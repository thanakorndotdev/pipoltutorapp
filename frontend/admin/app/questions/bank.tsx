"use client";

import { useEffect, useState } from "react";

import { QuestionForm } from "@/components/question-form";
import { Button, Card, Empty, Modal, Note, PageHeader, SUBJECT_TONE, Spinner, Tag, inputClass } from "@/components/ui";
import { errorMessage, useAdmin } from "@/lib/admin";
import { formatThaiDateShort } from "@/lib/format";
import { SUBJECTS, subjectLabel, type Question, type QuestionInput, type Subject } from "@/lib/types";

type Filters = { subject: Subject | ""; q: string; active: "" | "true" | "false" };
type Topics = { subject: Subject; topic: string; n: number }[];
const PAGE = 50;

export function QuestionBank() {
  const { api } = useAdmin();
  const [filters, setFilters] = useState<Filters>({ subject: "", q: "", active: "" });
  const [rows, setRows] = useState<Question[] | null>(null);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [topics, setTopics] = useState<Topics>([]);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<Question | null | "new">(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);

  const [tick, setTick] = useState(0);
  const reload = () => setTick((t) => t + 1);

  useEffect(() => {
    const params = new URLSearchParams();
    if (filters.subject) params.set("subject", filters.subject);
    if (filters.q.trim()) params.set("q", filters.q.trim());
    if (filters.active) params.set("active", filters.active);
    params.set("limit", String(PAGE));
    params.set("offset", String(offset));
    let cancelled = false;
    Promise.all([
      api<{ questions: Question[]; total: number }>(`/admin/questions?${params}`),
      api<{ topics: Topics }>("/admin/questions/topics"),
    ])
      .then(([list, t]) => {
        if (cancelled) return;
        setRows(list.questions);
        setTotal(list.total);
        setTopics(t.topics);
        setError(null);
      })
      .catch((e) => !cancelled && setError(errorMessage(e)));
    return () => {
      cancelled = true;
    };
  }, [api, filters, offset, tick]);

  const setFilter = (p: Partial<Filters>) => {
    setFilters((f) => ({ ...f, ...p }));
    setOffset(0);
  };

  async function save(input: QuestionInput) {
    if (editing === "new") {
      await api("/admin/questions", { method: "POST", json: input });
      setNotice("เพิ่มข้อสอบแล้ว");
    } else if (editing) {
      await api(`/admin/questions/${editing.id}`, { method: "PUT", json: input });
      setNotice("บันทึกการแก้ไขแล้ว");
    }
    setEditing(null);
    reload();
  }

  /** Two-click delete: first click arms, second within the same row confirms. */
  async function remove(q: Question) {
    if (confirmId !== q.id) {
      setConfirmId(q.id);
      return;
    }
    setConfirmId(null);
    try {
      await api(`/admin/questions/${q.id}`, { method: "DELETE" });
      setNotice("ลบแล้ว");
      reload();
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  async function toggleActive(q: Question) {
    try {
      const { id, createdAt, updatedAt, usedInPacks, ...rest } = q;
      void id; void createdAt; void updatedAt; void usedInPacks;
      await api(`/admin/questions/${q.id}`, { method: "PUT", json: { ...rest, active: !q.active } });
      reload();
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  const topicNames = Array.from(new Set(topics.map((t) => t.topic)));
  const bySubject = SUBJECTS.map((s) => ({ ...s, n: topics.filter((t) => t.subject === s.id).reduce((a, b) => a + b.n, 0) }));

  return (
    <>
      <PageHeader
        title="คลังข้อสอบ"
        sub={`ทั้งหมด ${total} ข้อ · แก้ไข เพิ่ม หรือปิดใช้งานได้ที่นี่ แล้วไปเลือกเข้าชุดที่หน้า “ชุดข้อสอบ”`}
        actions={
          <Button icon="add" onClick={() => setEditing("new")}>
            เพิ่มข้อสอบ
          </Button>
        }
      />

      <Card className="flex flex-col gap-3">
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setFilter({ subject: "" })}
            aria-pressed={filters.subject === ""}
            className={`min-h-[36px] rounded-full border px-3.5 text-[14px] font-medium ${filters.subject === "" ? "border-brand bg-brand-50 text-brand" : "border-border bg-card text-ink2"}`}
          >
            ทุกวิชา
          </button>
          {bySubject.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setFilter({ subject: s.id })}
              aria-pressed={filters.subject === s.id}
              className={`min-h-[36px] rounded-full border px-3.5 text-[14px] font-medium ${filters.subject === s.id ? "border-brand bg-brand-50 text-brand" : "border-border bg-card text-ink2"}`}
            >
              {s.label} <span className="tabular text-ink3">{s.n}</span>
            </button>
          ))}
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            type="search"
            placeholder="ค้นหาโจทย์หรือหัวข้อ"
            className={`${inputClass} sm:flex-1`}
            value={filters.q}
            onChange={(e) => setFilter({ q: e.target.value })}
            aria-label="ค้นหา"
          />
          <select className={`${inputClass} sm:w-[180px]`} value={filters.active} onChange={(e) => setFilter({ active: e.target.value as Filters["active"] })} aria-label="สถานะ">
            <option value="">ทุกสถานะ</option>
            <option value="true">เปิดใช้งาน</option>
            <option value="false">ปิดใช้งาน</option>
          </select>
        </div>
      </Card>

      {notice ? <Note tone="ok">{notice}</Note> : null}
      {error ? <Note tone="error">{error}</Note> : null}
      {rows === null && !error ? <Spinner /> : null}
      {rows && rows.length === 0 ? <Empty icon="quiz">ไม่พบข้อสอบตามเงื่อนไข</Empty> : null}
      {rows && rows.length > 0 ? (
        <ul className="flex flex-col gap-3">
          {rows.map((q) => (
            <li key={q.id}>
              <Card className={`flex flex-col gap-3 ${q.active ? "" : "opacity-70"}`}>
                <div className="flex flex-wrap items-center gap-2">
                  <Tag tone={SUBJECT_TONE[q.subject]}>{subjectLabel(q.subject)}</Tag>
                  <Tag>{q.topic}</Tag>
                  {!q.active ? <Tag tone="red">ปิดใช้งาน</Tag> : null}
                  {q.usedInPacks ? <Tag tone="green">อยู่ใน {q.usedInPacks} ชุด</Tag> : null}
                  <span className="ml-auto text-[12.5px] text-ink3">แก้ไข {formatThaiDateShort(q.updatedAt)}</span>
                </div>
                <p className="text-[15.5px]">{q.prompt}</p>
                <ol className="grid grid-cols-1 gap-1.5 text-[14.5px] sm:grid-cols-2">
                  {q.choices.map((c) => (
                    <li key={c.key} className={`flex gap-2 rounded-[10px] px-2.5 py-1 ${c.key === q.correctChoice ? "bg-green-50 font-medium text-green" : "text-ink2"}`}>
                      <span className="w-5 shrink-0">{c.key}.</span>
                      <span>{c.text}</span>
                    </li>
                  ))}
                </ol>
                <div className="flex flex-wrap gap-2 border-t border-border pt-3">
                  <Button kind="ghost" size="sm" icon="edit" onClick={() => setEditing(q)}>
                    แก้ไข
                  </Button>
                  <Button kind="ghost" size="sm" icon={q.active ? "visibility_off" : "visibility"} onClick={() => toggleActive(q)}>
                    {q.active ? "ปิดใช้งาน" : "เปิดใช้งาน"}
                  </Button>
                  {confirmId === q.id ? (
                    <Button kind="ghost" size="sm" className="ml-auto" onClick={() => setConfirmId(null)}>
                      ยกเลิก
                    </Button>
                  ) : null}
                  <Button
                    kind="danger"
                    size="sm"
                    icon="delete"
                    className={confirmId === q.id ? "" : "ml-auto"}
                    onClick={() => remove(q)}
                    disabled={!!q.usedInPacks}
                    title={q.usedInPacks ? "เอาออกจากชุดก่อนจึงลบได้" : undefined}
                  >
                    {confirmId === q.id ? "ยืนยันลบ" : "ลบ"}
                  </Button>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      ) : null}
      {total > PAGE ? (
        <div className="flex items-center justify-between text-[14px] text-ink2">
          <Button kind="ghost" size="sm" icon="chevron_left" disabled={offset === 0} onClick={() => setOffset((o) => Math.max(0, o - PAGE))}>
            ก่อนหน้า
          </Button>
          <span>
            {offset + 1}–{Math.min(offset + PAGE, total)} จาก {total}
          </span>
          <Button kind="ghost" size="sm" icon="chevron_right" disabled={offset + PAGE >= total} onClick={() => setOffset((o) => o + PAGE)}>
            ถัดไป
          </Button>
        </div>
      ) : null}

      {editing !== null ? (
        <Modal title={editing === "new" ? "เพิ่มข้อสอบ" : "แก้ไขข้อสอบ"} onClose={() => setEditing(null)}>
          <QuestionForm initial={editing === "new" ? null : editing} topics={topicNames} onSubmit={save} onCancel={() => setEditing(null)} />
        </Modal>
      ) : null}
    </>
  );
}
