import { randomUUID } from "node:crypto";
import { currentUser, hasAdminKey } from "./auth";
import { db } from "./db";
import { auditLogs } from "./db/schema";

export type Actor = { id: string | null; kind: "user" | "api-key" | "system" };

export const SYSTEM: Actor = { id: null, kind: "system" };

/** Who is behind an admin request: the session user, or the shared API key. */
export async function actorOf(headers: Record<string, string | undefined>): Promise<Actor> {
  const user = await currentUser(headers);
  if (user) return { id: user.id, kind: "user" };
  return { id: null, kind: hasAdminKey(headers) ? "api-key" : "system" };
}

/**
 * One audit row. Call it for every change to certificates, statistics, fire,
 * permissions and publishing. Pass redacted before/after: never a secret,
 * a private key or an answer key.
 */
export async function audit(
  actor: Actor,
  entry: { action: string; module: string; targetId?: string | null; before?: unknown; after?: unknown; reason?: string | null; result?: string }
) {
  await db.insert(auditLogs).values({
    actorId: actor.id,
    actorKind: actor.kind,
    action: entry.action,
    module: entry.module,
    targetId: entry.targetId ?? null,
    before: entry.before ?? null,
    after: entry.after ?? null,
    reason: entry.reason ?? null,
    result: entry.result ?? "ok",
    requestId:randomUUID(),
  });
}
