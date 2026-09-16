import type { NextConfig } from "next";

/**
 * The admin dashboard is a static export served by Caddy under /admin. It
 * has no server of its own: every request for data goes to the Elysia
 * backend at same-origin /api/*, authenticated with x-admin-key.
 *
 * `next dev` (NODE_ENV=development) keeps the dev server on :3002 and proxies
 * /api/* to the backend, since Caddy is not in the host dev loop.
 */
const isDev = process.env.NODE_ENV === "development";
const backendUrl = process.env.BACKEND_URL ?? "http://localhost:3001";

const nextConfig: NextConfig = {
  basePath: "/admin",
  trailingSlash: true,
  // /api/* must reach the backend verbatim; the trailing-slash redirect would
  // turn /api/settings/exam into /api/settings/exam/ first.
  skipTrailingSlashRedirect: true,
  images: { unoptimized: true },
  ...(isDev
    ? {
        async rewrites() {
          return [{ source: "/api/:path*", destination: `${backendUrl}/:path*`, basePath: false as const }];
        },
      }
    : { output: "export" as const }),
};

export default nextConfig;
