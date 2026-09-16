---
name: backend
description: Conventions for the PIPOL TUTOR API in backend/app — Bun + ElysiaJS + Drizzle over Postgres, route and validation style, error and status handling, auth/entitlement checks, and what may never be serialized to a client. Use when adding or changing an endpoint, service, query, or backend config.
---

# Backend conventions

API lives in `backend/app`. Stack: Bun runtime, ElysiaJS, Drizzle ORM, `postgres` driver, Postgres 16. Entry point `src/index.ts`, listening on `PORT` (default 3001), reached in production as `/api/*` through Caddy.

## Commands

```bash
cd backend/app
bun run dev     # bun run --watch src/index.ts
bun run start   # production entry; the container runs db:migrate first
```

`bun run test` is still the create-app placeholder (`echo "Error: no test specified" && exit 1`). There is no test suite yet — do not claim a change is "tested" on the strength of that script.

Postgres must be up: `docker compose -f docker/docker-compose.yml up -d postgres`. See the `run-stack` skill.

## Structure

```
src/
  index.ts        Elysia app + routes
  db/
    index.ts      the single pool, `db`, `sql`, `ping()`, `schema`
    schema.ts     tables, enums, relations
    env.ts        databaseUrl() — the only credential source
    seed.ts       bun run db:seed
```

Everything currently sits in `index.ts` because the app is small. As routes grow, split by domain into Elysia plugins (`src/routes/exam.ts` exporting `new Elysia({ prefix: "/exam" })...`) and mount them with `.use(...)`. Keep the chained-builder style — do not switch to a router-object or class pattern partway.

## Database access

- Import `db` from `./db`. Never call `postgres()` or `drizzle()` again; `src/db/index.ts` owns the one pool for the process.
- Never build a connection string inline. `databaseUrl()` in `src/db/env.ts` resolves `DATABASE_URL` (container) or `docker/.env` (host) and is the only place that knows credentials.
- Use the query builder or Drizzle's tagged `sql` for parameterization. Never interpolate user input into a SQL string.
- Schema changes follow the `drizzle-migrate` skill: edit `schema.ts`, `db:generate`, read the SQL, `db:migrate`. Never `db:push` to anything shared.

## Route style

```ts
.get("/health", async ({ set }) => {
  try {
    await ping();
    return { status: "ok", db: "up" };
  } catch (error) {
    set.status = 503;
    return { status: "degraded", db: "down", error: error instanceof Error ? error.message : String(error) };
  }
})
```

- Return plain objects; Elysia serializes them. Do not hand-build `Response` unless you need headers or streaming.
- Set failure codes with `set.status`, as `/health` does — do not return a 200 carrying `{ error: ... }`.
- Validate every request body, query, and param with Elysia's `t` schemas on the route definition. An unvalidated body is a bug even when the happy path works.
- `error instanceof Error ? error.message : String(error)` is the house idiom for narrowing a caught value; keep it.
- Money crossing the API is an integer count of **satang**, named `*Satang`, matching the schema. Formatting to `4,900 บาท` is the frontend's job.

## Authorization

Login is Google OAuth only. Two checks, in this order, on every protected route:

1. **Session** — resolve the user from the session; reject with 401 if absent.
2. **Ownership or entitlement** — an id in the URL proves nothing. Compare `attempts.userId` to the session user, and require a matching `entitlements` row (with `expiresAt` null or in the future) before serving paid content. Order status alone is not access; the entitlement row is.

Return 404 rather than 403 for a resource belonging to another user, so ids are not enumerable.

## What must never be serialized

- `questions.correctChoice` — never in any response, prop, log line, or error message that can reach a client. Select columns explicitly on client-bound paths instead of `select().from(questions)`.
- `questions.explanation` — only for an attempt whose status is `submitted`.
- Raw driver errors on non-diagnostic routes. `/health` deliberately exposes the DB error; product endpoints must not leak connection strings, table names, or stack traces.
- Anything in `orders.gatewayPayload` — opaque third-party data, server-side only.

Full exam rules are in the `exam-engine-rules` skill; load it before touching attempts, answers, grading, or the timer.

## Deployment shape

The container's command is `bun run db:migrate && bun run start`, so a broken migration crash-loops the backend rather than starting it degraded. `DATABASE_URL` is injected by compose; `PORT` comes from `BACKEND_PORT` in `docker/.env`. No host port is published — traffic arrives only via Caddy.
