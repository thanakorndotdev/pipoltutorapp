# Node, not Bun: bun 1.2.x and 1.3.x both segfault while running `next build`
# (Next 16) on alpine/arm64. Lockfile is still bun.lock, so install with bun
# in a helper stage and build/run with node.
FROM oven/bun:1-alpine AS deps
WORKDIR /app
COPY frontend/pipoltutor-app/package.json frontend/pipoltutor-app/bun.lock* ./
RUN bun install --frozen-lockfile

FROM node:22-alpine AS base
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY frontend/pipoltutor-app ./
RUN npm run build

EXPOSE 3000
CMD ["npm", "run", "start"]
