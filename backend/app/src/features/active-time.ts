import { and, eq } from "drizzle-orm";
import { db } from "../db";
import { attempts } from "../db/schema";
import { fail, type Tx } from "./common";
export async function checkpoint(tx: Tx, id: string, now = new Date()) {
  const [a] = await tx
    .select()
    .from(attempts)
    .where(eq(attempts.id, id))
    .for("update");
  if (!a || a.status !== "in_progress") return;
  const end = Math.min(now.getTime(), a.expiresAt.getTime());
  const last = a.activeCheckpointAt?.getTime();
  const delta = last === undefined ? 0 : Math.max(0, (end - last) / 1000);
  if (last !== undefined && end <= last) return;
  const verified = a.activeVerified && last !== undefined && delta <= 25;
  // A disconnected/suspended gap is not active-time evidence. Keep it for
  // manual review rather than guessing twenty seconds from wall-clock time.
  const acceptedMs = last !== undefined && delta <= 25 ? Math.round(delta * 1000) : 0;
  const totalMs = (a.activeSeconds ?? 0) * 1000 + a.activeRemainderMs + acceptedMs;
  await tx
    .update(attempts)
    .set({
      activeSeconds: Math.floor(totalMs / 1000),
      activeRemainderMs: totalMs % 1000,
      activeVerified: verified,
      activeCheckpointAt: new Date(end),
    })
    .where(eq(attempts.id, id));
}
export async function heartbeat(userId: string, id: string) {
  return db.transaction(async (tx) => {
    const [a] = await tx
      .select()
      .from(attempts)
      .where(and(eq(attempts.id, id), eq(attempts.userId, userId)))
      .for("update");
    if (!a) fail("ไม่พบการสอบ", 404);
    if (a!.status !== "in_progress" || a!.expiresAt <= new Date())
      fail("การสอบสิ้นสุดแล้ว", 409);
    await checkpoint(tx, id);
    return { ok: true };
  });
}
