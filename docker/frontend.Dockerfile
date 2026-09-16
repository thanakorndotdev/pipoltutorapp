FROM oven/bun:1-alpine AS base
WORKDIR /app

# The frontend app lives at frontend/pipoltutor-app; build context is the repo root.
COPY frontend/pipoltutor-app/package.json frontend/pipoltutor-app/bun.lock* ./
RUN bun install --frozen-lockfile

COPY frontend/pipoltutor-app ./
RUN bun run build

EXPOSE 3000
CMD ["bun", "run", "start"]
