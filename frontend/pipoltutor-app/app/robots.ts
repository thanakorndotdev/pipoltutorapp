import type { MetadataRoute } from "next";
import { SITE_ORIGIN } from "@/lib/api";

/** Public pages are indexable; private and per-user areas are not (CMS-09). */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/api/", "/admin/", "/dashboard", "/profile", "/checkout", "/exam/", "/fortune/", "/cert/", "/u/"],
    },
    sitemap: `${SITE_ORIGIN}/sitemap.xml`,
  };
}
