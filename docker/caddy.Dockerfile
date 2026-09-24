# Caddy plus the admin dashboard (frontend/admin), which is a static export
# with basePath /admin — Caddy serves it at /admin/ next to /api, so the
# Google session cookie from /api/auth/google/callback reaches it.
#
# Same bun/node split as frontend.Dockerfile: install with bun, build with node.
FROM oven/bun:1-alpine AS deps
WORKDIR /app
COPY frontend/admin/package.json frontend/admin/bun.lock* ./
RUN bun install --frozen-lockfile

FROM node:22-alpine AS admin
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY frontend/admin ./
RUN npm run build

FROM caddy:2-alpine
COPY --from=admin /app/out /srv/admin
