import { and, eq, lte } from "drizzle-orm";
import { db } from "../db";
import { articles, notifications, type ArticleBlock } from "../db/schema";
import { articleRevisions, comments, featureSettings } from "../db/features";
import { SYSTEM, type Actor } from "../audit";
import { auditTx, fail, lock, safeUrl, type Tx } from "./common";
export type ArticleRow = typeof articles.$inferSelect;
export type PublicArticle = Pick<
  ArticleRow,
  | "id"
  | "slug"
  | "title"
  | "excerpt"
  | "coverUrl"
  | "blocks"
  | "kind"
  | "levels"
  | "subjects"
  | "categoryIds"
  | "tags"
  | "publishedAt"
  | "updatedAt"
  | "sourceUrl"
  | "sourceCredit"
  | "sourceDate"
  | "deadline"
  | "viewMode"
> & { published: true; expired: boolean };
export function publicSnapshot(a: ArticleRow): PublicArticle {
  const p = (a.publishedSnapshot ?? a) as ArticleRow;
  return {
    id: a.id,
    slug: a.slug,
    title: p.title,
    excerpt: p.excerpt,
    coverUrl: p.coverUrl,
    blocks: p.blocks,
    kind: p.kind,
    levels: p.levels,
    subjects: p.subjects,
    categoryIds: p.categoryIds,
    tags: p.tags,
    published: true,
    publishedAt: a.publishedAt,
    updatedAt: p.updatedAt,
    sourceUrl: p.sourceUrl,
    sourceCredit: p.sourceCredit,
    sourceDate: p.sourceDate,
    deadline: p.deadline,
    viewMode: p.viewMode,
    expired: !!p.deadline && new Date(p.deadline) < new Date(),
  };
}
const obj = (v: unknown): Record<string, unknown> =>
  v !== null && typeof v === "object" && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : fail("รูปแบบบล็อกไม่ถูกต้อง");
const str = (v: unknown, max = 20000) =>
  typeof v === "string" && v.length <= max ? v : fail("ข้อความในบล็อกไม่ถูกต้อง");
const num = (v: unknown, min: number, max: number) =>
  typeof v === "number" && Number.isFinite(v) && v >= min && v <= max
    ? v
    : fail("ขนาดในบล็อกไม่ถูกต้อง");
const color = (v: unknown) =>
  /^#[a-f\d]{6}$/i.test(str(v, 7)) ? (v as string) : fail("สีต้องเป็น #RRGGBB");
const align = (v: unknown) =>
  ["left", "center", "right"].includes(String(v))
    ? (v as "left" | "center" | "right")
    : fail("การจัดแนวไม่ถูกต้อง");
