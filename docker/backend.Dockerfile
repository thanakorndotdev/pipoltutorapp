FROM oven/bun:1-alpine AS base
WORKDIR /app

# The backend app lives at backend/app; build context is the repo root.
COPY backend/app/package.json backend/app/bun.lock* ./
# drizzle-kit is a dev dependency and is needed to run migrations on boot,
# so this is a full install rather than --production.
RUN bun install --frozen-lockfile

COPY backend/app ./

EXPOSE 3001
CMD ["sh", "-c", "bun run db:migrate && bun run start"]
