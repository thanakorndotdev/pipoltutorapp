import { cache } from "react";

/**
 * Server-side base URL for the Elysia backend. In Docker the service is
 * `backend:3001`; on the host it is localhost:3001. Browser code never uses
 * this — it calls the same-origin `/api/*` path instead.
 */
export const BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:3001";

export type Product = {
  id: string;
  slug: string;
  kind: "course" | "exam_pack" | "bundle" | "fortune";
  title: string;
  description: string | null;
  priceSatang: number;
  active: boolean;
  badge: string | null;
  unit: string | null;
  ctaLabel: string | null;
  features: string[];
  featured: boolean;
  sortOrder: number;
};

export async function fetchProducts(): Promise<Product[]> {
  const res = await fetch(`${BACKEND_URL}/products`, { cache: "no-store" });
  if (!res.ok) throw new Error(`GET /products failed: ${res.status}`);
  return (await res.json()) as Product[];
}

export type CountdownStatus = "upcoming" | "urgent" | "passed";

/** GET /settings/exam — public projection of the exam_settings row. */
export type ExamSettings = {
  examDate: string;
  examVenueLabel: string;
  enrollCloseAt: string;
  urgentDays: number;
  serverNow: string;
  daysLeft: number;
  status: CountdownStatus;
  updatedAt: string;
};

export async function fetchExamSettings(): Promise<ExamSettings> {
  const res = await fetch(`${BACKEND_URL}/settings/exam`, { cache: "no-store" });
  if (!res.ok) throw new Error(`GET /settings/exam failed: ${res.status}`);
  return (await res.json()) as ExamSettings;
}

export type PackAvailability = "upcoming" | "open" | "closed";

/** GET /exam-packs — pack metadata, window and the session user's attempt count. Never questions. */
export type ExamPack = {
  id: string;
  slug: string;
  title: string;
  /** คำชี้แจง written by the admin. */
  description: string | null;
  questionCount: number;
  durationSeconds: number;
  /** null = unlimited. */
  maxAttempts: number | null;
  opensAt: string | null;
  /** Hard deadline: attempts end here even with time left. */
  closesAt: string | null;
  published: boolean;
  showReview: boolean;
  availability: PackAvailability;
  /** Attempts used by the session user (reset ones excluded). */
  attemptsUsed: number;
  /** The session user's running attempt, if any. */
  openAttemptId: string | null;
  allowedSeconds: number;
};

/** GET /exam-packs/:slug adds what the instructions screen shows. */
export type ExamPackDetail = ExamPack & {
  summary: {
    questions: number;
    totalPoints: number;
    /** In paper order; a pack without ตอน labels is one section with an empty title. */
    sections: { title: string; questions: number; points: number }[];
    types: { single: number; multiple: number; short: number };
  };
};

/** `headers` carries the session cookie (see sessionHeaders() in lib/auth) so attempt counts are the student's. */
export async function fetchExamPack(slug: string, headers?: HeadersInit): Promise<ExamPackDetail> {
  const res = await fetch(`${BACKEND_URL}/exam-packs/${encodeURIComponent(slug)}`, {
    cache: "no-store",
    headers,
  });
  if (!res.ok) throw new Error(`GET /exam-packs/${slug} failed: ${res.status}`);
  return ((await res.json()) as { pack: ExamPackDetail }).pack;
}

/** GET /exam-packs — published packs, alphabetical. */
export async function fetchExamPacks(headers?: HeadersInit): Promise<ExamPack[]> {
  const res = await fetch(`${BACKEND_URL}/exam-packs`, { cache: "no-store", headers });
  if (!res.ok) throw new Error(`GET /exam-packs failed: ${res.status}`);
  return ((await res.json()) as { packs: ExamPack[] }).packs;
}

/** GET /site/assets — admin-managed images keyed by slot; only set slots appear. */
export type SiteAsset = { imageUrl: string; alt: string; updatedAt: string };
export type SiteAssets = Record<string, SiteAsset>;

/**
 * Never throws: an unreachable backend just means every slot shows its
 * placeholder, which must not take the whole page down. Wrapped in React
 * cache() so the layout and generateMetadata share one request per render.
 */
export const fetchSiteAssets = cache(async (): Promise<SiteAssets> => {
  try {
    const res = await fetch(`${BACKEND_URL}/site/assets`, { cache: "no-store" });
    if (!res.ok) throw new Error(`GET /site/assets failed: ${res.status}`);
    return ((await res.json()) as { assets: SiteAssets }).assets;
  } catch (error) {
    // Next's static-prerender bailout must propagate so the route stays dynamic.
    if (error instanceof Error && error.message.includes("Dynamic server usage")) throw error;
    console.error("site assets unavailable, using placeholders:", error);
    return {};
  }
});

/** GET /site/texts — admin-editable copy, override applied over default, keyed by slot. */
export type SiteTexts = Record<string, string>;

export const fetchSiteTexts = cache(async (): Promise<SiteTexts> => {
  try {
    const res = await fetch(`${BACKEND_URL}/site/texts`, { cache: "no-store" });
    if (!res.ok) throw new Error(`GET /site/texts failed: ${res.status}`);
    return ((await res.json()) as { texts: SiteTexts }).texts;
  } catch (error) {
    if (error instanceof Error && error.message.includes("Dynamic server usage")) throw error;
    console.error("site texts unavailable, using built-in copy:", error);
    return {};
  }
});