export function parseBlocks(value: unknown, depth = 0): ArticleBlock[] {
  if (
    !Array.isArray(value) ||
    value.length > 200 ||
    depth > 3 ||
    JSON.stringify(value).length > 300000
  )
    return fail("จำนวนบล็อกหรือความลึกเกินกำหนด");
  return value.map((raw) => {
    const b = obj(raw),
      type = str(b.type, 20);
    if (["heading", "text", "quote", "code", "callout", "math"].includes(type))
      return { type, text: str(b.text) } as ArticleBlock;
    if (type === "separator") return { type };
    if (type === "rich")
      return {
        type,
        text: str(b.text),
        ...(b.fontSize === undefined
          ? {}
          : { fontSize: num(b.fontSize, 16, 72) }),
        ...(b.color === undefined ? {} : { color: color(b.color) }),
        ...(b.background === undefined
          ? {}
          : { background: color(b.background) }),
        ...(b.align === undefined ? {} : { align: align(b.align) }),
      };
    if (type === "image") {
      const url = str(b.url, 2000);
      if (!safeUrl(url, true) || !str(b.alt, 300).trim())
        fail("รูปต้องมี URL ปลอดภัยและคำอธิบายภาพ");
      return {
        type,
        url,
        alt: str(b.alt, 300),
        caption: str(b.caption ?? "", 300),
        ...(b.width === undefined ? {} : { width: num(b.width, 10, 100) }),
        ...(b.align === undefined ? {} : { align: align(b.align) }),
      };
    }
    if (type === "button" || type === "attachment") {
      const url = str(b.url, 2000);
      if (!safeUrl(url, type === "attachment")) fail("ลิงก์ไม่ปลอดภัย");
      return { type, url, text: str(b.text, 200) };
    }
    if (type === "video") {
      const url = str(b.url, 2000);
      let u: URL;
      try {
        u = new URL(url);
      } catch {
        return fail("URL วิดีโอไม่ถูกต้อง");
      }
      if (
        u.protocol !== "https:" ||
        ![
          "www.youtube.com",
          "youtube.com",
          "youtu.be",
          "www.tiktok.com",
          "tiktok.com",
        ].includes(u.hostname)
      )
        fail("รองรับ YouTube/TikTok เท่านั้น");
      return { type, url, title: str(b.title ?? "วิดีโอ", 200) };
    }
    if (type === "list") {
      if (!Array.isArray(b.items) || b.items.length > 200)
        return fail("รายการไม่ถูกต้อง");
      return {
        type,
        items: b.items.map((x) => str(x, 2000)),
        ordered: b.ordered === true,
      };
    }
    if (type === "columns") {
      if (
        !Array.isArray(b.columns) ||
        b.columns.length < 2 ||
        b.columns.length > 3
      )
        return fail("รองรับ 2–3 คอลัมน์");
      return { type, columns: b.columns.map((c) => parseBlocks(c, depth + 1)) };
    }
    if (type === "table") {
      if (!Array.isArray(b.rows) || b.rows.length > 100)
        return fail("ตารางไม่ถูกต้อง");
      return {
        type,
        rows: b.rows.map((row) => {
          if (!Array.isArray(row) || row.length > 20)
            return fail("คอลัมน์ไม่ถูกต้อง");
          return row.map((rawCell) => {
            const c = obj(rawCell);
            return {
              text: str(c.text, 3000),
              ...(c.rowSpan === undefined
                ? {}
                : { rowSpan: num(c.rowSpan, 1, 100) }),
              ...(c.colSpan === undefined
                ? {}
                : { colSpan: num(c.colSpan, 1, 20) }),
              ...(c.align === undefined ? {} : { align: align(c.align) }),
              ...(c.background === undefined
                ? {}
                : { background: color(c.background) }),
            };
          });
        }),
      };
    }
    return fail("ชนิดบล็อกไม่รองรับ");
  });
}
export async function revision(
  tx: Tx,
  a: ArticleRow,
  actor: Actor,
  action: string,
) {
  const version = a.revision + 1;
  await tx.insert(articleRevisions).values({
    articleId: a.id,
    version,
    snapshot: a,
    actorId: actor.id,
    action,
  });
  await tx
    .update(articles)
    .set({ revision: version })
    .where(eq(articles.id, a.id));
  await auditTx(tx, actor, {
    action: `article.${action}`,
    module: "article",
    targetId: a.id,
    after: { version, workflow: a.workflow },
    revisionId: `${a.id}:${version}`,
  });
}
export async function publishDue(now = new Date()) {
  await db.transaction(async (tx) => {
    await lock(tx, "cms:schedule");
    const due = await tx
      .select()
      .from(articles)
      .where(
        and(
          eq(articles.workflow, "scheduled"),
          lte(articles.scheduledAt, now),
        ),
      )
      .for("update");
    for (const a of due) {
      const after = {
        ...a,
        published: true,
        workflow: "published",
        publishedAt: a.publishedAt ?? now,
        updatedAt: now,
      };
      await tx
        .update(articles)
        .set({
          published: true,
          workflow: "published",
          publishedAt: after.publishedAt,
          publishedSnapshot: after,
        })
        .where(eq(articles.id, a.id));
      await revision(tx, after, SYSTEM, "scheduled_publish");
    }
  });
}
export async function notifyReply(tx: Tx, c: typeof comments.$inferSelect) {
  if (!c.parentId || c.notifiedAt || c.status !== "published") return;
  const [p] = await tx
    .select()
    .from(comments)
    .where(eq(comments.id, c.parentId));
  const [a] = await tx
    .select()
    .from(articles)
    .where(eq(articles.id, c.articleId));
  if (p && a && p.userId !== c.userId)
    await tx.insert(notifications).values({
      userId: p.userId,
      kind: "comment_reply",
      title: "มีคนตอบกลับความคิดเห็นของคุณ",
      body: c.text.slice(0, 160),
      link: `/articles/${a.slug}#comment-${p.id}`,
    });
  await tx
    .update(comments)
    .set({ notifiedAt: new Date() })
    .where(eq(comments.id, c.id));
}
export async function settings<T>(key: string, fallback: T): Promise<T> {
  const [r] = await db
    .select()
    .from(featureSettings)
    .where(eq(featureSettings.key, key));
  return r ? (r.value as T) : fallback;
}
export const searchable = (a: PublicArticle) =>
  [
    a.title,
    a.excerpt,
    a.tags.join(" "),
    a.subjects.join(" "),
    JSON.stringify(a.blocks),
  ]
    .join(" ")
    .normalize("NFC")
    .toLowerCase();
export function nearMatch(text: string, query: string) {
  if (
    text.includes(query) ||
    text
      .replace(/[\u0e47-\u0e4c]/g, "")
      .includes(query.replace(/[\u0e47-\u0e4c]/g, ""))
  )
    return true;
  const a = [...query];
  if (a.length < 3) return false;
  return [
    ...new Intl.Segmenter("th", { granularity: "word" }).segment(text),
  ].some(({ segment }) => {
    const b = [...segment];
    if (Math.abs(a.length - b.length) > 1) return false;
    let row = Array.from({ length: b.length + 1 }, (_, i) => i);
    for (let i = 1; i <= a.length; i++) {
      const next = [i];
      for (let j = 1; j <= b.length; j++)
        next[j] = Math.min(
          next[j - 1]! + 1,
          row[j]! + 1,
          row[j - 1]! + (a[i - 1] === b[j - 1] ? 0 : 1),
        );
      row = next;
    }
    return row[b.length]! <= 1;
  });
}
