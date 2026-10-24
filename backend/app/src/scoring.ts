/**
 * Pure marking rules, shared by grading at submit time and by regrade.
 * Nothing here touches the database or returns the key to a caller.
 */

export type QuestionType = "single" | "multiple" | "short";
export type ScoringMode = "exact" | "partial";

export type AnswerKey = {
  type: QuestionType;
  points: number;
  scoring: ScoringMode;
  correctChoices: string[];
  acceptedAnswers: string[];
};

export type GivenAnswer = { selectedChoices: string[]; textAnswer: string | null };

const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Points earned on one question.
 *
 * - single: full points when the one picked key is a correct key.
 * - multiple, exact: full points only for exactly the correct set; one
 *   missing or one extra pick scores 0.
 * - multiple, partial: points × (correct picks − wrong picks) / correct keys,
 *   floored at 0, so ticking every box earns nothing.
 * - short: full points when the typed text equals an accepted answer
 *   character for character (case, spaces and "0.5" vs "0.50" all count).
 */
export function scoreAnswer(key: AnswerKey, given: GivenAnswer | undefined): number {
  if (!given) return 0;
  if (key.type === "short") {
    const text = given.textAnswer;
    return text !== null && text !== "" && key.acceptedAnswers.includes(text) ? key.points : 0;
  }
  const picked = new Set(given.selectedChoices);
  const correct = new Set(key.correctChoices);
  if (picked.size === 0 || correct.size === 0) return 0;
  if (key.type === "single") {
    return picked.size === 1 && correct.has([...picked][0]!) ? key.points : 0;
  }
  const hits = [...picked].filter((k) => correct.has(k)).length;
  const wrong = picked.size - hits;
  if (key.scoring === "exact") return hits === correct.size && wrong === 0 ? key.points : 0;
  return round2(Math.max(0, (key.points * (hits - wrong)) / correct.size));
}

export function sumPoints(values: number[]): number {
  return round2(values.reduce((a, b) => a + b, 0));
}
