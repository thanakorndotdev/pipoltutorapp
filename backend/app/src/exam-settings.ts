import { eq } from "drizzle-orm";

import { db } from "./db";
import { examSettings } from "./db/schema";

const SETTINGS_KEY = "default";
const DAY_MS = 86_400_000;

export type ExamSettingsRow = typeof examSettings.$inferSelect;

/**
 * Placeholder values from PRODUCT.md ASSUMPTIONS, used only when the settings
 * row has never been written. The seed writes the same row so a fresh DB
 * behaves identically whether or not db:seed has run.
 */
export const DEFAULT_EXAM_SETTINGS = {
  examDate: new Date("2026-01-25T00:00:00+07:00"),
  examVenueLabel: "จภ.",
  enrollCloseAt: new Date("2025-09-30T23:59:59+07:00"),
  urgentDays: 30,
  timeMultiplierPercent: 150,
};

export async function getExamSettings(): Promise<ExamSettingsRow> {
  const [row] = await db
    .select()
    .from(examSettings)
    .where(eq(examSettings.key, SETTINGS_KEY))
    .limit(1);
  if (row) return row;

  const [created] = await db
    .insert(examSettings)
    .values({ key: SETTINGS_KEY, ...DEFAULT_EXAM_SETTINGS })
    .onConflictDoNothing({ target: examSettings.key })
    .returning();
  if (created) return created;

  // Lost the race to another writer; the row exists now.
  const [existing] = await db
    .select()
    .from(examSettings)
    .where(eq(examSettings.key, SETTINGS_KEY))
    .limit(1);
  if (!existing) throw new Error("exam_settings row missing after upsert");
  return existing;
}

export type ExamSettingsPatch = Partial<
  Pick<
    ExamSettingsRow,
    | "examDate"
    | "examVenueLabel"
    | "enrollCloseAt"
    | "urgentDays"
    | "timeMultiplierPercent"
  >
>;

export async function updateExamSettings(
  patch: ExamSettingsPatch
): Promise<ExamSettingsRow> {
  await getExamSettings(); // guarantees the row exists
  const [row] = await db
    .update(examSettings)
    .set({ ...patch, updatedAt: new Date() })
    .where(eq(examSettings.key, SETTINGS_KEY))
    .returning();
  if (!row) throw new Error("exam_settings row missing on update");
  return row;
}

export type CountdownStatus = "upcoming" | "urgent" | "passed";

/**
 * Whole days until the exam, counted from the server clock, and the colour
 * band the countdown should be in. Exposed so the client does not decide.
 */
export function countdownFor(settings: ExamSettingsRow, now = new Date()) {
  const msLeft = settings.examDate.getTime() - now.getTime();
  const daysLeft = Math.max(0, Math.floor(msLeft / DAY_MS));
  const status: CountdownStatus =
    msLeft <= 0 ? "passed" : daysLeft <= settings.urgentDays ? "urgent" : "upcoming";
  return { daysLeft, status };
}

/** Seconds a student actually gets on a pack: duration × multiplier. */
export function allowedSeconds(
  durationSeconds: number,
  timeMultiplierPercent: number
): number {
  return Math.round((durationSeconds * timeMultiplierPercent) / 100);
}

/** Client-safe projection of the settings row plus the derived countdown. */
export function publicExamSettings(settings: ExamSettingsRow, now = new Date()) {
  const { daysLeft, status } = countdownFor(settings, now);
  return {
    examDate: settings.examDate.toISOString(),
    examVenueLabel: settings.examVenueLabel,
    enrollCloseAt: settings.enrollCloseAt.toISOString(),
    urgentDays: settings.urgentDays,
    timeMultiplierPercent: settings.timeMultiplierPercent,
    serverNow: now.toISOString(),
    daysLeft,
    status,
    updatedAt: settings.updatedAt.toISOString(),
  };
}
