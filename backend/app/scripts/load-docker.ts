/** Use deployed Linux/Bun runtime for the transport load generator and API. */
import assert from "node:assert/strict";
import { resolve } from "node:path";
import { databaseUrl } from "../src/db/env";
const url = new URL(databaseUrl());
// Docker Desktop (macOS/Windows) reaches the host through host.docker.internal.
// On a Linux server that name does not exist and compose binds PostgreSQL to
// 127.0.0.1, so share the host network instead; the API listens on a random port.
const linux = process.platform === "linux";
if (!linux) url.hostname = "host.docker.internal";
const env = { ...process.env, DATABASE_URL: url.toString() };
const args = [
  "docker",
  "run",
  "--rm",
  ...(linux ? ["--network", "host"] : []),
  "-e",
  "DATABASE_URL",
  "-e",
  "ADMIN_API_KEY",
  "-e",
  "PUBLIC_URL",
  "-e",
  "CERT_DIR",
  "-e",
  "CERT_KEY_DIR",
  "-e",
  "SOW_TEST_DIR",
  "-v",
  `${resolve("src")}:/app/src:ro`,
  "-v",
  `${resolve("scripts")}:/app/scripts:ro`,
  "-v",
  `${resolve("../../manuals")}:/manuals`,
  "-v",
  `${process.env.SOW_TEST_DIR}:${process.env.SOW_TEST_DIR}`,
  "--entrypoint",
  "bun",
  "pipol-backend-sow:local",
  "run",
  "scripts/load-500.ts",
];
const p = Bun.spawn(args, { env, stdout: "inherit", stderr: "inherit" });
assert.equal(await p.exited, 0);
