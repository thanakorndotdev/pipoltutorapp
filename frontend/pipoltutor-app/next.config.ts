import type { NextConfig } from "next";

// Host dev loop only: `bun run dev` on :3000 talks to the backend on :3001
// without Caddy, so /api/* is proxied here. Behind Caddy the /api prefix is
// handled before Next ever sees it.
const backendUrl = process.env.BACKEND_URL ?? "http://localhost:3001";

const nextConfig: NextConfig = {
  async rewrites() {
    return [{ source: "/api/:path*", destination: `${backendUrl}/:path*` }];
  },
};

export default nextConfig;
