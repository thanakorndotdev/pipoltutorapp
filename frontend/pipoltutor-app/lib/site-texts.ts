import { fetchSiteTexts, type SiteTexts } from "./api";

/**
 * Copy helpers. Every call site keeps its own literal as the fallback, so the
 * page still reads correctly when the backend (and its registry of defaults)
 * is unreachable. Keys are registered in backend/app/src/site-texts.ts.
 */
export type Copy = {
  /** One string. */
  t: (key: string, fallback: string) => string;
  /** One item per non-empty line. */
  lines: (key: string, fallback: string[]) => string[];
  /** One row per line, columns split on " | ". */
  rows: (key: string, fallback: string[][]) => string[][];
  raw: SiteTexts;
};

export function makeCopy(raw: SiteTexts): Copy {
  const t = (key: string, fallback: string) => (key in raw ? raw[key] : fallback);
  const lines = (key: string, fallback: string[]) =>
    key in raw
      ? raw[key]
          .split("\n")
          .map((l) => l.trim())
          .filter(Boolean)
      : fallback;
  const rows = (key: string, fallback: string[][]) =>
    key in raw ? lines(key, []).map((l) => l.split("|").map((c) => c.trim())) : fallback;
  return { t, lines, rows, raw };
}

/** Server components: `const c = await getCopy();` (one fetch per request). */
export async function getCopy(): Promise<Copy> {
  return makeCopy(await fetchSiteTexts());
}
