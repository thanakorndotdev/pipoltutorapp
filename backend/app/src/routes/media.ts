import { mkdir, readdir } from "node:fs/promises";
import { join, resolve } from "node:path";
import { randomBytes } from "node:crypto";
import JSZip from "jszip";
import { Elysia, t } from "elysia";
import { eq, like } from "drizzle-orm";
import { db } from "../db";
import { featureSettings } from "../db/features";
import { fail } from "../features/common";
import { authorize } from "../permissions";
import { adminGuard } from "./admin/guard";
const directory = resolve(
  process.env.UPLOAD_DIR ?? join(process.cwd(), "uploads"),
);
const mime: Record<string, string> = {
  pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
};
const NAME = /^[a-f0-9]{32}\.(pdf|docx|xlsx|pptx)$/;
export const attachmentsRoutes = new Elysia({ prefix: "/attachments" }).get(
  "/:name",
  async ({ params, set }) => {
    if (!NAME.test(params.name)) fail("ไม่พบไฟล์", 404);
    const file = Bun.file(join(directory, params.name));
    if (!(await file.exists())) fail("ไม่พบไฟล์", 404);
    set.headers["content-type"] = mime[params.name.split(".").at(-1)!]!;
    set.headers["content-disposition"] =
      `attachment; filename="${params.name}"`;
    set.headers["x-content-type-options"] = "nosniff";
    set.headers["content-security-policy"] = "sandbox";
    return file;
  },
  { params: t.Object({ name: t.String({ maxLength: 64 }) }) },
);
export const adminMediaRoutes = new Elysia({ prefix: "/admin/media" })
  .use(adminGuard)
  .get("/", async () => {
    const records = await db
      .select()
      .from(featureSettings)
      .where(like(featureSettings.key, "media.%"));
    const names = await readdir(directory).catch(() => [] as string[]);
    return {
      media: names
        .filter((n) =>
          /^[a-f0-9]{32}\.(png|jpg|gif|webp|pdf|docx|xlsx|pptx)$/.test(n),
        )
        .map((n) => ({
          name: n,
          url: `/api/${NAME.test(n) ? "attachments" : "uploads"}/${n}`,
          metadata: records.find((r) => r.key === `media.${n}`)?.value ?? null,
        })),
    };
  })
  .post(
    "/attachments",
    async ({ body }) => {
      const ext = body.file.name.split(".").at(-1)?.toLowerCase();
      if (!ext || !mime[ext!] || body.file.type !== mime[ext!])
        fail("รองรับ PDF และ Office (.docx/.xlsx/.pptx) ไม่เกิน 10 MB", 415);
      const bytes = Buffer.from(await body.file.arrayBuffer());
      if (ext === "pdf") {
        if (
          !bytes.subarray(0, 5).equals(Buffer.from("%PDF-")) ||
          /\/(JavaScript|JS|Launch|EmbeddedFile)\b/.test(
            bytes.toString("latin1"),
          )
        )
          fail("ไฟล์ PDF ไม่ผ่านการตรวจชนิดหรือมี active content", 415);
      } else {
        if (bytes[0] !== 0x50 || bytes[1] !== 0x4b)
          fail("ชนิดไฟล์ไม่ตรงกับ Office", 415);
        let zip: JSZip;
        try {
          zip = await JSZip.loadAsync(bytes);
        } catch {
          return fail("โครงสร้างไฟล์ Office ไม่ถูกต้อง", 415);
        }
        const names = Object.keys(zip.files);
        const folder =
          ext === "docx" ? "word/" : ext === "xlsx" ? "xl/" : "ppt/";
        if (
          !names.includes("[Content_Types].xml") ||
          !names.some((n) => n.startsWith(folder)) ||
          names.some((n) => /vba|activex|oleobjects|embeddings|\.exe$/i.test(n))
        )
          fail("ไฟล์ Office มีชนิดหรือเนื้อหาที่ไม่รองรับ", 415);
      }
      await mkdir(directory, { recursive: true });
      const name = `${randomBytes(16).toString("hex")}.${ext}`;
      await Bun.write(join(directory, name), bytes);
      const url = `/api/attachments/${name}`;
      await db
        .insert(featureSettings)
        .values({
          key: `media.${name}`,
          value: {
            url,
            name: body.file.name,
            type: mime[ext!],
            size: bytes.length,
            alt: "",
            caption: "",
          },
        });
      return { url, name, size: bytes.length, type: mime[ext!] };
    },
    { body: t.Object({ file: t.File({ maxSize: 10 * 1024 * 1024 }) }) },
  )
  .put(
    "/:name",
    async ({ params, body }) => {
      if (!/^[a-f0-9]{32}\.[a-z]+$/.test(params.name)) fail("ไม่พบไฟล์", 404);
      const key = `media.${params.name}`;
      await db
        .insert(featureSettings)
        .values({ key, value: body })
        .onConflictDoUpdate({
          target: featureSettings.key,
          set: { value: body },
        });
      return { ok: true };
    },
    {
      params: t.Object({ name: t.String({ maxLength: 64 }) }),
      body: t.Object({
        alt: t.String({ maxLength: 300 }),
        caption: t.String({ maxLength: 300 }),
      }),
    },
  );
