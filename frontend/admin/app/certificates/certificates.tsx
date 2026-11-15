"use client";

import Link from "next/link";
import { useCallback, useEffect, useEffectEvent, useState } from "react";

import { Button, Card, Empty, Field, Icon, Note, PageHeader, Spinner, Tag, inputClass } from "@/components/ui";
import { errorMessage, useAdmin } from "@/lib/admin";
import { formatThaiDateTime } from "@/lib/format";
import { CERT_STATUS, type AdminCertificate, type CertPack, type CertPackSettings, type CertSigningKey, type CertStatus } from "@/lib/types";

type TemplateOption = { id: string; name: string; publishedVersion: number };
type Counts = { queued: number; failed: number; valid: number };
/** GET /admin/certificates/progress: the worker's current (or last) run plus status counts. */
type RenderRun = { done: number; failed: number; remaining: number; total: number; startedAt: string | null; etaSeconds: number | null };
type Progress = { run: RenderRun | null; counts: Counts };

const n = (v: number) => v.toLocaleString("th-TH");

const check = "flex min-h-[40px] cursor-pointer items-center gap-2.5 text-[14.5px]";

/** Certificates (SoW M1): who earns one per pack, what has been issued, and the signing keys. */
export function Certificates() {
  const { api } = useAdmin();
  const [packs, setPacks] = useState<CertPack[] | null>(null);
  const [templates, setTemplates] = useState<TemplateOption[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const reload = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    let cancelled = false;
    api<{ packs: CertPack[]; templates: TemplateOption[] }>("/admin/certificates/packs/list")
      .then((r) => {
        if (cancelled) return;
        setPacks(r.packs);
        setTemplates(r.templates);
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
        title="เกียรติบัตร"
        sub="กำหนดว่าชุดข้อสอบใดออกเกียรติบัตร ดูใบที่ออกแล้ว เพิกถอน และออกใหม่ — ไฟล์สร้างและลงลายเซ็นดิจิทัลบนเซิร์ฟเวอร์"
        actions={
          <Link href="/certificates/templates/" className="inline-flex min-h-[44px] items-center gap-2 rounded-[12px] border-[1.5px] border-border-strong bg-card px-4 text-[15px] font-medium text-ink hover:bg-page">
            <Icon name="design_services" size={19} />
            เทมเพลตเกียรติบัตร
          </Link>
        }
      />
      {error ? <Note tone="error">{error}</Note> : null}
      <section className="flex flex-col gap-3">
        <h2 className="text-[19px] font-semibold">การออกเกียรติบัตรรายชุดข้อสอบ</h2>
        {!packs && !error ? <Spinner /> : null}
        {packs?.length === 0 ? <Empty>ยังไม่มีชุดข้อสอบ</Empty> : null}
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          {packs?.map((p) => <PackCard key={p.id} pack={p} templates={templates} onChanged={reload} />)}
        </div>
      </section>
      <CertTable packs={packs ?? []} refresh={tick} />
      <Keys />
    </>
  );
}

function PackCard({ pack, templates, onChanged }: { pack: CertPack; templates: TemplateOption[]; onChanged: () => void }) {
  const { api } = useAdmin();
  const initial: CertPackSettings = {
    level: pack.level,
    subjectLabel: pack.subjectLabel,
    certificateEnabled: pack.certificateEnabled,
    certOnAutoSubmit: pack.certOnAutoSubmit,
    certOnHardCutoff: pack.certOnHardCutoff,
    certOnReopen: pack.certOnReopen,
    certTemplateId: pack.certTemplateId,
  };
  const [d, setD] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [reissue, setReissue] = useState<{ live: number; policy: "previous_valid" | "superseded"; reason: string } | null>(null);
  const dirty = JSON.stringify(d) !== JSON.stringify(initial);
  const patch = (p: Partial<CertPackSettings>) => {
    setD((x) => ({ ...x, ...p }));
    setMsg(null);
  };

  async function run(fn: () => Promise<string>) {
    setBusy(true);
    setMsg(null);
    try {
      setMsg({ tone: "ok", text: await fn() });
      onChanged();
    } catch (e) {
      setMsg({ tone: "error", text: errorMessage(e) });
    } finally {
      setBusy(false);
    }
  }
  const save = () =>
    run(async () => {
      const r = await api<{ checked: number; live: number }>(`/admin/certificates/packs/${pack.id}/settings`, { method: "PUT", json: d });
      return `บันทึกแล้ว · ตรวจ ${r.checked} การสอบ มีเกียรติบัตรที่ใช้ได้ ${r.live} ใบ`;
    });
  const issue = () =>
    run(async () => {
      const r = await api<{ checked: number; live: number }>(`/admin/certificates/packs/${pack.id}/issue`, { method: "POST" });
      return `ตรวจ ${r.checked} การสอบ มีเกียรติบัตรที่ใช้ได้ ${r.live} ใบ (ใบที่ขาดถูกส่งเข้าคิวแล้ว)`;
    });
  async function openReissue() {
    try {
      const r = await api<{ live: number }>(`/admin/certificates/packs/${pack.id}/impact`);
      setReissue({ live: r.live, policy: "previous_valid", reason: "" });
    } catch (e) {
      setMsg({ tone: "error", text: errorMessage(e) });
    }
  }
  const confirmReissue = () =>
    run(async () => {
      const r = await api<{ issued: number }>(`/admin/certificates/packs/${pack.id}/reissue`, { method: "POST", json: { oldPolicy: reissue!.policy, reason: reissue!.reason.trim() } });
      setReissue(null);
      return `ออกใบใหม่ ${r.issued} ใบตามเทมเพลตปัจจุบัน`;
    });

  return (
    <Card className="flex flex-col gap-3.5">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-[16.5px] font-semibold">{pack.title}</h3>
        {pack.certificateEnabled ? <Tag tone="green">ออกเกียรติบัตร</Tag> : <Tag>ไม่ออก</Tag>}
        <span className="ml-auto text-[13px] text-ink3">ใช้ได้อยู่ {pack.live} ใบ</span>
      </div>
      <label className={check}>
        <input type="checkbox" className="size-5 accent-brand" checked={d.certificateEnabled} onChange={(e) => patch({ certificateEnabled: e.target.checked })} />
        ชุดนี้ออกเกียรติบัตรให้ผู้ที่ส่งข้อสอบ
      </label>
      {d.certificateEnabled ? (
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field id={`lv-${pack.id}`} label="ระดับชั้นของข้อสอบ">
              <select id={`lv-${pack.id}`} className={inputClass} value={d.level ?? ""} onChange={(e) => patch({ level: (e.target.value || null) as CertPackSettings["level"] })}>
                <option value="">ไม่ระบุ</option>
                <option value="m1">ม.1</option>
                <option value="m4">ม.4</option>
              </select>
            </Field>
            <Field id={`sj-${pack.id}`} label="วิชา (พิมพ์บนใบ)" hint="เช่น คณิตศาสตร์ · เว้นว่างได้">
              <input id={`sj-${pack.id}`} className={inputClass} maxLength={120} value={d.subjectLabel ?? ""} onChange={(e) => patch({ subjectLabel: e.target.value || null })} />
            </Field>
          </div>
          <fieldset className="flex flex-col rounded-[12px] border border-border px-3.5 py-2">
            <legend className="display px-1 text-[13.5px] font-medium">นอกจากกดส่งเอง ให้สิทธิ์กรณีต่อไปนี้ด้วย</legend>
            <label className={check}>
              <input type="checkbox" className="size-5 accent-brand" checked={d.certOnAutoSubmit} onChange={(e) => patch({ certOnAutoSubmit: e.target.checked })} />
              หมดเวลาทำข้อสอบ ระบบส่งให้อัตโนมัติ
            </label>
            <label className={check}>
              <input type="checkbox" className="size-5 accent-brand" checked={d.certOnHardCutoff} onChange={(e) => patch({ certOnHardCutoff: e.target.checked })} />
              ถูกตัดที่เวลาปิดรับของชุด (Hard cutoff)
            </label>
            <label className={check}>
              <input type="checkbox" className="size-5 accent-brand" checked={d.certOnReopen} onChange={(e) => patch({ certOnReopen: e.target.checked })} />
              การสอบที่ถูกรีเซ็ตสิทธิ์ให้สอบใหม่ (ไม่ติ๊ก = ใบของครั้งนั้นถูกเพิกถอน)
            </label>
          </fieldset>
          <Field id={`tp-${pack.id}`} label="เทมเพลต" hint="เปลี่ยนแล้วมีผลกับใบที่ออกใหม่ ใบเดิมคงรูปแบบเดิมจนกว่าจะกด “ออกใบใหม่ตามเทมเพลต”">
            <select id={`tp-${pack.id}`} className={inputClass} value={d.certTemplateId ?? ""} onChange={(e) => patch({ certTemplateId: e.target.value || null })}>
              <option value="">แบบมาตรฐานของเว็บ</option>
              {templates.map((t) => (
                <option key={t.id} value={t.id} disabled={t.publishedVersion === 0}>
                  {t.name} {t.publishedVersion === 0 ? "(ยังไม่เผยแพร่)" : `· v${t.publishedVersion}`}
                </option>
              ))}
            </select>
          </Field>
        </>
      ) : null}
      {msg ? <Note tone={msg.tone}>{msg.text}</Note> : null}
      <div className="flex flex-wrap gap-2 border-t border-border pt-3">
        <Button size="sm" icon="save" disabled={busy || !dirty} onClick={() => void save()}>
          บันทึก
        </Button>
        {pack.certificateEnabled && !dirty ? (
          <>
            <Button kind="ghost" size="sm" icon="playlist_add_check" disabled={busy} onClick={() => void issue()}>
              ออกใบที่ยังขาด
            </Button>
            <Button kind="ghost" size="sm" icon="autorenew" disabled={busy} onClick={() => void openReissue()}>
              ออกใบใหม่ตามเทมเพลต
            </Button>
          </>
        ) : null}
      </div>
      {reissue ? (
        <div className="flex flex-col gap-3 rounded-[12px] bg-amber-50 p-3.5">
          <p className="text-[14.5px] text-amber-ink">
            จะออกเกียรติบัตรฉบับใหม่ (รหัสใหม่) แทน <b>{reissue.live}</b> ใบที่ใช้ได้อยู่ของชุดนี้ ตามเทมเพลตที่ตั้งไว้ตอนนี้
          </p>
          <Field id={`pol-${pack.id}`} label="ใบฉบับเดิม">
            <select id={`pol-${pack.id}`} className={inputClass} value={reissue.policy} onChange={(e) => setReissue({ ...reissue, policy: e.target.value as "previous_valid" | "superseded" })}>
              <option value="previous_valid">ยังตรวจสอบได้ ในฐานะฉบับก่อนหน้า</option>
              <option value="superseded">ใช้ไม่ได้แล้ว (ถูกแทนที่)</option>
            </select>
          </Field>
          <Field id={`rs-${pack.id}`} label="เหตุผล (บันทึกใน audit log)">
            <input id={`rs-${pack.id}`} className={inputClass} maxLength={500} value={reissue.reason} onChange={(e) => setReissue({ ...reissue, reason: e.target.value })} />
          </Field>
          <div className="flex gap-2">
            <Button size="sm" kind="danger" disabled={busy || reissue.reason.trim().length < 3 || reissue.live === 0} onClick={() => void confirmReissue()}>
              ยืนยันออกใบใหม่ {reissue.live} ใบ
            </Button>
            <Button size="sm" kind="ghost" onClick={() => setReissue(null)}>
              ยกเลิก
            </Button>
          </div>
        </div>
      ) : null}
    </Card>
  );
}

/**
 * Polls the render queue: every 2 s while files are being made, every 10 s when idle so a
 * new batch shows up on its own, and not at all while the tab is hidden. `onRunFinished`
 * fires when a run this page watched empties the queue.
 */
function useRenderProgress(refresh: number, onRunFinished: () => void) {
  const { api } = useAdmin();
  const [progress, setProgress] = useState<Progress | null>(null);
  const [watched, setWatched] = useState(false);
  const finished = useEffectEvent(onRunFinished);

  useEffect(() => {
    let stopped = false;
    let busy = false;
    let wasActive = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    async function poll() {
      clearTimeout(timer);
      if (stopped || busy || document.hidden) return;
      busy = true;
      let active = wasActive;
      try {
        const r = await api<Progress>("/admin/certificates/progress");
        if (stopped) return;
        active = (r.run?.remaining ?? 0) > 0;
        setProgress(r);
        if (active) setWatched(true);
        if (wasActive && !active) finished();
        wasActive = active;
      } catch {
        // Keep the last numbers on screen; the next tick tries again.
      } finally {
        busy = false;
      }
      if (!stopped) timer = setTimeout(() => void poll(), active ? 2_000 : 10_000);
    }
    const onVisible = () => void poll();
    document.addEventListener("visibilitychange", onVisible);
    void poll();
    return () => {
      stopped = true;
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [api, refresh]);

  return { progress, watched };
}

function eta(seconds: number) {
  const m = Math.ceil(seconds / 60);
  if (m <= 1) return "อีกไม่ถึง 1 นาที";
  if (m < 60) return `อีกประมาณ ${m} นาที`;
  return `อีกประมาณ ${Math.floor(m / 60)} ชม. ${m % 60} นาที`;
}

/** The bar shown while the worker makes files, and once more at 100% when the run ends. */
function RenderProgress({ run }: { run: RenderRun }) {
  const processed = run.done + run.failed;
  const pct = run.total ? Math.floor((processed / run.total) * 100) : 100;
  const done = run.remaining === 0;
  return (
    <Card className="flex flex-col gap-2.5 py-4">
      <div className="flex items-baseline gap-3">
        <Icon name={done ? "check_circle" : "progress_activity"} size={19} fill={done} className={done ? "self-center text-green" : "animate-spin self-center text-brand"} />
        <span id="render-progress-label" className="text-[15px] font-medium">
          {done ? "สร้างไฟล์เกียรติบัตรรอบนี้เสร็จแล้ว" : "กำลังสร้างไฟล์เกียรติบัตร"}
        </span>
        <span className="tabular display ml-auto text-[20px] font-semibold text-ink">{pct}%</span>
      </div>
      <div
        role="progressbar"
        aria-labelledby="render-progress-label"
        aria-valuemin={0}
        aria-valuemax={run.total}
        aria-valuenow={processed}
        aria-valuetext={`${n(processed)} จาก ${n(run.total)} ใบ`}
        className="h-3 overflow-hidden rounded-full bg-brand-50"
      >
        <div className={`h-full rounded-full transition-[width] duration-700 ease-out ${done ? "bg-green" : "bg-brand"}`} style={{ width: `${pct}%` }} />
      </div>
      <p className="tabular text-[13.5px] text-ink3">
        สร้างแล้ว <b className="font-medium text-ink">{n(run.done)}</b> จาก {n(run.total)} ใบ
        {run.remaining > 0 ? ` · เหลือ ${n(run.remaining)} ใบ` : ""}
        {run.etaSeconds !== null ? ` · ${eta(run.etaSeconds)}` : ""}
        {run.failed > 0 ? <span className="text-red"> · สร้างไม่สำเร็จ {n(run.failed)} ใบ</span> : null}
      </p>
    </Card>
  );
}

function CertTable({ packs, refresh }: { packs: CertPack[]; refresh: number }) {
  const { api } = useAdmin();
  const [rows, setRows] = useState<AdminCertificate[] | null>(null);
  const [listCounts, setCounts] = useState<Counts | null>(null);
  const [packId, setPackId] = useState("");
  const [status, setStatus] = useState<CertStatus | "">("");
  const [q, setQ] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [acting, setActing] = useState<{ id: string; kind: "revoke" | "reissue"; reason: string } | null>(null);
  const [tick, setTick] = useState(0);
  // A finished run turns its rows from "queued" to "valid": reload the list once.
  const { progress, watched } = useRenderProgress(refresh + tick, () => setTick((t) => t + 1));
  const counts = progress?.counts ?? listCounts;
  const run = progress?.run;

  useEffect(() => {
    let cancelled = false;
    const params = new URLSearchParams();
    if (packId) params.set("packId", packId);
    if (status) params.set("status", status);
    if (q.trim()) params.set("q", q.trim());
    const timer = setTimeout(() => {
      api<{ certificates: AdminCertificate[]; counts: Counts }>(`/admin/certificates?${params}`)
        .then((r) => {
          if (cancelled) return;
          setRows(r.certificates);
          setCounts(r.counts);
          setError(null);
        })
        .catch((e) => !cancelled && setError(errorMessage(e)));
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [api, packId, status, q, tick, refresh]);

  async function act(path: string, json?: unknown) {
    try {
      await api(path, { method: "POST", json });
      setActing(null);
      setTick((t) => t + 1);
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <h2 className="text-[19px] font-semibold">เกียรติบัตรที่ออกแล้ว</h2>
        {counts ? (
          <p className="text-[13.5px] text-ink3">
            ใช้ได้ {n(counts.valid)} · รอสร้างไฟล์ {n(counts.queued)} · สร้างไม่สำเร็จ {n(counts.failed)}
          </p>
        ) : null}
      </div>
      {run && (run.remaining > 0 || watched) ? <RenderProgress run={run} /> : null}
      <Card className="flex flex-col gap-3 sm:flex-row">
        <select aria-label="ชุดข้อสอบ" className={inputClass} value={packId} onChange={(e) => setPackId(e.target.value)}>
          <option value="">ทุกชุดข้อสอบ</option>
          {packs.map((p) => (
            <option key={p.id} value={p.id}>
              {p.title}
            </option>
          ))}
        </select>
        <select aria-label="สถานะ" className={inputClass} value={status} onChange={(e) => setStatus(e.target.value as CertStatus | "")}>
          <option value="">ทุกสถานะ</option>
          {(Object.keys(CERT_STATUS) as CertStatus[]).map((s) => (
            <option key={s} value={s}>
              {CERT_STATUS[s].label}
            </option>
          ))}
        </select>
        <input aria-label="ค้นหา" className={inputClass} placeholder="ค้นชื่อ อีเมล หรือเลขที่ PT-000123" value={q} onChange={(e) => setQ(e.target.value)} />
      </Card>
      {error ? <Note tone="error">{error}</Note> : null}
      {!rows && !error ? <Spinner /> : null}
      {rows?.length === 0 ? <Empty icon="workspace_premium">ยังไม่มีเกียรติบัตรตามเงื่อนไขนี้</Empty> : null}
      {rows && rows.length > 0 ? (
        <ul className="flex flex-col gap-2.5">
          {rows.map((c) => (
            <li key={c.id}>
              <Card className="flex flex-col gap-2.5 py-4">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                  <span className="tabular display text-[15px] font-medium">{c.serial}</span>
                  <Tag tone={CERT_STATUS[c.status].tone}>{CERT_STATUS[c.status].label}</Tag>
                  <span className="text-[15px]">{c.recipientName}</span>
                  <span className="text-[13px] text-ink3">{c.email}</span>
                  <span className="text-[13px] text-ink3 sm:ml-auto">
                    {c.packTitle} · ฉบับที่ {c.revision} · {formatThaiDateTime(c.issuedAt)}
                  </span>
                </div>
                {c.status === "render_failed" && c.jobError ? <p className="text-[13px] text-red">ลองแล้ว {c.jobTries} ครั้ง: {c.jobError}</p> : null}
                {c.revokeReason ? <p className="text-[13px] text-ink3">เหตุผล: {REASON[c.revokeReason] ?? c.revokeReason}</p> : null}
                <div className="flex flex-wrap gap-2">
                  {/* Plain <a>: the verify page lives on the main site, outside /admin. */}
                  <a href={`/cert/${c.publicId}`} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-[36px] items-center gap-1.5 rounded-[12px] border-[1.5px] border-border-strong bg-card px-3 text-[14px] font-medium hover:bg-page">
                    <Icon name="verified" size={17} />
                    หน้าตรวจสอบ
                  </a>
                  {c.status === "valid" || c.status === "previous_valid" ? (
                    <a href={`/api/certificates/${c.id}/file?format=png`} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-[36px] items-center gap-1.5 rounded-[12px] border-[1.5px] border-border-strong bg-card px-3 text-[14px] font-medium hover:bg-page" title="เปิดได้เมื่อเข้าสู่ระบบด้วยบัญชี Google ที่เป็นแอดมิน">
                      <Icon name="image" size={17} />
                      ดูไฟล์
                    </a>
                  ) : null}
                  {c.status === "render_failed" || c.status === "queued" ? (
                    <Button size="sm" kind="ghost" icon="refresh" onClick={() => void act(`/admin/certificates/${c.id}/retry`)}>
                      สร้างไฟล์ใหม่
                    </Button>
                  ) : null}
                  {c.status === "valid" || c.status === "previous_valid" ? (
                    <Button size="sm" kind="danger" icon="block" onClick={() => setActing({ id: c.id, kind: "revoke", reason: "" })}>
                      เพิกถอน
                    </Button>
                  ) : null}
                  {c.status === "revoked" && c.revokeReason === "admin" ? (
                    <Button size="sm" kind="ghost" icon="autorenew" onClick={() => setActing({ id: c.id, kind: "reissue", reason: "" })}>
                      ออกใบใหม่
                    </Button>
                  ) : null}
                </div>
                {acting?.id === c.id ? (
                  <div className="flex flex-col gap-2 rounded-[12px] bg-page p-3 sm:flex-row sm:items-end">
                    <div className="flex-1">
                      <Field id={`why-${c.id}`} label={acting.kind === "revoke" ? "เหตุผลที่เพิกถอน" : "เหตุผลที่ออกใบใหม่"}>
                        <input id={`why-${c.id}`} className={inputClass} maxLength={500} value={acting.reason} onChange={(e) => setActing({ ...acting, reason: e.target.value })} />
                      </Field>
                    </div>
                    <Button size="sm" kind={acting.kind === "revoke" ? "danger" : "primary"} disabled={acting.reason.trim().length < 3} onClick={() => void act(`/admin/certificates/${c.id}/${acting.kind}`, { reason: acting.reason.trim() })}>
                      ยืนยัน
                    </Button>
                    <Button size="sm" kind="ghost" onClick={() => setActing(null)}>
                      ยกเลิก
                    </Button>
                  </div>
                ) : null}
              </Card>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}

const REASON: Record<string, string> = {
  name_changed: "นักเรียนเปลี่ยนชื่อ–นามสกุล",
  template_changed: "เปลี่ยนเทมเพลต",
  not_eligible: "ไม่เข้าเงื่อนไขของชุดข้อสอบแล้ว (เช่น ถูกรีเซ็ตสิทธิ์)",
  admin: "ผู้ดูแลเพิกถอน",
};

function Keys() {
  const { api } = useAdmin();
  const [keys, setKeys] = useState<CertSigningKey[] | null>(null);
  const [reason, setReason] = useState("");
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    api<{ keys: CertSigningKey[] }>("/admin/certificates/keys/list")
      .then((r) => !cancelled && setKeys(r.keys))
      .catch((e) => !cancelled && setError(errorMessage(e)));
    return () => {
      cancelled = true;
    };
  }, [api, tick]);

  async function rotate() {
    try {
      await api("/admin/certificates/keys/rotate", { method: "POST", json: { reason: reason.trim() } });
      setOpen(false);
      setReason("");
      setTick((t) => t + 1);
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-[19px] font-semibold">กุญแจลงลายเซ็นดิจิทัล</h2>
      <Card className="flex flex-col gap-3">
        <p className="text-[14px] text-ink2">
          กุญแจส่วนตัวเก็บเป็นไฟล์บนเซิร์ฟเวอร์เท่านั้น (ไม่อยู่ในฐานข้อมูลและไม่ส่งออกมาที่หน้านี้) กุญแจเก่ายังใช้ตรวจเกียรติบัตรที่เคยลงนามไว้ได้เสมอ
        </p>
        {error ? <Note tone="error">{error}</Note> : null}
        {!keys && !error ? <Spinner /> : null}
        {keys?.length === 0 ? <p className="text-[14px] text-ink3">ยังไม่มีกุญแจ ระบบจะสร้างให้เมื่อออกเกียรติบัตรใบแรก</p> : null}
        <ul className="flex flex-col divide-y divide-border">
          {keys?.map((k) => (
            <li key={k.keyId} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2.5 text-[14.5px]">
              <code className="text-[13.5px]">{k.keyId}</code>
              {k.active ? <Tag tone="green">ใช้ลงนามอยู่</Tag> : <Tag>เลิกใช้ลงนาม (ยังตรวจได้)</Tag>}
              <span className="text-[13px] text-ink3 sm:ml-auto">
                {k.algorithm} · สร้าง {formatThaiDateTime(k.createdAt)}
              </span>
            </li>
          ))}
        </ul>
        {open ? (
          <div className="flex flex-col gap-2 rounded-[12px] bg-page p-3 sm:flex-row sm:items-end">
            <div className="flex-1">
              <Field id="rotate-why" label="เหตุผลที่เปลี่ยนกุญแจ">
                <input id="rotate-why" className={inputClass} maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} />
              </Field>
            </div>
            <Button size="sm" disabled={reason.trim().length < 3} onClick={() => void rotate()}>
              ยืนยันสร้างกุญแจใหม่
            </Button>
            <Button size="sm" kind="ghost" onClick={() => setOpen(false)}>
              ยกเลิก
            </Button>
          </div>
        ) : (
          <div>
            <Button size="sm" kind="ghost" icon="key" onClick={() => setOpen(true)}>
              เปลี่ยนกุญแจ (Key rotation)
            </Button>
          </div>
        )}
      </Card>
    </section>
  );
}
