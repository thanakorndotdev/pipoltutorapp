import type { MetadataRoute } from "next";
import { BACKEND_URL, SITE_ORIGIN } from "@/lib/api";
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const origin = SITE_ORIGIN;
  const base = ["", "/articles", "/daily", "/courses", "/about"].map(
    (path) => ({ url: `${origin}${path}`, lastModified: new Date() }),
  );
  try {
    const r = await fetch(`${BACKEND_URL}/articles?limit=100`, {
      cache: "no-store",
    });
    if (!r.ok) return base;
    const d = (await r.json()) as {
      articles: { slug: string; updatedAt: string }[];
      total: number;
    };
    let list = d.articles;
    for (let offset = 100; offset < d.total && offset < 5000; offset += 100) {
      const n = await fetch(
        `${BACKEND_URL}/articles?limit=100&offset=${offset}`,
        { cache: "no-store" },
      );
      if (n.ok) list = list.concat((await n.json()).articles);
    }
    return [
      ...base,
      ...list.map((a) => ({
        url: `${origin}/articles/${a.slug}`,
        lastModified: new Date(a.updatedAt),
      })),
    ];
  } catch {
    return base;
  }
}
