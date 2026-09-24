---
name: run-stack
description: Start, verify, and tear down the PIPOL TUTOR local stack (Caddy + Next.js frontend + Elysia backend + Postgres via docker compose), or run backend/frontend on the host with Bun. Use when asked to run, start, restart, or smoke-test the app, when a service is unreachable, or when confirming a change works in the real app rather than in tests.
---

# Running the PIPOL TUTOR stack

## Layout

| Path | What it is |
| --- | --- |
| `docker/docker-compose.yml` | The whole stack. Relative paths resolve against `docker/`, build context is the repo root (`..`). |
| `docker/.env` | Single source of DB credentials. Compose auto-loads it; `backend/app/src/db/env.ts` also reads it for host-side runs. Not committed. |
| `docker/Caddyfile` | Routes `/api/*` to `backend:3001`, everything else to `frontend:3000`, on `localhost`. |
| `backend/app` | Bun + Elysia + Drizzle. Container entrypoint runs `bun run db:migrate && bun run start`. |
| `frontend/pipoltutor-app` | Next.js 16 + React 19 + Tailwind v4, built at image build time. |
| `frontend/admin` | Admin dashboard. Next.js 16 **static export** (`output: "export"`, `basePath: "/admin"`), no server of its own. **Not deployed** (removed from Caddy and compose 2026-09-24); run it with `bun run dev` on :3002. |
| `db/init.sql` | Runs once on an empty Postgres volume. Extensions only — tables come from drizzle migrations. |

## First run

```bash
cp docker/.env.example docker/.env   # then set a real POSTGRES_PASSWORD
docker compose -f docker/docker-compose.yml up -d --build
```

Compose fails fast with `set POSTGRES_USER in docker/.env` if the env file is missing — that error means step one was skipped, not that compose is broken.

## Admin dashboard

```bash
cd frontend/admin
bun run dev                   # :3002, proxies /api/* to BACKEND_URL (default :3001)
```

Not deployed: Caddy has no `/admin` route and compose mounts nothing, so `https://localhost/admin/` is a Next.js 404. The admin API under `/api/admin/*` stays live. Authenticated with `ADMIN_API_KEY` from `docker/.env` (sent as `x-admin-key`; the backend reads it via `hostEnv()` on the host too). Routes: `/admin/` stats, `/admin/questions/` bank, `/admin/packs/` + `/admin/packs/edit/?id=` picker, `/admin/settings/` exam date & time multiplier.

## Everyday commands

```bash
# from docker/, or with -f docker/docker-compose.yml from the repo root
docker compose up -d                 # start
docker compose ps                    # state + health
docker compose logs -f backend       # follow one service
docker compose up -d --build backend # rebuild after a backend change
docker compose down                  # stop, keep the DB volume
docker compose down -v               # stop and DESTROY postgres_data — confirm with the user first
```

Source is baked into the images (`COPY`, plus `bun run build` for the frontend). A code change is not live until that service is rebuilt.

## Verifying it is up

Everything user-facing goes through Caddy on `https://localhost` (it also binds :80 and :443/udp for HTTP/3). The backend and frontend publish no host ports; only Postgres does, on `127.0.0.1:${POSTGRES_PORT:-5432}`.

```bash
curl -sk https://localhost/api/health   # {"status":"ok","db":"up"}
curl -sk https://localhost/api/products
curl -skI https://localhost/            # Next.js
```

`/health` returns 503 with `{"status":"degraded","db":"down"}` and the driver error when Postgres is unreachable — read that error before touching anything else. Caddy uses a local self-signed cert, so `curl` needs `-k`.

## Host-side dev loop (faster iteration)

Postgres still comes from compose; the app processes run on the host.

```bash
docker compose -f docker/docker-compose.yml up -d postgres

cd backend/app && bun run dev          # watch mode on PORT (default 3001)
cd frontend/pipoltutor-app && bun run dev   # next dev on 3000
cd frontend/admin && bun run dev        # next dev on 3002 (/admin/)
```

Host runs have no `DATABASE_URL`, so `src/db/env.ts` reads `docker/.env` and dials `localhost:${POSTGRES_PORT}`. The container hostname `postgres` does not resolve from the host — never hand a host process a `postgres://...@postgres:5432/...` URL. Caddy is not in this path either, so call the backend directly at `http://localhost:3001/...` with no `/api` prefix.

## Troubleshooting

- **Backend container restarting** — it runs `db:migrate` on boot; a failing migration crash-loops it. `docker compose logs backend` shows the SQL error.
- **`/api/*` 502** — backend is down or not yet listening; Caddy has no retry.
- **Port 5432 already in use** — another Postgres on the host. Change `POSTGRES_PORT` in `docker/.env`.
- **Schema looks stale** — `db/init.sql` only runs on a fresh volume. Apply schema changes as migrations (see the `drizzle-migrate` skill), never by editing `init.sql`.
- **Frontend shows old UI** — rebuild; `bun run build` ran at image build time.

## Rules

- Never commit `docker/.env`.
- `docker compose down -v` destroys all local data. Ask before running it.
- Keep credentials in `docker/.env` only — do not add a second `.env` under `backend/app`.
