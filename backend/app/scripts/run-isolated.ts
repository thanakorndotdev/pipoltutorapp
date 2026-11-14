import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { sql } from "../src/db";
import { databaseUrl } from "../src/db/env";
const file = process.argv[2];
if (!file) throw new Error("Supply a test script path");
const name = `pipol_sow_test_${randomUUID().replaceAll("-", "")}`,
  dir = await mkdtemp(join(tmpdir(), "pipol-sow-"));
let created = false;
let child: ReturnType<typeof Bun.spawn> | undefined;
const stop = () => child?.kill("SIGTERM");
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
try {
  await sql`create database ${sql(name)}`;
  created = true;
  const url = new URL(databaseUrl());
  url.pathname = `/${name}`;
  const env = {
    ...process.env,
    DATABASE_URL: url.toString(),
    CERT_DIR: join(dir, "files"),
    CERT_KEY_DIR: join(dir, "keys"),
    UPLOAD_DIR: join(dir, "uploads"),
    ADMIN_API_KEY: randomUUID(),
    ALLOW_DEV_AUTH: "0",
    PUBLIC_URL: file.endsWith("qa-server.ts")
      ? "http://127.0.0.1:3004"
      : "http://localhost:3000",
    SOW_TEST_DIR: dir,
  };
  for (const cmd of [
    ["bun", "run", "db:migrate"],
    ["bun", "run", resolve(file)],
  ]) {
    const p = (child = Bun.spawn(cmd, {
      env,
      stdout: "inherit",
      stderr: "inherit",
    }));
    assert.equal(await p.exited, 0, "Isolated test failed");
  }
} finally {
  if (created) await sql`drop database ${sql(name)} with (force)`;
  await sql.end();
  await rm(dir, { recursive: true, force: true });
}
