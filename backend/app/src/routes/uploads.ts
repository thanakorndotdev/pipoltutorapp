import { mkdir } from "node:fs/promises";
import { join, resolve } from "node:path";

import { Elysia, t } from "elysia";

import { adminGuard } from "./admin/guard";

/**
 * Question figures. Admins upload through POST /admin/uploads; the file is
 * written under UPLOAD_DIR (container: a named volume at /app/uploads, host:
 * backend/app/uploads) and served back on GET /uploads/:name. Clients store
 * the public path (/api/uploads/<name>) in questions.imageUrl, so the same
 * value works behind Caddy and through the Next.js dev rewrites.
 */
const UPLOAD_DIR = resolve(process.env.UPLOAD_DIR ?? join(process.cwd(), "uploads"));
const PUBLIC_PREFIX = "/api/uploads";

const IMAGE_TYPES: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
};

/** Stored names are generated here, so anything else is rejected before touching disk. */
const NAME = /^[a-f0-9]{32}\.(png|jpg|webp|gif)$/;

const MAX_BYTES = 5 * 1024 * 1024;

function randomName(ext: string): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return `${Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("")}.${ext}`;
}

export const uploadsRoutes = new Elysia({ prefix: "/uploads" }).get(
  "/:name",
  async ({ params, set }) => {
    if (!NAME.test(params.name)) {
      set.status = 404;
      return { error: "ไม่พบไฟล์" };
    }
    const file = Bun.file(join(UPLOAD_DIR, params.name));
    if (!(await file.exists())) {
      set.status = 404;
      return { error: "ไม่พบไฟล์" };
    }
    set.headers["cache-control"] = "public, max-age=31536000, immutable";
    return file;
  },
  { params: t.Object({ name: t.String({ maxLength: 64 }) }) }
);

export const adminUploadsRoutes = new Elysia({ prefix: "/admin/uploads" })
  .use(adminGuard)
  .post(
    "/",
    async ({ body, set }) => {
      const ext = IMAGE_TYPES[body.file.type];
      if (!ext) {
        set.status = 415;
        return { error: "รองรับเฉพาะรูป PNG, JPEG, WebP หรือ GIF" };
      }
      if (body.file.size > MAX_BYTES) {
        set.status = 413;
        return { error: "ไฟล์ใหญ่เกิน 5 MB" };
      }
      await mkdir(UPLOAD_DIR, { recursive: true });
      const name = randomName(ext);
      await Bun.write(join(UPLOAD_DIR, name), body.file);
      return { url: `${PUBLIC_PREFIX}/${name}`, name, size: body.file.size, type: body.file.type };
    },
    {
      body: t.Object({
        file: t.File({ maxSize: MAX_BYTES }),
      }),
    }
  );
