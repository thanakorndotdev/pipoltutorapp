import { cookies } from "next/headers";

import { BACKEND_URL } from "./api";
import { SESSION_COOKIE } from "./auth";
import type { PcshsCampusCode } from "./campuses";

/** Mirrors backend/app/src/fortune.ts — the server owns the rules; this is only the shape. */
export type FortuneInput = {
  name: string;
  dob: string;
  birthTime: string | null;
  campus: PcshsCampusCode;
  question: string;
  /** Topic (fortune product title) bought; absent on older readings. */
  topic?: string;
};

export type FortuneResult = {
  version: 2;
  /** "ai" when Cloudflare Workers AI wrote the prose; "rules" for the static fallback. */
  source: "ai" | "rules";
  model?: string;
  birthDay: { key: string; label: string; color: string; planet: string };
  timeBand: { key: string; label: string } | null;
  sections: { study: string; timing: string; caution: string };
  lucky: { numbers: number[]; color: string; item: string };
  answer: { topic: string; text: string };
  schedule: { day: string; focus: string }[];
  closing: string;
  generatedAt: string;
};

export type FortuneReading = {
  id: string;
  input: FortuneInput;
  parentConsent: boolean;
  createdAt: string;
  order: { id: string; status: "pending" | "paid" | "failed" | "refunded"; amountSatang: number } | null;
  unlocked: boolean;
  /**
   * Present only when `unlocked` — the backend withholds it otherwise. An
   * unlocked reading from the list may still be null: the reading is written
   * on the first fetch by id (fetchMyReading), which is where the AI runs.
   */
  result: FortuneResult | null;
};

async function sessionHeader(): Promise<Record<string, string> | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  return token ? { cookie: `${SESSION_COOKIE}=${encodeURIComponent(token)}` } : null;
}

/** Server components: one of the caller's readings, or null (signed out, not theirs, unreachable). */
export async function fetchMyReading(id: string): Promise<FortuneReading | null> {
  const h = await sessionHeader();
  if (!h) return null;
  try {
    const res = await fetch(`${BACKEND_URL}/fortune/readings/${encodeURIComponent(id)}`, { cache: "no-store", headers: h });
    if (!res.ok) return null;
    return ((await res.json()) as { reading: FortuneReading }).reading;
  } catch {
    return null;
  }
}

/** Server components: the caller's readings, newest first; `orderId` narrows to the one that order bought. */
export async function fetchMyReadings(orderId?: string): Promise<FortuneReading[]> {
  const h = await sessionHeader();
  if (!h) return [];
  try {
    const qs = orderId ? `?order=${encodeURIComponent(orderId)}` : "";
    const res = await fetch(`${BACKEND_URL}/fortune/readings${qs}`, { cache: "no-store", headers: h });
    if (!res.ok) return [];
    return ((await res.json()) as { readings: FortuneReading[] }).readings;
  } catch {
    return [];
  }
}
