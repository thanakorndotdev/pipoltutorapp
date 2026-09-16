---
name: drizzle-migrate
description: Schema-change workflow for the PIPOL TUTOR backend — edit src/db/schema.ts, generate a Drizzle migration, review the SQL, apply it, and seed. Use whenever a table, column, index, enum, or relation changes, when drizzle-kit errors, or when deciding between db:generate/db:migrate and db:push.
---

# Changing the database schema

All schema work happens in `backend/app`. Run every `db:*` script from that directory — `src/db/env.ts` resolves `docker/.env` relative to the current working directory.

## The one workflow

```bash
cd backend/app
# 1. edit src/db/schema.ts
bun run db:generate     # writes drizzle/NNNN_name.sql + drizzle/meta
# 2. READ the generated SQL before applying it
bun run db:migrate      # applies pending migrations
bun run db:seed         # optional, src/db/seed.ts
```

Postgres must be reachable first: `docker compose -f docker/docker-compose.yml up -d postgres`.

## generate/migrate vs push

Use `db:generate` + `db:migrate`. Migration files are the shared history, and the backend container's entrypoint runs `bun run db:migrate` on every boot — a change that exists only as a `db:push` will be missing in Docker and on every other machine.

`db:push` is acceptable only for throwaway local experiments on a database you are willing to drop. Never push against anything shared, and never leave a schema change delivered by push alone.

## Reviewing generated SQL

`drizzle.config.ts` sets `strict: true` and `verbose: true`, so destructive statements prompt. Read `drizzle/NNNN_*.sql` before applying and check for:

- `DROP COLUMN` / `DROP TABLE` — data loss. Confirm with the user.
- A rename that drizzle-kit rendered as drop + add — usually not what you want; edit the SQL to `ALTER ... RENAME` and keep `drizzle/meta` consistent.
- Adding a `NOT NULL` column with no default to a non-empty table — will fail. Add the column nullable, backfill, then set `NOT NULL` (three migrations, or hand-edited SQL in one).
- New enum values — Postgres `ALTER TYPE ... ADD VALUE` cannot run inside a transaction block in older versions; verify it applies.

Never edit a migration that has already been applied anywhere but your own machine. Write a new one.

## Conventions in `src/db/schema.ts`

- Primary keys are `uuid(...).primaryKey().defaultRandom()`. `db/init.sql` creates `pgcrypto` for this.
- Timestamps are `timestamp(..., { withTimezone: true })`. Always pass `withTimezone`.
- Money is an integer count of **satang** (THB × 100) named `*_satang` — `priceSatang`, `amountSatang`. Never a float, never bare baht.
- Enums are `pgEnum` declared at the top of the file: `product_kind`, `order_status`, `attempt_status`, `answer_state`. Extend the existing enum rather than adding a parallel text column.
- Indexes and unique constraints go in the third table argument as an array, named `<table>_<cols>_key` (unique) or `<table>_<cols>_idx` (plain).
- Every new table gets a matching `relations(...)` export beside the existing ones.
- Third-party payloads whose shape is not yet settled are `jsonb` with a comment saying so (`gatewayPayload`, `topicBreakdown`, `choices`, fortune `input`/`result`).
- Keep the column comment style: a short `/** ... */` on anything whose meaning is not obvious from the name, especially security- or ownership-relevant fields.

## Connection and credentials

`src/db/env.ts` is the only place that builds a connection string. In a container, compose injects `DATABASE_URL` and that wins; on the host it parses `docker/.env` and targets `localhost:${POSTGRES_PORT}`. Do not add a second credential source, and do not hardcode a URL in a script — import `databaseUrl()`.

`src/db/index.ts` owns the single pool (`max` from `DATABASE_POOL_MAX`, default 10) and exports `db`, `sql`, `schema`, and `ping()`. Import `db` from there; do not construct another `postgres()` client.

## Inspecting

```bash
cd backend/app && bun run db:studio                      # Drizzle Studio
docker compose -f docker/docker-compose.yml exec postgres psql -U "$POSTGRES_USER" -d "$POSTGRES_DB"
```

## Rules

- `db/init.sql` is for extensions only and runs once on an empty volume. Tables never go there.
- A schema change is not done until `drizzle/` contains the generated migration and it applies cleanly from an empty database.
- Resetting local data means `docker compose down -v`, which destroys `postgres_data`. Confirm with the user first.
