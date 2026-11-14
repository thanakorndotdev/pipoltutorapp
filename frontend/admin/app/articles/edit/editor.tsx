"use client";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  Button,
  Card,
  Field,
  Note,
  PageHeader,
  inputClass,
} from "@/components/ui";
import { ImagePicker } from "@/components/image-picker";
import { ArticleBlocks } from "@/components/article-blocks";
import { BlockEditor } from "@/components/article-editor-blocks";
import { useAdmin, errorMessage } from "@/lib/admin";
import type { ArticleBlock } from "@/lib/types";
type Content = {
  title: string;
  slug: string;
  excerpt: string | null;
  coverUrl: string | null;
  blocks: ArticleBlock[];
  kind: "lesson" | "news";
  levels: string[];
  subjects: string[];
  categoryIds: string[];
  tags: string[];
  sourceUrl: string | null;
  sourceCredit: string | null;
  sourceDate: string | null;
  deadline: string | null;
  viewMode: "none" | "views" | "popular";
};
type Doc = Content & {
  id: string;
  revision: number;
  workflow: string;
  published: boolean;
};
const blank: Content = {
  title: "",
  slug: "",
  excerpt: null,
  coverUrl: null,
  blocks: [],
  kind: "lesson",
  levels: [],
  subjects: [],
  categoryIds: [],
  tags: [],
  sourceUrl: null,
  sourceCredit: null,
  sourceDate: null,
  deadline: null,
  viewMode: "none",
};
const content = (a: Doc): Content =>
  Object.fromEntries(
    Object.keys(blank).map((k) => [
      k,
      a[k as keyof Content] ?? blank[k as keyof Content],
    ]),
  ) as Content;
