# HANDOFF — PIPOL TUTOR Scope of Work 2026

Updated 2026-11-14 20:20 (+07). Requirements source: `pipoltutor_scope_of_work_2026.pdf` (v1.0, 23 pages). The user asked to complete the whole scope. **Every MUST requirement in CERT-01–15, STAT-01–14, CMS-01–09, FIRE-01–13 and the shared sections (2, 7–11) is implemented and covered by automated or screen evidence.** What remains is acceptance that can only happen on the real deployment, plus commercial cells the developer fills in. Per-item results: `manuals/acceptance-matrix.md` (AC-01–40) and `manuals/sow-requirement-response.md` (SoW 12.4 form).

No commit, push or production deployment was performed. Preserve the user's dirty work; the user handles commits. Do not reset or discard the checkout. A Codex session (`~/.codex/sessions/2026/11/14/rollout-…01a1d602…`) also works in this checkout; check file mtimes before assuming you are alone.

## Status

- [x] M1 certificates: eligibility per pack, one live certificate per attempt, server PNG/PDF, template editor draft/publish/versions, QR Level H, RSA-PSS manifest signature, name matching, rename/reissue, key rotation, deletion consent keep/revoke.
- [x] M2 ranking/statistics: selected attempt policy, competition rank with verified-time tie-break, separate approved reference population, flags never auto-exclude, bulk preview/commit (100 rows tested), official overrides with review flag, immutable revisions/rollback, CSV/XLSX import, student privacy.
- [x] STAT-05: browser activity streams (sequenced, offline-tolerant outbox) + server bounds; offline or multi-tab time is flagged, never added automatically; Admin reviews evidence and certifies cumulative time via preview/audit; certified time drives the tie-break. Never substitute wall-clock time.
- [x] M3 CMS: Lesson/News, multi-level/subject, taxonomy CRUD/merge/aliases, slug redirects, Thai search, safe block editor/KaTeX/tables/media/attachments, approval + scheduled publish, comments/moderation/notifications, views, home sections, SEO/sitemap.
- [x] M4 Daily/Fire: Bangkok day snapshots, two tries, hints/reveal, protect/increase, exam protection, recovery/quota tiers/highest, fixed/fallback/empty day, archive practice + bank copies, regrade choices, CSV/XLSX import, ledger, analytics, outage protect/compensate/bulk_recover/**extend**.
- [x] FIRE-12 Extend (this session): extends **today's** challenge past 23:59:59 for everyone or chosen users, up to 24 h. Allowed only before midnight because the key is revealed and archived after it. While active: key hidden from everyone, day absent from archive, `archiveDaily` skips it, `settleFire` stops before the day, covered learners answer and earn that day's Fire once.
- [x] Shared: module roles/grants with request-time revocation, Owner-only permissions/keys, last-Owner guard, audit/errors, seven-link responsive nav, account menu, Fire/ranking cards, dashboard history now shows pack level/subject (SoW 7.1).
- [x] SoW 10.2 retention (this session): Owner approves days per category; backend hourly purges only unlinked categories (`technical_logs` = `error_logs`, `learning_events` = `article_events`) and audits `retention.purge`. Linked categories are recorded, never auto-deleted.
- [x] Backup/DR: logical restore drill (DB + keys + certificate files + signatures) and encrypted physical PITR drill (fixtures).
- [x] Load: Linux/Docker 500 active users, 5,500 requests, 0 errors.
- [x] Delivery docs: API contract export (163 routes) + notes, user/admin guide, operations guide (env vars, deploy, rollback, backup/PITR, recovery runbooks, retention, post-go-live + training plan), CSV samples, acceptance evidence.
- [ ] Real-deployment acceptance (cannot be done locally): Google OAuth with two real accounts (AC-01), camera QR scan of printed PDF/shared image (AC-05), LINE link preview (AC-21), popup with real accounts (AC-25), restore/PITR + 500-user load on the chosen host with real RPO/RTO/SLA (AC-39, AC-40), Owner approval of retention, off-site backup destination, age identity and backup Owner account.
- [ ] Commercial: prices, schedule, hosting cost, warranty terms in SoW 12.1–12.3 are blank on purpose.

## Architecture / source map

Backend: Bun + Elysia + Drizzle in `backend/app`. `src/app.ts` exports the mounted app without listening; `src/index.ts` starts HTTP, the certificate worker and a 30 s maintenance loop (scheduled publish, ensure today's Daily, archive copy, hourly retention purge). PostgreSQL is the source of truth for locks, previews, revisions and idempotency.

- `src/db/schema.ts`: legacy tables plus articles/certificates/attempt active fields/user staff grants/audit provenance.
- `src/db/features.ts`: ranking configs/decisions/overrides/versions, action previews, taxonomy/CMS revisions/events/comments, Daily responses/snapshots/revisions/extensions, Fire ledger/recovery/summary, activity streams, error/retention/consent tables. Drizzle config loads both files.
- Migrations 0017 articles, 0018 certificates, 0019 SoW modules, 0020 audit provenance, 0021 lost-Fire previousCurrent, 0022 activity evidence, 0023 activity received timestamp, 0024 daily extensions. All additive; all applied to the development DB (25 rows in `drizzle.__drizzle_migrations`). Never edit an applied migration or use db:push on shared data.
- `src/features/{common,ranking,active-time,exam-activity,cms,daily,retention,spreadsheet}.ts`: domain logic. Common payload hash recursively sorts object keys because JSONB reorders them; do not replace with plain JSON.stringify hashes.
- `src/routes/admin/{ranking,articles,daily,operations}.ts`, `src/routes/{articles,daily,exam-activity,lifecycle,media,home,notifications}.ts`, `src/permissions.ts`: new API layers; original exam/grading/profile routes integrate with them.
- `src/certificates/{keys,layout,render,issue,worker,render-process}.ts`: RSA-PSS/SHA-256 canonical manifest; private server PEMs; public key history retained. Worker claims with SKIP LOCKED and renders in a Bun subprocess. One live certificate/attempt and one job/certificate constraints prevent double issue. Running jobs older than 10 min are requeued at startup; failed jobs after 8 retries need admin retry.
- Certificate PNG/PDF files are private under CERT_DIR; keys under CERT_KEY_DIR. Compose persists both. Build context excludes keys/files/uploads. Fonts Mitr/Anuphan bundled with licenses.

Frontend student: `frontend/pipoltutor-app`, Next server components. `/daily` (with extension banner via `pastExtension`), `/articles`, `/cert`, dashboard certificate/notifications/Fire/ranking/deletion components, exam activity hook (`lib/use-exam-activity.ts`, `lib/activity-journal.ts`). Legacy result/history APIs respect published official visibility.

Frontend admin: `frontend/admin`, static export under `/admin`; IDs in query strings, no dynamic segments. `/ranking` (with `TimeReview`), `/daily` (outage form incl. extend deadline), `/cms`, `/comments`, `/operations` (retention shows which categories auto-purge), `/articles`, `/certificates`.

## Verification (local, 2026-11-14 20:17 +07)

| Suite | Command (from `backend/app`) | Result file | Result |
|---|---|---|---|
| SoW | `bun run test:sow` | `manuals/sow-test-result.json` | 27/27 |
| Certificates | `bun run test:certificates` | `manuals/certificate-test-result.json`, `pdf-qr-result.json` | 14/14 |
| Delivery gaps | `bun run test:delivery` | `manuals/delivery-test-result.json` | 8/8 |
| Activity (STAT-05) | `bun run test:activity` | `manuals/activity-test-result.json` | 8/8 |
| Restore / PITR | `bun run test:restore`, `bun run test:pitr` | `restore-drill-result.json`, `pitr-drill-result.json` | earlier run, fixtures |
| Load | `bun run test:load:docker` | `load-500-result.json` | earlier run |
| Contract | `bun run contract:export` | `manuals/api-contract.json` | 163 routes |

Also passed this session: backend + both frontend `tsc --noEmit`, ESLint over both frontends' app/components/lib, `next build --webpack` for both apps. Restore/PITR/load were not re-run this session (their code paths were not touched). The new UI pieces (extend deadline field, extension banner, history level/subject line, retention labels) were type-checked, linted and built but not opened in a browser this session.

Test scripts create/migrate/dispose random databases (need CREATE DATABASE). PITR creates/removes uniquely named Docker fixtures; build `pipol-backend-sow:local` / `pipol-backup-sow:local` first. Postman CLI was unavailable (local keychain crash); API evidence comes from these integration scripts.

## Remaining production work / limits

1. Run the five real-deployment checks listed in `manuals/acceptance-matrix.md` and record evidence before relabelling anything as production PASS.
2. Owner chooses hosting, performance thresholds, off-site backup/WAL destination and retention, private age identity and a backup Owner account. Same-host WAL is not off-site protection.
3. Linked-category retention (profile, attempts, result revisions, certificates, comments, audit) is a recorded policy, executed manually through the lifecycle plan.
4. Search uses bounded candidates (5,000 articles); larger deployments need an index decision. Structured rich content replaces raw HTML; arbitrary font upload is not implemented.
5. Extend cannot reopen a day after midnight (key already public) — use protect/compensate then.
6. Browser-reported offline time is evidence; it always needs a human certification before it affects ranking.

## Working conventions

Read the project `.claude/skills/{backend,frontend,drizzle-migrate,exam-engine-rules,thai-ui,design-system,run-stack}/SKILL.md`. Preserve Thai typography/theme. No secrets in logs, exported schemas, screenshots or frontend bundles. Other users' private objects return 404. Preview risky mutations with reason and source version, then commit atomically; never silently overwrite raw answers. Keep local main services/user data untouched by tests.
