"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { Button, Card, Empty, Icon, Note, PageHeader, SUBJECT_TONE, Spinner, Tag, inputClass } from "@/components/ui";
import { errorMessage, useAdmin } from "@/lib/admin";
import { SUBJECTS, subjectLabel, type Pack, type PackQuestion, type Question, type Subject } from "@/lib/types";

/** Bank rows and pack rows share this shape for the picker. */
type Item = Pick<Question, "id" | "subject" | "topic" | "prompt" | "active">;

export function PackEditor() {
  const params = useSearchParams();
  const id = params.get("id");
  const { api } = useAdmin();

  const [pack, setPack] = useState<Pack | null>(null);
  const [selected, setSelected] = useState<Item[]>([]);
  const [savedIds, setSavedIds] = useState<string[]>([]);
  const [bank, setBank] = useState<Item[] | null>(null);
  const [subject, setSubject] = useState<Subject | "">("");
  const [topic, setTopic] = useState("");
  const [q, setQ] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    Promise.all([
      api<{ pack: Pack; questions: PackQuestion[] }>(`/admin/packs/${id}/questions`),
      api<{ questions: Question[] }>("/admin/questions?active=true&limit=200"),
    ])
      .then(([comp, list]) => {
        if (cancelled) return;
        setPack(comp.pack);
        const items = comp.questions.map(({ id, subject, topic, prompt, active }) => ({ id, subject, topic, prompt, active }));
        setSelected(items);
        setSavedIds(items.map((i) => i.id));
        setBank(list.questions.map(({ id, subject, topic, prompt, active }) => ({ id, subject, topic, prompt, active })));
        setError(null);
      })
      .catch((e) => !cancelled && setError(errorMessage(e)));
    return () => {
      cancelled = true;
    };
  }, [api, id]);

  const selectedIds = useMemo(() => new Set(selected.map((s) => s.id)), [selected]);
  const dirty = useMemo(() => selected.map((s) => s.id).join() !== savedIds.join(), [selected, savedIds]);

  const topics = useMemo(() => {
    const src = bank ?? [];
    return Array.from(new Set(src.filter((b) => !subject || b.subject === subject).map((b) => b.topic))).sort();
  }, [bank, subject]);

  const available = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return (bank ?? []).filter(
      (b) =>
        !selectedIds.has(b.id) &&
        (!subject || b.subject === subject) &&
        (!topic || b.topic === topic) &&
        (!needle || b.prompt.toLowerCase().includes(needle) || b.topic.toLowerCase().includes(needle))
    );
  }, [bank, selectedIds, subject, topic, q]);

  const add = (item: Item) => {
    setSelected((s) => [...s, item]);
    setSaved(false);
  };
  const addAll = () => {
    setSelected((s) => [...s, ...available]);
    setSaved(false);
  };
  const remove = (itemId: string) => {
    setSelected((s) => s.filter((x) => x.id !== itemId));
    setSaved(false);
  };
  const move = (from: number, to: number) => {
    if (to < 0 || to >= selected.length) return;
    setSelected((s) => {
      const next = [...s];
      const [it] = next.splice(from, 1);
      next.splice(to, 0, it);
      return next;
    });
    setSaved(false);
  };
  const shuffle = () => {
    setSelected((s) => {
      const next = [...s];
      for (let i = next.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [next[i], next[j]] = [next[j], next[i]];
      }
      return next;
    });
    setSaved(false);
  };
  /** Group by subject in the exam's section order, keeping relative order. */
  const sortBySubject = () => {
    const order = SUBJECTS.map((s) => s.id);
    setSelected((s) => [...s].sort((a, b) => order.indexOf(a.subject) - order.indexOf(b.subject)));
    setSaved(false);
  };

  async function save() {
    if (!id) return;
    setSaving(true);
    setError(null);
    try {
      const r = await api<{ pack: Pack }>(`/admin/packs/${id}/questions`, { method: "PUT", json: { questionIds: selected.map((s) => s.id) } });
      setPack(r.pack);
      setSavedIds(selected.map((s) => s.id));
      setSaved(true);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setSaving(false);
    }
  }

  if (!id) return <Note tone="error">ไม่ระบุชุดข้อสอบ</Note>;
  if (error && !pack) return <Note tone="error">{error}</Note>;
  if (!pack || bank === null) return <Spinner />;

  const counts = SUBJECTS.map((s) => ({ ...s, n: selected.filter((x) => x.subject === s.id).length }));
  const over = selected.length > pack.questionCount;

  return (
    <>
      <PageHeader
        title={pack.title}
        sub={`เลือกข้อจากคลังทางซ้ายเข้าชุดทางขวา · เป้าหมาย ${pack.questionCount} ข้อ`}
        actions={
          <>
            <Link href="/packs/" className="inline-flex min-h-[44px] items-center gap-2 rounded-[12px] border-[1.5px] border-border-strong bg-card px-4 text-[15px] font-medium text-ink">
              <Icon name="arrow_back" size={19} /> กลับ
            </Link>
            <Button icon="save" onClick={save} disabled={!dirty || saving}>
              {saving ? "กำลังบันทึก…" : dirty ? "บันทึกชุด" : "บันทึกแล้ว"}
            </Button>
          </>
        }
      />
      {error ? <Note tone="error">{error}</Note> : null}
      {saved && !dirty ? <Note tone="ok">บันทึกชุดแล้ว {selected.length} ข้อ</Note> : null}
      {over ? <Note tone="warn">เลือกเกินเป้าหมาย {selected.length - pack.questionCount} ข้อ บันทึกได้ แต่ควรเอาออกให้พอดี</Note> : null}
      {pack.attempts ? <Note tone="warn">มีนักเรียนทำชุดนี้ไปแล้ว {pack.attempts} ครั้ง การเปลี่ยนข้อจะกระทบรอบที่กำลังทำอยู่</Note> : null}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Bank */}
        <Card className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h2 className="text-[16px] font-semibold">คลังข้อสอบ</h2>
            <span className="text-[13.5px] text-ink3">{available.length} ข้อที่เลือกได้</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            <Chip on={subject === ""} onClick={() => { setSubject(""); setTopic(""); }}>ทุกวิชา</Chip>
            {SUBJECTS.map((s) => (
              <Chip key={s.id} on={subject === s.id} onClick={() => { setSubject(s.id); setTopic(""); }}>
                {s.short}
              </Chip>
            ))}
          </div>
          <div className="flex gap-2">
            <select className={`${inputClass} min-h-[40px] flex-1`} value={topic} onChange={(e) => setTopic(e.target.value)} aria-label="หัวข้อ">
              <option value="">ทุกหัวข้อ</option>
              {topics.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
            <input type="search" className={`${inputClass} min-h-[40px] flex-1`} placeholder="ค้นหา" value={q} onChange={(e) => setQ(e.target.value)} aria-label="ค้นหา" />
          </div>
          {available.length > 0 ? (
            <Button kind="ghost" size="sm" icon="playlist_add" className="self-start" onClick={addAll}>
              เพิ่มทั้งหมดที่แสดง ({available.length})
            </Button>
          ) : null}
          <ul className="flex max-h-[60vh] flex-col gap-2 overflow-y-auto pr-1">
            {available.length === 0 ? (
              <li>
                <Empty icon="search_off">ไม่มีข้อที่ตรงเงื่อนไข หรือเลือกไปหมดแล้ว</Empty>
              </li>
            ) : (
              available.map((b) => (
                <li key={b.id}>
                  <button
                    type="button"
                    onClick={() => add(b)}
                    className="flex w-full items-start gap-3 rounded-[14px] border border-border bg-page px-3 py-2.5 text-left hover:border-brand hover:bg-brand-50"
                  >
                    <span className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-full bg-card text-brand">
                      <Icon name="add" size={18} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="mb-1 flex flex-wrap gap-1.5">
                        <Tag tone={SUBJECT_TONE[b.subject]}>{subjectLabel(b.subject)}</Tag>
                        <Tag>{b.topic}</Tag>
                      </span>
                      <span className="line-clamp-2 block text-[14.5px] leading-[1.7]">{b.prompt}</span>
                    </span>
                  </button>
                </li>
              ))
            )}
          </ul>
        </Card>

        {/* Selected */}
        <Card className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h2 className="text-[16px] font-semibold">ในชุดนี้</h2>
            <Tag tone={selected.length === pack.questionCount ? "green" : over ? "red" : "amber"}>
              {selected.length} / {pack.questionCount} ข้อ
            </Tag>
          </div>
          <div className="flex flex-wrap gap-1.5 text-[13px] text-ink2">
            {counts.map((c) => (
              <span key={c.id} className="rounded-full bg-page px-2.5 py-0.5">
                {c.short} <span className="tabular font-medium text-ink">{c.n}</span>
              </span>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button kind="ghost" size="sm" icon="sort" onClick={sortBySubject} disabled={selected.length < 2}>
              เรียงตามวิชา
            </Button>
            <Button kind="ghost" size="sm" icon="shuffle" onClick={shuffle} disabled={selected.length < 2}>
              สุ่มลำดับ
            </Button>
            <Button kind="ghost" size="sm" icon="delete_sweep" className="ml-auto" onClick={() => { setSelected([]); setSaved(false); }} disabled={selected.length === 0}>
              เอาออกทั้งหมด
            </Button>
          </div>
          <ol className="flex max-h-[60vh] flex-col gap-2 overflow-y-auto pr-1">
            {selected.length === 0 ? (
              <li>
                <Empty icon="checklist">ยังไม่มีข้อในชุด กดข้อทางซ้ายเพื่อเพิ่ม</Empty>
              </li>
            ) : (
              selected.map((s, i) => (
                <li key={s.id} className="flex items-start gap-2 rounded-[14px] border border-border bg-card px-2.5 py-2">
                  <span className="tabular mt-0.5 w-8 shrink-0 text-center font-display text-[15px] font-semibold text-brand">{i + 1}</span>
                  <div className="min-w-0 flex-1">
                    <div className="mb-1 flex flex-wrap gap-1.5">
                      <Tag tone={SUBJECT_TONE[s.subject]}>{subjectLabel(s.subject)}</Tag>
                      <Tag>{s.topic}</Tag>
                    </div>
                    <p className="line-clamp-2 text-[14.5px] leading-[1.7]">{s.prompt}</p>
                  </div>
                  <div className="flex shrink-0 flex-col">
                    <Button kind="subtle" size="sm" icon="keyboard_arrow_up" title="เลื่อนขึ้น" disabled={i === 0} onClick={() => move(i, i - 1)} />
                    <Button kind="subtle" size="sm" icon="keyboard_arrow_down" title="เลื่อนลง" disabled={i === selected.length - 1} onClick={() => move(i, i + 1)} />
                  </div>
                  <Button kind="subtle" size="sm" icon="close" title="เอาออก" className="text-red" onClick={() => remove(s.id)} />
                </li>
              ))
            )}
          </ol>
        </Card>
      </div>
    </>
  );
}

function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      className={`min-h-[34px] rounded-full border px-3 text-[13.5px] font-medium ${on ? "border-brand bg-brand-50 text-brand" : "border-border bg-card text-ink2"}`}
    >
      {children}
    </button>
  );
}
