import type { ExamPack } from "./api";
import { formatThaiDateTime } from "./format";

/** What the student can do with a pack right now, from the backend's numbers. */
export type PackAction = "resume" | "start" | "used_up" | "upcoming" | "closed";

export function packAction(p: ExamPack): PackAction {
  if (p.openAttemptId) return "resume";
  if (p.availability === "upcoming") return "upcoming";
  if (p.availability === "closed") return "closed";
  if (p.maxAttempts !== null && p.attemptsUsed >= p.maxAttempts) return "used_up";
  return "start";
}

export function attemptsLabel(p: ExamPack): string {
  if (p.maxAttempts === null) return "ทำได้ไม่จำกัดครั้ง";
  const left = Math.max(0, p.maxAttempts - p.attemptsUsed);
  return p.maxAttempts === 1 ? (left ? "ทำได้ 1 ครั้ง" : "ทำไปแล้ว (ทำได้ 1 ครั้ง)") : `เหลือ ${left} จาก ${p.maxAttempts} ครั้ง`;
}

export function minutes(seconds: number): string {
  return `${Math.round(seconds / 60)} นาที`;
}

/** "เปิด 25 ต.ค. 68 14:00 น. · ปิดรับ 26 ต.ค. 68 00:00 น." — empty when the pack has no window. */
export function windowLabel(p: Pick<ExamPack, "opensAt" | "closesAt">): string {
  const parts = [];
  if (p.opensAt) parts.push(`เปิด ${formatThaiDateTime(p.opensAt)}`);
  if (p.closesAt) parts.push(`ปิดรับ ${formatThaiDateTime(p.closesAt)}`);
  return parts.join(" · ");
}
