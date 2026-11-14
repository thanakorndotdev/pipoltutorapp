import { and, isNotNull, lt } from "drizzle-orm";
import { db } from "../db";
import { articleEvents, errorLogs, retentionPolicies } from "../db/features";
import { SYSTEM } from "../audit";
import { auditTx, lock } from "./common";

/**
 * SoW 10.2: categories whose rows nothing else references, so deleting an
 * expired row never breaks a certificate, result, Fire ledger or audit chain.
 * Linked categories (profile, attempts, result revisions, certificates,
 * comments, audit) stay on the Owner-approved lifecycle plan and are never
 * purged here.
 */
export const PURGEABLE = {
  technical_logs: { table: errorLogs, at: errorLogs.createdAt },
  learning_events: { table: articleEvents, at: articleEvents.createdAt },
} as const;
export type PurgeableCategory = keyof typeof PURGEABLE;
export const purgeable = (c: string): c is PurgeableCategory => c in PURGEABLE;

/**
 * Deletes rows older than an Owner-approved retention period. A category with
 * no approval, or approved as "keep" (null days), deletes nothing. Each run that
 * deletes rows writes a system audit entry with the policy version and count.
 */
export async function purgeExpired(now = new Date()) {
  return db.transaction(async (tx) => {
    await lock(tx, "retention:purge");
    const policies = await tx
      .select()
      .from(retentionPolicies)
      .where(
        and(
          isNotNull(retentionPolicies.approvedAt),
          isNotNull(retentionPolicies.days),
        ),
      );
    const result: Record<string, number> = {};
    for (const p of policies) {
      if (!purgeable(p.category)) continue;
      const { table, at } = PURGEABLE[p.category];
      const cutoff = new Date(now.getTime() - p.days! * 86400000);
      const deleted = await tx
        .delete(table)
        .where(lt(at, cutoff))
        .returning({ id: table.id });
      result[p.category] = deleted.length;
      if (deleted.length)
        await auditTx(tx, SYSTEM, {
          module: "audit",
          action: "retention.purge",
          targetId: p.category,
          after: {
            deleted: deleted.length,
            cutoff: cutoff.toISOString(),
            days: p.days,
            policyVersion: p.version,
          },
          reason: "นโยบายระยะเวลาเก็บที่ Owner อนุมัติ",
        });
    }
    return result;
  });
}
