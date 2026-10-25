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
  /** Points earned; may be fractional. */
  score: number | null;
  maxScore: number | null;
  topicBreakdown: Record<string, { correct: number; total: number; points?: number; maxPoints?: number }> | null;
  attemptNo: number;
  /** Set when an admin reset the student's quota on this pack. */
  resetAt: string | null;
  allowedSeconds: number;
  /** By the server clock at response time; the browser only counts down from it. */
  secondsLeft: number;
};

/** single = radio, multiple = checkbox, short = typed answer. */
export type QuestionType = "single" | "multiple" | "short";

export type ExamQuestion = {
  id: string;
  position: number;
  /** ตอน label; null when the pack has no sections. */
  section: string | null;
  subject: QuestionSubject;
  topic: string;
  type: QuestionType;
  points: number;
  prompt: string;
  /** In display order; empty for none. */
  imageUrls: string[];
  /** Empty for "short". */
  choices: { key: string; text: string }[];
};

export type SavedAnswer = {
  questionId: string;
  selectedChoices: string[];
  textAnswer: string | null;
  state: "untouched" | "answered" | "flagged";
};

export type AnswerValue = { selectedChoices: string[]; textAnswer: string | null; flagged: boolean };

export class ExamApiError extends Error {
  constructor(
    public status: number,
    message: string,
    /** Machine-readable reason from the backend, e.g. "profile_required". */
    public code?: string
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
  const data = (await res.json().catch(() => null)) as (T & { error?: string; code?: string }) | null;
  if (!res.ok) throw new ExamApiError(res.status, data?.error ?? `HTTP ${res.status}`, data?.code);
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
  return call<{ attempt: Attempt; questions: ExamQuestion[]; answers: SavedAnswer[]; paperUrl: string | null }>(
    `/attempts/${attemptId}/questions`
  );
}

/** Autosave one question's full state; safe to resend. */
export function saveAnswer(attemptId: string, questionId: string, value: AnswerValue) {
  return call<{ attempt: Attempt }>(`/attempts/${attemptId}/answers/${questionId}`, {
    method: "PUT",
    body: JSON.stringify(value),
  });
}

/** Finish; the server grades whatever it already holds. */
export function submitAttempt(attemptId: string) {
  return call<{ attempt: Attempt }>(`/attempts/${attemptId}/submit`, { method: "POST" });
}