export function ArticleEditor() {
  const id = useSearchParams().get("id"),
    router = useRouter(),
    { api } = useAdmin();
  const [d, setD] = useState<Content>(blank),
    [doc, setDoc] = useState<Doc | null>(null),
    [baseline, setBaseline] = useState(JSON.stringify(blank)),
    [categories, setCategories] = useState<{ id: string; name: string }[]>([]),
    [revisions, setRevisions] = useState<
      { version: number; snapshot: Doc; action: string }[]
    >([]),
    [old, setOld] = useState<Doc | null>(null),
    [error, setError] = useState(""),
    [note, setNote] = useState(""),
    [busy, setBusy] = useState(false),
    [preview, setPreview] = useState<"edit" | "desktop" | "mobile">("edit"),
    [schedule, setSchedule] = useState("");
  const dirty = JSON.stringify(d) !== baseline;
  const patch = (p: Partial<Content>) => {
    setD({ ...d, ...p });
    setNote("");
  };
  useEffect(() => {
    api<{ categories: typeof categories }>("/admin/cms")
      .then((r) => setCategories(r.categories))
      .catch(() => {});
    if (id)
      api<{ article: Doc; revisions: typeof revisions }>(
        `/admin/articles/${id}`,
      )
        .then((r) => {
          setDoc(r.article);
          const c = content(r.article);
          setD(c);
          setBaseline(JSON.stringify(c));
          setRevisions(r.revisions);
        })
        .catch((e) => setError(errorMessage(e)));
  }, [api, id]);
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
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
  async function save() {
    const r = await api<{ article: Doc }>(
      doc ? `/admin/articles/${doc.id}` : "/admin/articles",
      {
        method: doc ? "PUT" : "POST",
        json: { ...d, baseRevision: doc?.revision },
      },
    );
    setDoc(r.article);
    setBaseline(JSON.stringify(d));
    setNote("บันทึกฉบับร่างแล้ว");
    if (!doc) router.replace(`/articles/edit/?id=${r.article.id}`);
    return r.article;
  }
  async function workflow(action: string) {
    const a = dirty ? await save() : doc;
    if (!a) throw new Error("บันทึกฉบับร่างก่อน");
    const r = await api<{ article: Doc }>(`/admin/articles/${a.id}/workflow`, {
      method: "POST",
      json: {
        action,
        baseRevision: a.revision,
        ...(schedule ? { scheduledAt: new Date(schedule).toISOString() } : {}),
      },
    });
    setDoc(r.article);
    setNote("เปลี่ยนสถานะแล้ว");
  }
  return (
    <>
      <PageHeader
        title={doc ? "แก้ไขบทความ / ข่าว" : "เขียนบทความ / ข่าว"}
        sub="ฉบับร่าง → ส่งตรวจ → อนุมัติ → เผยแพร่หรือตั้งเวลา เนื้อหาที่เผยแพร่แล้วคงเดิมระหว่างแก้ฉบับร่าง"
        actions={
          <Link href="/articles/" className="text-brand underline">
            บทความทั้งหมด
          </Link>
        }
      />
      {error ? <Note tone="error">{error}</Note> : null}
      {note ? <Note tone="ok">{note}</Note> : null}
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-[14px]">
          {doc?.workflow ?? "ฉบับร่างใหม่"} · v{doc?.revision ?? 0}
          {dirty ? " · ยังไม่บันทึก" : ""}
        </span>
        <Button
          disabled={busy || !d.title.trim()}
          onClick={() =>
            void run(async () => {
              await save();
            })
          }
        >
          บันทึกฉบับร่าง
        </Button>
        {doc ? (
          <>
            <Button
              kind="ghost"
              disabled={busy || doc.workflow !== "draft"}
              onClick={() => void run(() => workflow("submit"))}
            >
              ส่งตรวจ
            </Button>
            <Button
              kind="ghost"
              disabled={busy || dirty || doc.workflow !== "in_review"}
              onClick={() => void run(() => workflow("approve"))}
            >
              อนุมัติ
            </Button>
            <Button
              disabled={busy || dirty || doc.workflow !== "approved"}
              onClick={() => void run(() => workflow("publish"))}
            >
              เผยแพร่
            </Button>
            <input
              aria-label="เวลาเผยแพร่ (เวลาเครื่องของคุณ)"
              type="datetime-local"
              className={inputClass}
              value={schedule}
              onChange={(e) => setSchedule(e.target.value)}
            />
            <Button
              kind="ghost"
              disabled={
                busy || dirty || doc.workflow !== "approved" || !schedule
              }
              onClick={() => void run(() => workflow("schedule"))}
            >
              ตั้งเวลา
            </Button>
            <Button
              kind="ghost"
              disabled={busy}
              onClick={() => void run(() => workflow("archive"))}
            >
              เก็บเข้าคลัง
            </Button>
            <Button
              kind="danger"
              disabled={busy}
              onClick={() => void run(() => workflow("delete"))}
            >
              ลบ (กู้คืนได้)
            </Button>
            {["deleted", "archived"].includes(doc.workflow) ? (
              <Button
                kind="ghost"
                onClick={() => void run(() => workflow("restore"))}
              >
                กู้คืนเป็นฉบับร่าง
              </Button>
            ) : null}
          </>
        ) : null}
      </div>
      <div className="flex gap-2">
        {[
          ["edit", "แก้ไข"],
          ["desktop", "Preview คอมพิวเตอร์"],
          ["mobile", "Preview มือถือ"],
        ].map(([v, l]) => (
          <Button
            key={v}
            kind={preview === v ? "primary" : "ghost"}
            onClick={() => setPreview(v as typeof preview)}
          >
            {l}
          </Button>
        ))}
      </div>
      {preview !== "edit" ? (
        <div
          className={`mx-auto w-full rounded-[16px] border border-border bg-card p-5 ${preview === "mobile" ? "max-w-[430px]" : "max-w-[1000px]"}`}
        >
          <h1 className="mb-5 text-[28px] font-semibold">{d.title}</h1>
          <ArticleBlocks blocks={d.blocks} mobile={preview === "mobile"} />
        </div>
      ) : (
        <>
          <Card className="flex flex-col gap-4">
            <Field id="title" label="ชื่อบทความ">
              <input
                id="title"
                className={inputClass}
                value={d.title}
                onChange={(e) => patch({ title: e.target.value })}
              />
            </Field>
            <Field
              id="slug"
              label="ลิงก์ (slug)"
              hint="เปลี่ยนลิงก์แล้วระบบเก็บทางไปลิงก์ใหม่ให้ลิงก์เก่า"
            >
              <input
                id="slug"
                className={inputClass}
                value={d.slug}
                onChange={(e) => patch({ slug: e.target.value.toLowerCase() })}
              />
            </Field>
            <Field id="excerpt" label="คำอธิบายสำหรับหน้ารวมและ SEO">
              <textarea
                id="excerpt"
                className={inputClass}
                value={d.excerpt ?? ""}
                onChange={(e) => patch({ excerpt: e.target.value || null })}
              />
            </Field>
            <ImagePicker
              id="cover"
              value={d.coverUrl ?? ""}
              onChange={(url) => patch({ coverUrl: url || null })}
              onError={(message) => setError(message ?? "")}
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <select
                aria-label="ชนิดเนื้อหา"
                className={inputClass}
                value={d.kind}
                onChange={(e) =>
                  patch({ kind: e.target.value as Content["kind"] })
                }
              >
                <option value="lesson">บทเรียน</option>
                <option value="news">ข่าวสาร จภ.</option>
              </select>
              <select
                aria-label="แสดงยอดอ่าน"
                className={inputClass}
                value={d.viewMode}
                onChange={(e) =>
                  patch({ viewMode: e.target.value as Content["viewMode"] })
                }
              >
                <option value="none">ไม่แสดงยอดอ่าน</option>
                <option value="views">แสดงยอดอ่าน</option>
                <option value="popular">แสดงป้ายยอดนิยม</option>
              </select>
            </div>
            <div className="flex gap-5">
              {["m1", "m4"].map((v) => (
                <label key={v} className="flex min-h-[44px] items-center gap-2">
                  <input
                    type="checkbox"
                    checked={d.levels.includes(v)}
                    onChange={(e) =>
                      patch({
                        levels: e.target.checked
                          ? [...d.levels, v]
                          : d.levels.filter((x) => x !== v),
                      })
                    }
                  />
                  {v === "m1" ? "ม.1" : "ม.4"}
                </label>
              ))}
            </div>
            <Field id="subjects" label="วิชา (คั่นด้วยจุลภาค)">
              <input
                id="subjects"
                className={inputClass}
                value={d.subjects.join(", ")}
                onChange={(e) =>
                  patch({
                    subjects: e.target.value.split(",").map((s) => s.trim()),
                  })
                }
              />
            </Field>
            <Field id="tags" label="แท็ก (คั่นด้วยจุลภาค)">
              <input
                id="tags"
                className={inputClass}
                value={d.tags.join(", ")}
                onChange={(e) =>
                  patch({
                    tags: e.target.value.split(",").map((s) => s.trim()),
                  })
                }
              />
            </Field>
            <fieldset className="flex flex-wrap gap-3">
              <legend>หมวดหมู่ (เลือกได้หลายหมวด)</legend>
              {categories.map((c) => (
                <label
                  key={c.id}
                  className="flex min-h-[44px] items-center gap-2"
                >
                  <input
                    type="checkbox"
                    checked={d.categoryIds.includes(c.id)}
                    onChange={(e) =>
                      patch({
                        categoryIds: e.target.checked
                          ? [...d.categoryIds, c.id]
                          : d.categoryIds.filter((x) => x !== c.id),
                      })
                    }
                  />
                  {c.name}
                </label>
              ))}
            </fieldset>
            {d.kind === "news" ? (
              <>
                <input
                  aria-label="URL แหล่งข่าว"
                  className={inputClass}
                  value={d.sourceUrl ?? ""}
                  onChange={(e) => patch({ sourceUrl: e.target.value || null })}
                  placeholder="https://แหล่งข่าว"
                />
                <input
                  aria-label="เครดิตแหล่งข่าว"
                  className={inputClass}
                  value={d.sourceCredit ?? ""}
                  onChange={(e) =>
                    patch({ sourceCredit: e.target.value || null })
                  }
                  placeholder="เครดิตแหล่งข่าว"
                />
                <Field id="source-date" label="วันที่ของแหล่งข่าว">
                  <input
                    id="source-date"
                    type="date"
                    className={inputClass}
                    value={d.sourceDate ?? ""}
                    onChange={(e) =>
                      patch({ sourceDate: e.target.value || null })
                    }
                  />
                </Field>
                <Field id="deadline" label="วันหมดเขตของข่าว">
                  <input
                    id="deadline"
                    type="datetime-local"
                    className={inputClass}
                    value={
                      d.deadline
                        ? new Date(
                            new Date(d.deadline).getTime() -
                              new Date().getTimezoneOffset() * 60000,
                          )
                            .toISOString()
                            .slice(0, 16)
                        : ""
                    }
                    onChange={(e) =>
                      patch({
                        deadline: e.target.value
                          ? new Date(e.target.value).toISOString()
                          : null,
                      })
                    }
                  />
                </Field>
              </>
            ) : null}
          </Card>
          <BlockEditor
            blocks={d.blocks}
            onChange={(blocks) => patch({ blocks })}
            onError={(message) => setError(message ?? "")}
          />
        </>
      )}
      {revisions.length ? (
        <Card className="flex flex-col gap-3">
          <h2 className="text-[19px] font-semibold">ประวัติและเปรียบเทียบ</h2>
          <select
            aria-label="เลือกเวอร์ชันเปรียบเทียบ"
            className={inputClass}
            onChange={(e) =>
              setOld(
                revisions.find((r) => r.version === Number(e.target.value))
                  ?.snapshot ?? null,
              )
            }
          >
            <option value="">เลือกเวอร์ชัน</option>
            {revisions.map((r) => (
              <option key={r.version} value={r.version}>
                v{r.version} · {r.action}
              </option>
            ))}
          </select>
          {old ? (
            <>
              <p>
                ชื่อเดิม: {old.title} → ปัจจุบัน: {d.title} · บล็อกเดิม{" "}
                {old.blocks.length} / ปัจจุบัน {d.blocks.length}
              </p>
              <div className="grid gap-5 lg:grid-cols-2">
                <div>
                  <h3 className="mb-3 font-semibold">เวอร์ชันที่เลือก</h3>
                  <ArticleBlocks blocks={old.blocks} />
                </div>
                <div>
                  <h3 className="mb-3 font-semibold">ฉบับปัจจุบัน</h3>
                  <ArticleBlocks blocks={d.blocks} />
                </div>
              </div>
            </>
          ) : null}
        </Card>
      ) : null}
    </>
  );
}
