> Historical M1 checkpoint. Later work resolved several limits below. For the current 13-group certificate result, roles/deletion/QR coverage and production limits, use [acceptance-matrix.md](acceptance-matrix.md) and [certificate-test-result.json](certificate-test-result.json).

# M1 certificate continuation — 2026-11-13

Scope: finish the existing admin integration and deployment configuration from HANDOFF.md. This is not evidence that the whole SoW is complete.

## Changes

- Pack create/edit now carries all seven certificate settings: level, subject, enabled, automatic submit, hard cutoff, reset/reopen, and template. New packs reject unpublished templates just as pack updates do.
- Existing template drag placement, background crop/zoom, font selection, ordering and long-name preview are retained. Added full-resolution PDF preview of the unsaved layout, configurable line spacing (minimum 1.6 for Thai), keyboard-editable X/Y coordinates, and pointer cancellation handling.
- Template saves and pack certificate metadata changes now write audit entries.
- Generated files and signing keys have persistent Compose volumes. Runtime data and PEM keys are excluded from build context; the Dockerfile fails if runtime folders enter the image.
- Fixed the student build: CertificateSheet imported a URL helper from a module that also loaded server session APIs. The helper now has a client-safe module, and the fetching module is marked server-only.
- Source/image finish review found the student sheet forced portrait certificates into a landscape frame. Completed images now use their intrinsic proportions (`h-auto w-full`); the reviewer confirmed this finding resolved, with no material findings left in the reviewed scope.

## Repeatable checks

Run from `backend/app`:

```sh
bun run test:certificates
bun run scripts/certificate-render-smoke.ts
../../frontend/pipoltutor-app/node_modules/.bin/tsc --noEmit -p .
```

The integration command creates a uniquely named temporary database using the configured server, applies all migrations from empty, and cleans up its database/files/keys even after an assertion failure. It does not share the application's live worker or certificate storage. It requires a PostgreSQL role with CREATE DATABASE permission.

Eight passing test groups cover:

1. Admin authentication.
2. Rejection of unpublished templates when creating packs (reproduced as HTTP 201 before the fix, now HTTP 422).
3. Draft save audit and published version with line spacing.
4. PNG/PDF previews for both A4 orientations and both long-name samples; invalid spacing rejected.
5. Pack create/update round-trip of all certificate settings.
6. AC-08: six concurrent issue requests return one certificate; deliberately block the output directory for the first render, assert retry backoff, restore storage and advance the test job's due date; retry succeeds using the same certificate and job IDs.
7. Anonymous/other-user download denial, identical repeated PNG/PDF downloads, private/no-store file responses, public privacy, tamper rejection and old-signature verification after key rotation.
8. Name change revokes the original and renders a replacement with a new public ID and current profile name.

Other checks:

- Admin targeted ESLint and backend TypeScript passed.
- Admin and student production builds passed with `bun run build --webpack`, including their TypeScript checks. Turbopack's default build failed at process/port creation with `Operation not permitted`, including after an escalation attempt; the Webpack build does not require that mechanism. No project build command was changed.
- Compose configuration validation passed.
- Backend Alpine image built with the frozen Bun lockfile. The native render smoke command also passed inside Alpine, loading bundled Mitr/Anuphan and rendering four PNG/PDF pairs. Landscape dimensions: 3000×2121; portrait: 2121×3000. Every PDF has exactly one A4 page in the selected orientation.
- Rendered landscape English-name and portrait Thai-name samples visually inspected: no clipped marks or overlapping content. Preview PDFs are raster images on A4 pages.
- Impeccable's mechanical detector returned no findings on the two changed admin UI targets.
- Fixed key-directory ignore rule verified with `git check-ignore`; PEM files were already ignored by the generic rule, while other key-directory files previously were not. Docker previously copied the whole backend directory without excluding runtime data.

## Limits and remaining work

- Browser interaction/desktop/mobile screenshots remain unverified: the browser automation host is unavailable, and native Chrome reached the admin login screen. Source checks and API tests do not establish successful interactive drag/drop or phone layout.
- A human must scan QR codes from full-size and reduced PNG/PDF output (AC-05).
- Existing M1 gaps remain in HANDOFF.md: account-deletion policy, Owner-only key management/key-read auditing, score-bearing certificate updates after regrade, and cross-process name-check rate limiting.
- No production deployment, commit, or push was performed.
