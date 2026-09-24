/**
 * Browser-side calls for a running attempt, through /api (Caddy, or the
 * next.config rewrite in dev). The session cookie rides along. Nothing here
 * ever sees the answer key: the backend grades and only returns scores.
 */

export type QuestionSubject = "math" | "science" | "general_aptitude" | "thai" | "english";

export const SUBJECT_META: Record<QuestionSubject, { label: string; icon: string }> = {
  math: { label: "คณิตศาสตร์", icon: "functions" },
  science: { label: "วิทยาศาสตร์", icon: "science" },
  general_aptitude: { label: "ความสามารถทั่วไป", icon: "extension" },
  thai: { label: "ภาษาไทย", icon: "menu_book" },
  english: { label: "ภาษาอังกฤษ", icon: "translate" },
};

export type AttemptStatus = "in_progress" | "submitted" | "expired";

export type Attempt = {
  id: string;
  packId: string;
  status: AttemptStatus;
  startedAt: string;
  expiresAt: string;
  submittedAt: string | null;
  score: number | null;
  topicBreakdown: Record<string, { correct: number; total: number }> | null;
  allowedSeconds: number;
  /** By the server clock at response time; the browser only counts down from it. */
  secondsLeft: number;
};

export type ExamQuestion = {
  id: string;
  position: number;
  subject: QuestionSubject;
  topic: string;
  prompt: string;
  imageUrl: string | null;
  choices: { key: string; text: string }[];
};

export type SavedAnswer = {
  questionId: string;
  selectedChoice: string | null;
  state: "untouched" | "answered" | "flagged";
};

export class ExamApiError extends Error {
  constructor(
    public status: number,
    message: string
  ) {
    super(message);
  }
}

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api${path}`, {
    cache: "no-store",
    ...init,
    headers: init?.body ? { "content-type": "application/json" } : undefined,
  });
  const data = (await res.json().catch(() => null)) as (T & { error?: string }) | null;
  if (!res.ok) throw new ExamApiError(res.status, data?.error ?? `HTTP ${res.status}`);
  return data as T;
}

/** Start or resume the open attempt on a pack. */
export function startAttempt(packId: string) {
  return call<{ attempt: Attempt; resumed: boolean }>("/attempts", {
    method: "POST",
    body: JSON.stringify({ packId }),
  });
}

/** Questions (no key) plus the answers and flags already saved. */
export function loadAttempt(attemptId: string) {
  return call<{ attempt: Attempt; questions: ExamQuestion[]; answers: SavedAnswer[] }>(
    `/attempts/${attemptId}/questions`
  );
}

/** Autosave one question's full state; safe to resend. */
export function saveAnswer(
  attemptId: string,
  questionId: string,
  value: { selectedChoice: string | null; flagged: boolean }
) {
  return call<{ attempt: Attempt }>(`/attempts/${attemptId}/answers/${questionId}`, {
    method: "PUT",
    body: JSON.stringify(value),
  });
}

/** Finish; the server grades whatever it already holds. */
export function submitAttempt(attemptId: string) {
  return call<{ attempt: Attempt }>(`/attempts/${attemptId}/submit`, { method: "POST" });
}
