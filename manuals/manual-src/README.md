# Sources of the manual PDFs

- `manual/manual.html` — the manual (Thai, A4). Edit text here.
- `shots/` — screenshots taken 2026-11-21 from a throwaway demo stack (all names, emails, scores and amounts are made up).
- Rebuild the PDF (writes `manuals/คู่มือการใช้งาน-PIPOL-TUTOR.pdf`; needs `bun install` in `frontend/pipoltutor-app` for Playwright, and internet for the Google Fonts):

```sh
node manuals/manual-src/manual/render.mjs
```

If the admin or student UI changes noticeably, retake the affected screenshot and keep its file name.

## Deploy guide (`manuals/คู่มือ-Deploy-PIPOL-TUTOR.pdf`)

- `deploy/body.html` — the content. Edit here, not `deploy/deploy.html` (generated).
- Rebuild (reuses the user manual's stylesheet):

```sh
sh manuals/manual-src/deploy/build.sh
```

Every command in the guide was run against a throwaway compose project on 2026-11-21 (nightly backup, restore into a new database and rename, file restore). Re-test any command you change.
