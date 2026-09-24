# PIPOL TUTOR backend

Bun + ElysiaJS + Drizzle ORM over Postgres. It serves the student site and the admin dashboard. The whole-stack docs (setup, env vars, admin, deployment) are in the [root README](../../README.md). This file only covers working inside `backend/app`.

## Run

```bash
docker compose -f ../../docker/docker-compose.yml up -d postgres   # DB only
bun install
bun run dev        # watch mode, http://localhost:3001 (PORT overrides)
bun run start      # no watch; what the container runs after db:migrate
```

Config comes from `../../docker/.env`, which `src/db/env.ts` reads on the host. On the host, call the API at `http://localhost:3001/...` with no `/api` prefix. That prefix is added by Caddy in Docker and by the Next.js dev proxies.

Keep only one process on port 3001. A leftover non-watch `bun run src/index.ts` keeps serving old code.

## Database

```bash
bun run db:generate   # after editing src/db/schema.ts; review drizzle/*.sql
bun run db:migrate    # apply migrations
bun run db:seed       # idempotent; inserts products once, never overwrites admin edits
bun run db:studio     # browse data
bun run e2e:session [email] [role]   # print a session token for the Playwright suite
```

## Layout

| Path | What it holds |
| --- | --- |
| `src/index.ts` | App entry: health, public `/products`, mounts every route group |
| `src/db/` | `schema.ts`, connection, env loading, seed |
| `src/routes/` | Public and student routes: auth, orders, payments and webhooks, exam packs and attempts, fortune, site CMS, uploads, settings |
| `src/routes/admin/` | Admin routes behind `guard.ts` (`x-admin-key` or an admin session): stats, questions, packs, products, users |
| `src/auth.ts`, `src/sessions.ts` | Current user, roles, dev-auth header, session cookies |
| `src/payments/omise.ts` | Omise charges; marks orders paid and grants entitlements |
| `src/fortune.ts`, `src/ai/cloudflare.ts` | Fortune rules and Workers AI prose |
| `src/exam-settings.ts` | Exam date, countdown and time-multiplier logic |
| `drizzle/` | Generated SQL migrations |
| `uploads/` | Uploaded question figures |

## Rules worth remembering

- **Correct answers:** `questions.correctChoice` is only ever returned under `/admin/*`. Student endpoints never serialize it.
- **Money:** always integer satang. An order copies the product price into `amountSatang` when it is created.
- **Deleting products:** a product with any order or entitlement cannot be deleted; set `active = false` instead.
- **Detailed conventions:** see `../../.claude/skills/backend`, `exam-engine-rules` and `drizzle-migrate`.
