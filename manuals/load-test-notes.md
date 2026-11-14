# Load evidence — 500 active virtual users

Latest successful run: `load-500-result.json`. All traffic and accounts are synthetic in a disposable migrated database. Source: `backend/app/scripts/load-500.ts`; deployed-runtime wrapper `load-docker.ts`.

- 500 separate authenticated accounts/sessions start concurrently, each runs ten actions without think time. Total 5,500 measured HTTP requests. The client can have 500 pending user actions; Bun's fetch connection pool limits simultaneous server requests to about 256. This is a 500 active-user workload, not proof of 500 simultaneous certificate renders.
- Profile: 150 article readers, 75 searchers, 75 daily users, 75 rank readers, 50 exam submitters/readers, 25 certificate downloaders, 25 public verifiers, 25 admin preview users. Every user first exercises actual session validation. The exam group creates 50 queued certificates and the test waits for every job to finish. Google provider authorization and external-network latency are excluded.
- Latest successful runtime: Linux arm64 Bun1.3.14 in the built backend image, with PostgreSQL16 reached through Docker's host gateway; DB pool10, render concurrency1. HTTP client and API share local loopback inside that container. No production hardware quota/cost has been agreed or measured here.
- Latest result: 5,500 requests, **0 errors**, 21.23s, 259.03 requests/s. Overall p95 2,395ms. p95 session234ms; article2,064ms; search2,878ms; daily submit1,626ms; rank2,391ms; exam submit5,483ms; certificate download2,232ms; admin preview3,818ms. All50 new certificate jobs completed; post-traffic drain9.67s.
- Previous macOS/Bun1.2.23 runs were inconsistent during the initial cold connection burst: one run0 errors, others5 or50 transport errors (status0 socket close/connect failure), followed by0 endpoint errors. `load-500-first-run.json` and `load-500-macos-transport-failure.json` retain failures. Docker/Linux completed with0 errors. The evidence distinguishes runtimes; it does not prove a precise Bun/OS root cause or erase the failed runs.

Repeat the Linux test after building the image, from `backend/app`:

```sh
# from repository root first:
# docker build -f docker/backend.Dockerfile -t pipol-backend-sow:local .
bun run scripts/run-isolated.ts scripts/load-docker.ts
```

The test asserts exactly500 client peak, zero errors and completed certificate jobs. It writes measured output before asserting, so a failed result is retained. Do not replace failures with invented averages or silently retry writes to make error rate disappear.

Proposed thresholds for the real-host acceptance run (not an Owner-approved SLA): p95 session<=1s; article/rank/result/download<=3s; search<=3.5s; Daily submit<=2s; Exam submit<=6s; import preview<=4.5s; HTTP error rate<0.1%; 50-job post-burst certificate drain<=20s. Re-run on the selected host with external clients, agreed sustained duration, actual data size, provider login flow, bandwidth and backup workload before committing to hosting capacity/cost. A local short burst does not establish sustained production capacity.
