/** End-to-end encrypted backup + point-in-time recovery, isolated Docker fixtures. */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
const prefix = `pipol-pitr-${randomUUID().slice(0, 8)}`;
const dir = await mkdtemp(join(tmpdir(), "pipol-pitr-"));
const pg = `${prefix}-pg`,
  restored = `${prefix}-restored`;
const vols = [
  `${prefix}-wal`,
  `${prefix}-data`,
  `${prefix}-restore`,
  `${prefix}-backups`,
];
const image = "pipol-backup-sow:local",
  started = performance.now();
async function cmd(args: string[], allow = false) {
  const p = Bun.spawn(["docker", ...args], { stdout: "pipe", stderr: "pipe" });
  const [out, err] = await Promise.all([
    new Response(p.stdout).text(),
    new Response(p.stderr).text(),
  ]);
  const code = await p.exited;
  if (code && !allow)
    throw new Error(`docker ${args[0]} failed: ${err.slice(-1500)}`);
  return out.trim();
}
async function query(container: string, q: string) {
  return cmd([
    "exec",
    container,
    "psql",
    "-U",
    "fixture",
    "-d",
    "fixture",
    "-Atc",
    q,
  ]);
}
async function ready(container: string) {
  for (let i = 0; i < 60; i++) {
    const r = await cmd(
      ["exec", container, "pg_isready", "-U", "fixture"],
      true,
    );
    if (r.includes("accepting connections")) return;
    await Bun.sleep(500);
  }
  throw Error("Postgres did not start");
}
try {
  await Bun.write(join(dir, "asset.txt"), "certificate-file-and-key-fixture");
  for (const v of vols) await cmd(["volume", "create", v]);
  await cmd([
    "run",
    "--rm",
    "--entrypoint",
    "sh",
    "-v",
    `${vols[0]}:/wal`,
    image,
    "-c",
    "chown postgres:postgres /wal && chmod 700 /wal",
  ]);
  const publicKey = await cmd([
    "run",
    "--rm",
    "--entrypoint",
    "sh",
    "-v",
    `${dir}:/fixture`,
    image,
    "-c",
    "age-keygen -o /fixture/identity >/dev/null 2>&1 && age-keygen -y /fixture/identity",
  ]);
  await cmd([
    "run",
    "-d",
    "--name",
    pg,
    "-e",
    "POSTGRES_USER=fixture",
    "-e",
    "POSTGRES_PASSWORD=isolated-fixture",
    "-v",
    `${vols[1]}:/var/lib/postgresql/data`,
    "-v",
    `${vols[0]}:/wal-archive`,
    "postgres:16-alpine",
    "postgres",
    "-c",
    "wal_level=replica",
    "-c",
    "archive_mode=on",
    "-c",
    "archive_timeout=60s",
    "-c",
    "archive_command=test ! -f /wal-archive/%f && cp %p /wal-archive/%f",
  ]);
  await ready(pg);
  await query(
    pg,
    "create table recovery_probe(id integer primary key); insert into recovery_probe values(1)",
  );
  await cmd([
    "run",
    "--rm",
    "--network",
    `container:${pg}`,
    "-e",
    "PGHOST=127.0.0.1",
    "-e",
    "PGUSER=fixture",
    "-e",
    "PGDATABASE=fixture",
    "-e",
    "BACKUP_ONCE=1",
    "-e",
    `BACKUP_AGE_RECIPIENT=${publicKey}`,
    "-v",
    `${vols[3]}:/backups`,
    "-v",
    `${vols[0]}:/wal-archive:ro`,
    "-v",
    `${dir}:/assets:ro`,
    image,
  ]);
  await query(pg, "insert into recovery_probe values(2)");
  const target = await query(pg, "select clock_timestamp()");
  await Bun.sleep(100);
  await query(pg, "insert into recovery_probe values(3)");
  const archived = await query(
    pg,
    "select archived_count from pg_stat_archiver",
  );
  await query(pg, "select pg_switch_wal()");
  let walReady = false;
  for (let i = 0; i < 40; i++) {
    if (
      Number(await query(pg, "select archived_count from pg_stat_archiver")) >
      Number(archived)
    ) {
      walReady = true;
      break;
    }
    await Bun.sleep(250);
  }
  assert.ok(walReady, "WAL segment was archived");
  const restoreStarted = performance.now();
  const prep = `set -eu
umask 077
sha256sum -c /backups/*.sha256
age -d -i /fixture/identity -o /tmp/archive.tar.gz /backups/*.age
tar -xzf /tmp/archive.tar.gz -C /tmp
cmp /tmp/assets/asset.txt /fixture/asset.txt
cp -a /tmp/base/. /restore/
printf '%s\n' "restore_command = 'cp /wal-archive/%f %p'" "recovery_target_time = '${target}'" "recovery_target_action = 'promote'" >> /restore/postgresql.auto.conf
touch /restore/recovery.signal
chown -R postgres:postgres /restore
chmod 700 /restore`;
  await cmd([
    "run",
    "--rm",
    "--entrypoint",
    "sh",
    "-v",
    `${vols[3]}:/backups:ro`,
    "-v",
    `${vols[2]}:/restore`,
    "-v",
    `${dir}:/fixture:ro`,
    image,
    "-c",
    prep,
  ]);
  await cmd([
    "run",
    "-d",
    "--name",
    restored,
    "-v",
    `${vols[2]}:/var/lib/postgresql/data`,
    "-v",
    `${vols[0]}:/wal-archive:ro`,
    "postgres:16-alpine",
    "postgres",
    "-c",
    "archive_mode=off",
  ]);
  await ready(restored);
  assert.equal(
    await query(restored, "select count(*) from recovery_probe"),
    "2",
    "PITR retains committed row2 and excludes later row3",
  );
  assert.equal(await query(restored, "select pg_is_in_recovery()"), "f");
  const report = {
    date: new Date().toISOString(),
    environment: "disposable local Docker PostgreSQL16 + age",
    encryptedBundle: true,
    authenticatedDecryption: true,
    assetsRestored: true,
    physicalBaseBackup: true,
    walReplay: true,
    targetTimestamp: target,
    expectedRows: 2,
    restoredRows: 2,
    fixtureRtoSeconds: Number(
      ((performance.now() - restoreStarted) / 1000).toFixed(3),
    ),
    totalSeconds: Number(((performance.now() - started) / 1000).toFixed(3)),
    limits: [
      "Fixture timing only; production RPO/RTO requires real-host drill",
      "Archive is same-host until Owner configures off-host WAL replication",
      "Owner encryption identity is required to restore production bundles",
    ],
  };
  await Bun.write(
    resolve("../../manuals/pitr-drill-result.json"),
    JSON.stringify(report, null, 2) + "\n",
  );
  console.log(JSON.stringify(report, null, 2));
} finally {
  for (const name of [restored, pg]) await cmd(["rm", "-f", name], true);
  for (const v of vols) await cmd(["volume", "rm", v], true);
  await rm(dir, { recursive: true, force: true });
}
