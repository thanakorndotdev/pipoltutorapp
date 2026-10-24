---
name: exam-engine-rules
description: Invariants for the PIPOL TUTOR mock-exam engine — the answer key never reaches the browser, the server owns the clock, autosave and flag-state contracts, server-side grading, and the per-topic score report. Use when touching exam endpoints, attempts, questions, answers, grading, the timer, or the results screen.
---

# Exam engine invariants

The 100-question timed mock exam is the product's unique mechanism (see `PRODUCT.md`). Its selling point is that the answer key is not reachable from the browser — F12, Network, and View Source reveal nothing. Every rule below exists to keep that true.

## Non-negotiable

1. **The key (`questions.correctChoices`, `questions.acceptedAnswers`) never leaves the server on a student path.** The only exception is `/admin/*`, which sits behind `x-admin-key` and is never called from the student app. No student endpoint, no server component prop, no serialized payload, no error message, no log that ships to the client may contain it. Select columns explicitly when returning questions; never `select().from(questions)` on a client-bound path.
2. **`questions.explanation` is post-submit only.** It is a strong hint about the key. Return it only for an attempt whose status is `submitted`.
3. **The server owns the clock.** `attempts.expiresAt` is computed at start (when the student confirms the instructions screen) from `exam_packs.durationSeconds`, capped at `exam_packs.closesAt`, and is authoritative. The browser countdown is decoration; a client-supplied remaining time or submit timestamp is never trusted.
4. **Grading is server-side only.** Comparing a selected choice to the key happens in the backend, and only there.
5. **Every attempt-scoped request is authorized against `attempts.userId`.** An attempt id in a URL is not proof of ownership.
6. **Exams are free; the gates are profile, publish state, window and attempt limit.** POST /attempts requires a complete student profile (first/last name, nickname, campus), a `published` pack, `opensAt ≤ now < closesAt`, and fewer non-reset attempts than `maxAttempts` (null = unlimited). Staff roles (admin/dev/test) bypass publish, window and limit to test. `pack_products`/entitlements no longer gate exams.

## Data model

Tables live in `backend/app/src/db/schema.ts`:

- `exam_packs` — `questionCount` (target size, default 100), `durationSeconds` (the time the student gets; no multiplier), optional `productId` linking to what unlocks it.
- `exam_packs` also carries `description` (คำชี้แจง), `maxAttempts`, `opensAt`, `closesAt`, `published`, `showReview`.
- `questions` — the bank, independent of packs: `subject` (`question_subject` enum: math / science / general_aptitude / thai / english), `topic`, `prompt`, optional `imageUrl`, `type` (`single` radio / `multiple` checkbox / `short` typed), `points` (numeric, decimals ok), `scoring` (`exact` / `partial`, multiple only), `choices` jsonb as `[{ key: "ก", text: "..." }, ...]` (empty for short), `correctChoices` text[], `acceptedAnswers` text[] (short, exact match), optional `explanation`, `active`. Marking rules live in `src/scoring.ts`.
- `pack_questions` — ordered composition: (`packId`, `questionId`, `position`, optional `section` = ตอน label), unique on both (`packId`,`position`) and (`packId`,`questionId`). A question may sit in several packs. Managed only through `/admin/packs/:id/questions`; refused while any attempt on the pack is live.
- `exam_settings` — single row: `examDate`, `enrollCloseAt`, `urgentDays`. Read via `GET /settings/exam`; written via `PUT /settings/exam` (admin).
- `attempts` — `userId`, `packId`, `status` (`in_progress` | `submitted` | `expired`), `startedAt`, `expiresAt`, `submittedAt`, `score`/`maxScore` (numeric points), `topicBreakdown` jsonb, `attemptNo`, profile snapshot (`studentFirstName`, `studentLastName`, `studentNickname`, `studentCampus`, `studentEmail`) copied at start, `resetAt` (admin reset — kept, not counted), `scoreHistory` (scores replaced by regrade).
- `attempt_answers` — one row per (`attemptId`, `questionId`), unique together: `selectedChoices` text[], `textAnswer`, `state` (`untouched` | `answered` | `flagged`), `isCorrect` (full points; null until graded), `pointsAwarded`, `updatedAt`.

## Flag states

`answer_state` maps directly to the three colours in the question navigator (see `preview/09-exam.html`):

| State | Meaning | Navigator |
| --- | --- | --- |
| `untouched` | never opened or answered | grey, `--border-strong` outline |
| `answered` | a choice is stored | green, `--green` `#16A34A` |
| `flagged` | marked for review | red, `--red` `#EF4444` |

`flagged` is a review marker, not an answer state — a flagged question may also have a `selectedChoice`, and flagging must never clear it. Set `state` to `flagged` while the flag is on and back to `answered`/`untouched` when it is cleared, based on whether a choice is stored.

## Autosave contract

- Every answer or flag change PUTs to the server immediately; there is no batched "save all" and no submit that carries the full answer set.
- The write is an upsert on the `(attemptId, questionId)` unique index — resends and out-of-order retries must be idempotent.
- Reject any write when the attempt is not `in_progress`, or when `now > expiresAt`. Return the attempt's authoritative state so the client can reconcile.
- The client keeps working offline-ish and retries; the UI shows a saved pill (`.pill.saved`) rather than blocking on each write.
- Refreshing mid-exam must restore the exact answer and flag state from the server. Nothing lives only in browser memory or `localStorage`.

## Submit and grading

On submit (or on the first request after `expiresAt`, which grades the attempt as `expired`):

1. Load the key server-side, set `pointsAwarded` and `isCorrect` on each `attempt_answers` row via `scoreAnswer()`. Unanswered scores 0, not null.
2. Write `score` (sum of points), `maxScore` (sum of question points) and `topicBreakdown` as `{ "<topic>": { correct, total, points, maxPoints } }`, keyed by `questions.topic`.
3. Set `status` and `submittedAt`. Grading is idempotent — a second submit must not regrade or change the score.

The result screen shows `score`/`maxScore` as a preliminary total. Per-topic breakdown, per-question points and explanations are served only for a finished attempt on a pack with `showReview` on (staff always).

Regrade (`regradePack` in `src/grading.ts`, `POST /admin/packs/:id/regrade`) re-marks finished attempts against the current key: `apply: false` previews, `apply: true` writes and appends the old score to `scoreHistory`. Answers are never changed.

## Review before merging any exam change

- Does any client-bound payload include `correctChoices` or `acceptedAnswers`? Does an unsubmitted attempt see `explanation`?
- Is the timer checked against `expiresAt` server-side on every write?
- Is `attempts.userId` compared to the session user?
- Is the answer write an upsert, safe to retry?
- Does a mid-exam refresh restore every answer and flag?
