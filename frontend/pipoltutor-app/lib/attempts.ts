import { BACKEND_URL } from "./api";
import { sessionHeaders } from "./auth";
import type { Attempt, ExamQuestion } from "./exam";

export type AttemptSummary = Attempt & { title: string; slug: string; durationSeconds: number };

export type ReviewedQuestion = ExamQuestion & {
  explanation: string | null;
  selectedChoice: string | null;
  isCorrect: boolean | null;
};

/** Server components: the caller's own attempt, or null (signed out, not theirs, unreachable). */
export async function fetchMyAttempt(id: string): Promise<AttemptSummary | null> {
  try {
    const res = await fetch(`${BACKEND_URL}/attempts/${encodeURIComponent(id)}`, {
      cache: "no-store",
      headers: await sessionHeaders(),
    });
    if (!res.ok) return null;
    return ((await res.json()) as { attempt: AttemptSummary }).attempt;
  } catch {
    return null;
  }
}

/** Server components: per-question review, served only once the attempt is graded. */
export async function fetchMyReview(id: string): Promise<ReviewedQuestion[] | null> {
  try {
    const res = await fetch(`${BACKEND_URL}/attempts/${encodeURIComponent(id)}/review`, {
      cache: "no-store",
      headers: await sessionHeaders(),
    });
    if (!res.ok) return null;
    return ((await res.json()) as { questions: ReviewedQuestion[] }).questions;
  } catch {
    return null;
  }
}
