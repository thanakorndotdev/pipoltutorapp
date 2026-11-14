import { createHash, randomUUID } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import { db } from "../db";
import { actionPreviews } from "../db/features";
import type { Actor } from "../audit";

export type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
export class DomainError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export const fail = (message: string, status = 422): never => {
  throw new DomainError(status, message);
};
export const hash = (value: unknown) =>
  createHash("sha256")
    .update(
      JSON.stringify(value, (_key, item: unknown) =>
        item && typeof item === "object" && !Array.isArray(item)
          ? Object.fromEntries(
              Object.entries(item).sort(([a], [b]) => a.localeCompare(b)),
            )
          : item,
      ),
    )
    .digest("hex");
export const actorKey = (actor: Actor) => actor.id ?? actor.kind;
export async function lock(tx: Tx, name: string) {
  await tx.execute(
    sql`select pg_advisory_xact_lock(hashtextextended(${name}, 0))`,
  );
}
export const bangkokDay = (now = new Date()) =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
export const addDays = (day: string, n: number) =>
  new Date(Date.parse(`${day}T12:00:00Z`) + n * 86400000)
    .toISOString()
    .slice(0, 10);
export const endOfDay = (day: string) =>
  new Date(`${addDays(day, 1)}T00:00:00+07:00`);
export const validDay = (day: string) =>
  /^\d{4}-\d{2}-\d{2}$/.test(day) &&
  !Number.isNaN(Date.parse(day)) &&
  new Date(day).toISOString().slice(0, 10) === day;
export async function preview(
  module: string,
  targetId: string,
  actor: Actor,
  baseVersion: string,
  payload: unknown,
) {
  const [row] = await db
    .insert(actionPreviews)
    .values({
      module,
      targetId,
      actorKey: actorKey(actor),
      baseVersion,
      payload,
      digest: hash(payload),
      expiresAt: new Date(Date.now() + 15 * 60_000),
    })
    .returning();
  return { previewId: row!.id, digest: row!.digest, expiresAt: row!.expiresAt };
}
export async function consumePreview(
  tx: Tx,
  id: string,
  module: string,
  targetId: string,
  actor: Actor,
  baseVersion: string,
) {
  const [p] = await tx
    .select()
    .from(actionPreviews)
    .where(eq(actionPreviews.id, id))
    .for("update");
  if (
    !p ||
    p.module !== module ||
    p.targetId !== targetId ||
    p.actorKey !== actorKey(actor)
  )
    fail("ไม่พบรายการตัวอย่างนี้", 404);
  if (p!.committedAt) fail("รายการนี้ได้รับการยืนยันแล้ว", 409);
  if (
    p!.expiresAt < new Date() ||
    p!.baseVersion !== baseVersion ||
    p!.digest !== hash(p!.payload)
  )
    fail("ข้อมูลเปลี่ยนแล้ว กรุณาแสดงตัวอย่างใหม่", 409);
  await tx
    .update(actionPreviews)
    .set({ committedAt: new Date() })
    .where(eq(actionPreviews.id, id));
  return p!.payload;
}
export async function auditTx(
  tx: Tx,
  actor: Actor,
  entry: {
    action: string;
    module: string;
    targetId?: string;
    before?: unknown;
    after?: unknown;
    reason?: string;
    revisionId?: string;
    sourceId?: string;
  },
) {
  const { auditLogs } = await import("../db/schema");
  await tx.insert(auditLogs).values({
    actorId: actor.id,
    actorKind: actor.kind,
    action: entry.action,
    module: entry.module,
    targetId: entry.targetId ?? null,
    before: entry.before ?? null,
    after: entry.after ?? null,
    revisionId: entry.revisionId ?? null,
    sourceId: entry.sourceId ?? null,
    reason: entry.reason ?? null,
    requestId: randomUUID(),
    result: "ok",
  });
}
export const safeUrl = (url: string, attachment = false) => {
  if (/^\/api\/(uploads|attachments)\/[a-f0-9]{32}\.[a-z0-9]+$/.test(url))
    return true;
  if (!attachment && /^\/(?!\/)[^\s\\]*$/.test(url)) return true;
  try {
    const u = new URL(url);
    return u.protocol === "https:" && !u.username && !u.password;
  } catch {
    return false;
  }
};
