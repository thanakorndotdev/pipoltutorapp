"use client";
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
type Category = {
  id: string;
  name: string;
  slug: string;
  kind: string;
  parentId: string | null;
  sortOrder: number;
};
type Section = { key: string; enabled: boolean; articleIds: string[] };
type Data = {
  categories: Category[];
  synonyms: Record<string, string[]>;
  moderationWords: string[];
  home: Section[];
  events: {
    articleId: string;
    kind: string;
    referrer: string | null;
    count: number;
  }[];
};
const names: Record<string, string> = {
  hero: "ส่วนแนะนำ",
  news: "ข่าวล่าสุด",
  lessons: "บทเรียนแนะนำ",
  courses: "คอร์สเรียน",
  exams: "คลังข้อสอบ",
  daily: "โจทย์ประจำวัน",
};
export default function Page() {
  const { api } = useAdmin();
  const [data, setData] = useState<Data | null>(null),
    [error, setError] = useState(""),
    [note, setNote] = useState(""),
    [category, setCategory] = useState({
      name: "",
      slug: "",
      kind: "category",
      parentId: "",
      sortOrder: 0,
    }),
    [from, setFrom] = useState(""),
    [to, setTo] = useState(""),
    [reason, setReason] = useState(""),
    [taxonomyReason, setTaxonomyReason] = useState(""),
    [plan, setPlan] = useState<{
      previewId: string;
      affected: { id: string; title: string }[];
    } | null>(null),
    [synonyms, setSynonyms] = useState(""),
    [words, setWords] = useState(""),
    [home, setHome] = useState<Section[]>([]),
    [articles, setArticles] = useState<{ id: string; title: string }[]>([]);
  async function load() {
    const d = await api<Data>("/admin/cms");
    setData(d);
    setSynonyms(
      Object.entries(d.synonyms)
        .map(([a, b]) => `${a} = ${b.join(" | ")}`)
        .join("\n"),
    );
    setWords(d.moderationWords.join("\n"));
    setHome(
      d.home.length
        ? d.home
        : Object.keys(names).map((key) => ({
            key,
            enabled: true,
            articleIds: [],
          })),
    );
  }
  useEffect(() => {
    api<Data>("/admin/cms")
      .then((d) => {
        setData(d);
        setSynonyms(
          Object.entries(d.synonyms)
            .map(([a, b]) => `${a} = ${b.join(" | ")}`)
            .join("\n"),
        );
        setWords(d.moderationWords.join("\n"));
        setHome(
          d.home.length
            ? d.home
            : Object.keys(names).map((key) => ({
                key,
                enabled: true,
                articleIds: [],
              })),
        );
      })
      .catch((e) => setError(errorMessage(e)));
    api<{ articles: { id: string; title: string }[] }>("/admin/articles")
      .then((r) => setArticles(r.articles))
      .catch(() => {});
  }, [api]);
  async function run(fn: () => Promise<void>) {
    setError("");
    try {
      await fn();
      setNote("บันทึกแล้ว");
    } catch (e) {
      setError(errorMessage(e));
    }
  }
  return (
    <>
      <PageHeader
        title="หมวดหมู่ ค้นหา และหน้าแรก"
        sub="จัดหมวดหลายระดับ คำค้นพ้อง การตรวจข้อความ และส่วนแสดงผลหน้าแรก"
      />
      {error ? <Note tone="error">{error}</Note> : null}
      {note ? <Note tone="ok">{note}</Note> : null}
      <Card className="flex flex-col gap-3">
        <h2 className="text-[19px] font-semibold">สร้างหมวด</h2>
        <input
          aria-label="ชื่อหมวด"
          className={inputClass}
          value={category.name}
          onChange={(e) => setCategory({ ...category, name: e.target.value })}
          placeholder="ชื่อหมวด"
        />
        <input
          aria-label="slug หมวด"
          className={inputClass}
          value={category.slug}
          onChange={(e) => setCategory({ ...category, slug: e.target.value })}
          placeholder="slug"
        />
        <select
          aria-label="ชนิดหมวด"
          className={inputClass}
          value={category.kind}
          onChange={(e) => setCategory({ ...category, kind: e.target.value })}
        >
          {[
            ["subject", "วิชา"],
            ["category", "หมวด"],
            ["chapter", "บท"],
            ["topic", "หัวข้อย่อย"],
          ].map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </select>
        <select
          aria-label="หมวดหลัก"
          className={inputClass}
          value={category.parentId}
          onChange={(e) =>
            setCategory({ ...category, parentId: e.target.value })
          }
        >
          <option value="">ไม่มีหมวดหลัก</option>
          {data?.categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <Button
          onClick={() =>
            void run(async () => {
              await api("/admin/cms/categories", {
                method: "POST",
                json: { ...category, parentId: category.parentId || null },
              });
              await load();
            })
          }
        >
          สร้างหมวด
        </Button>
        <Field id="taxonomy-delete-reason" label="เหตุผลสำหรับการลบหมวดที่ว่าง">
            <input
              id="taxonomy-delete-reason"
              className={inputClass}
              value={taxonomyReason}
              onChange={(e) => setTaxonomyReason(e.target.value)}
            />
          </Field>
          {data?.categories.map((c) => (
          <div
            key={c.id}
            className="flex flex-wrap items-center gap-2 border-t border-border pt-3"
          >
            <input
              aria-label={`ชื่อหมวด ${c.name}`}
              className={`${inputClass} flex-1`}
              value={c.name}
              onChange={(e) =>
                setData({
                  ...data,
                  categories: data.categories.map((x) =>
                    x.id === c.id ? { ...x, name: e.target.value } : x,
                  ),
                })
              }
            />
            <input
              aria-label={`ลำดับ ${c.name}`}
              type="number"
              className={`${inputClass} max-w-[100px]`}
              value={c.sortOrder}
              onChange={(e) =>
                setData({
                  ...data,
                  categories: data.categories.map((x) =>
                    x.id === c.id
                      ? { ...x, sortOrder: Number(e.target.value) }
                      : x,
                  ),
                })
              }
            />
            <select
              aria-label={`หมวดหลักของ ${c.name}`}
              className={`${inputClass} min-w-[160px] flex-1`}
              value={c.parentId ?? ""}
              onChange={(e) =>
                setData({
                  ...data,
                  categories: data.categories.map((x) =>
                    x.id === c.id
                      ? { ...x, parentId: e.target.value || null }
                      : x,
                  ),
                })
              }
            >
              <option value="">ไม่มีหมวดหลัก</option>
              {data.categories
                .filter((x) => x.id !== c.id)
                .map((x) => (
                  <option key={x.id} value={x.id}>
                    {x.name}
                  </option>
                ))}
            </select>
            <Button
              kind="ghost"
              onClick={() =>
                void run(async () => {
                  await api(`/admin/cms/categories/${c.id}`, {
                    method: "PUT",
                    json: {
                      name: c.name,
                      parentId: c.parentId,
                      sortOrder: c.sortOrder,
                    },
                  });
                  await load();
                })
              }
            >
              บันทึก
            </Button>
            <Button
              kind="ghost"
              disabled={taxonomyReason.trim().length < 3}
              onClick={() =>
                void run(async () => {
                  await api(`/admin/cms/categories/${c.id}`, {
                    method: "DELETE",
                    json: { reason: taxonomyReason },
                  });
                  await load();
                })
              }
            >
              ลบหมวดว่าง
            </Button>
          </div>
        ))}
      </Card>
      <Card className="flex flex-col gap-3">
        <h2 className="text-[19px] font-semibold">รวมหมวดและย้ายบทความ</h2>
        {[
          [from, setFrom, "จากหมวด"],
          [to, setTo, "เข้าหมวด"],
        ].map(([value, setter, label], i) => (
          <Field key={i} id={`merge-${i}`} label={label as string}>
            <select
              id={`merge-${i}`}
              className={inputClass}
              value={value as string}
              onChange={(e) => (setter as (s: string) => void)(e.target.value)}
            >
              <option value="">เลือกหมวด</option>
              {data?.categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </Field>
        ))}
        <input
          aria-label="เหตุผลรวมหมวด"
          className={inputClass}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="เหตุผล"
        />
        <Button
          disabled={!from || !to || reason.length < 3}
          onClick={() =>
            void run(async () =>
              setPlan(
                await api("/admin/cms/merge/preview", {
                  method: "POST",
                  json: { from, to, reason },
                }),
              ),
            )
          }
        >
          แสดงผลกระทบ
        </Button>
        {plan ? (
          <>
            <p>บทความที่ย้าย {plan.affected.length} รายการ</p>
            {plan.affected.map((a) => (
              <p key={a.id}>{a.title}</p>
            ))}
            <Button
              onClick={() =>
                void run(async () => {
                  await api("/admin/cms/merge/commit", {
                    method: "POST",
                    json: { previewId: plan.previewId },
                  });
                  setPlan(null);
                  await load();
                })
              }
            >
              ยืนยันรวมหมวด
            </Button>
          </>
        ) : null}
      </Card>
      <Card className="flex flex-col gap-3">
        <h2 className="text-[19px] font-semibold">ค้นหาและคัดกรองความคิดเห็น</h2>
        <Field
          id="synonyms"
          label="คำค้นพ้อง"
          hint="หนึ่งกลุ่มต่อบรรทัด เช่น ความน่าจะเปน = ความน่าจะเป็น | probability"
        >
          <textarea
            id="synonyms"
            rows={5}
            className={inputClass}
            value={synonyms}
            onChange={(e) => setSynonyms(e.target.value)}
          />
        </Field>
        <Field
          id="words"
          label="คำที่ต้องตรวจความคิดเห็นก่อนเผยแพร่"
          hint="หนึ่งคำต่อบรรทัด"
        >
          <textarea
            id="words"
            rows={5}
            className={inputClass}
            value={words}
            onChange={(e) => setWords(e.target.value)}
          />
        </Field>
      </Card>
      <Card className="flex flex-col gap-4">
        <h2 className="text-[19px] font-semibold">ลำดับส่วนแสดงผลหน้าแรก</h2>
        {home.map((s, i) => (
          <div
            key={s.key}
            className="flex flex-col gap-3 border-t border-border pt-3"
          >
            <div className="flex flex-wrap items-center gap-3">
              <label className="mr-auto flex min-h-[44px] items-center gap-2">
                <input
                  type="checkbox"
                  checked={s.enabled}
                  onChange={(e) =>
                    setHome(
                      home.map((x) =>
                        x.key === s.key
                          ? { ...x, enabled: e.target.checked }
                          : x,
                      ),
                    )
                  }
                />
                {names[s.key]}
              </label>
              {[-1, 1].map((delta) => (
                <Button
                  key={delta}
                  kind="ghost"
                  disabled={i + delta < 0 || i + delta >= home.length}
                  onClick={() => {
                    const next = [...home];
                    [next[i], next[i + delta]] = [next[i + delta]!, next[i]!];
                    setHome(next);
                  }}
                >
                  {delta < 0 ? "ขึ้น" : "ลง"}
                </Button>
              ))}
            </div>
            {["lessons", "news"].includes(s.key) ? (
              <fieldset className="flex flex-wrap gap-3">
                <legend className="text-[14px]">เลือกบทความแนะนำ</legend>
                {articles.map((a) => (
                  <label
                    key={a.id}
                    className="flex min-h-[44px] items-center gap-2 text-[14px]"
                  >
                    <input
                      type="checkbox"
                      checked={s.articleIds.includes(a.id)}
                      onChange={(e) =>
                        setHome(
                          home.map((x) =>
                            x.key === s.key
                              ? {
                                  ...x,
                                  articleIds: e.target.checked
                                    ? [...s.articleIds, a.id]
                                    : s.articleIds.filter((id) => id !== a.id),
                                }
                              : x,
                          ),
                        )
                      }
                    />
                    {a.title}
                  </label>
                ))}
              </fieldset>
            ) : null}
          </div>
        ))}
        <Button
          onClick={() =>
            void run(async () => {
              const pairs = synonyms
                .split("\n")
                .filter((s) => s.trim())
                .map((line) => {
                  const [a, b] = line.split("=");
                  if (!a?.trim() || !b?.trim())
                    throw new Error("รูปแบบคำค้นพ้องไม่ถูกต้อง");
                  return [
                    a.trim(),
                    b
                      .split("|")
                      .map((s) => s.trim())
                      .filter(Boolean),
                  ];
                });
              await api("/admin/cms/settings", {
                method: "PUT",
                json: {
                  synonyms: Object.fromEntries(pairs),
                  moderationWords: words
                    .split("\n")
                    .map((s) => s.trim())
                    .filter(Boolean),
                  home,
                },
              });
            })
          }
        >
          บันทึกการค้นหา คัดกรอง และหน้าแรก
        </Button>
      </Card>
      {data?.events.length ? (
        <Card>
          <h2 className="mb-4 text-[19px] font-semibold">ยอดอ่านและแหล่งที่มา</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[14px]">
              <thead>
                <tr>
                  <th>บทความ</th>
                  <th>กิจกรรม</th>
                  <th>แหล่งที่มา</th>
                  <th>จำนวน</th>
                </tr>
              </thead>
              <tbody>
                {data.events.map((e, i) => (
                  <tr key={i}>
                    <td className="p-2">
                      {articles.find((a) => a.id === e.articleId)?.title ??
                        e.articleId}
                    </td>
                    <td>{e.kind}</td>
                    <td>{e.referrer ?? "โดยตรง"}</td>
                    <td>{e.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      ) : null}
    </>
  );
}
