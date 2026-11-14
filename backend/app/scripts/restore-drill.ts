import assert from "node:assert/strict";
import {
  randomBytes,
  createCipheriv,
  createDecipheriv,
  createHash,
} from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { db, sql } from "../src/db";
import { users, examPacks, attempts, certificates } from "../src/db/schema";
import { databaseUrl } from "../src/db/env";
import { reconcileAttempt, certFile } from "../src/certificates/issue";
import { kickCertificateWorker } from "../src/certificates/worker";
import { verifyManifest } from "../src/certificates/keys";
assert.match(
  new URL(databaseUrl()).pathname,
  /^\/pipol_sow_test_[a-f0-9]{32}(_restore)?$/,
);
const dir = process.env.SOW_TEST_DIR!;
if (process.argv.includes("--verify")) {
  const [cert] = await db.select().from(certificates);
  assert.ok(cert?.manifest && cert.signature);
  assert.equal(await verifyManifest(cert.manifest, cert.signature), true);
  for (const ext of ["png", "pdf"] as const)
    assert.ok((await Bun.file(certFile(cert.id, ext)).size) > 1000);
  await sql.end();
  console.log("RESTORE VERIFIED: metadata, signature, PNG and PDF");
} else {
  const url = new URL(databaseUrl()),
    name = url.pathname.slice(1),
    restored = `${name}_restore`;
  let created = false;
  const start = Date.now();
  async function command(args: string[], input?: Uint8Array) {
    const p = Bun.spawn(args, {
      stdin: input ? "pipe" : "ignore",
      stdout: "pipe",
      stderr: "pipe",
    });
    if (input) {
      p.stdin!.write(input);
      p.stdin!.end();
    }
    const [out, err, code] = await Promise.all([
      new Response(p.stdout).arrayBuffer(),
      new Response(p.stderr).text(),
      p.exited,
    ]);
    assert.equal(code, 0, err);
    return new Uint8Array(out);
  }
  const pg = [
    "docker",
    "compose",
    "-f",
    "../../docker/docker-compose.yml",
    "exec",
    "-T",
    "postgres",
  ];
  try {
    const [u] = await db
      .insert(users)
      .values({
        googleId: "restore-test",
        email: "restore@pipoltutor.test",
        firstName: "ทดสอบ",
        lastName: "กู้คืน",
      })
      .returning();
    const [p] = await db
      .insert(examPacks)
      .values({
        slug: "restore-test",
        title: "ทดสอบกู้คืน",
        durationSeconds: 60,
        certificateEnabled: true,
      })
      .returning();
    const [a] = await db
      .insert(attempts)
      .values({
        userId: u!.id,
        packId: p!.id,
        status: "submitted",
        score: 1,
        maxScore: 1,
        expiresAt: new Date(),
        submittedAt: new Date(),
      })
      .returning();
    const id = await reconcileAttempt(a!.id);
    assert.ok(id);
    await kickCertificateWorker();
    const dump = await command([
      ...pg,
      "pg_dump",
      "-U",
      decodeURIComponent(url.username),
      "-Fc",
      "-d",
      name,
    ]);
    const archive = await command([
      "tar",
      "-czf",
      "-",
      "-C",
      dir,
      "files",
      "keys",
    ]);
    // Authenticated encryption for this disposable drill; production backup uses age recipient encryption.
    const key = randomBytes(32),
      iv = randomBytes(12),
      cipher = createCipheriv("aes-256-gcm", key, iv);
    const bundle = Buffer.concat([
      Buffer.from(String(dump.length) + "\n"),
      dump,
      archive,
    ]);
    const encrypted = Buffer.concat([cipher.update(bundle), cipher.final()]),
      tag = cipher.getAuthTag();
    await writeFile(
      join(dir, "backup.enc"),
      Buffer.concat([iv, tag, encrypted]),
      { mode: 0o600 },
    );
    const saved = await readFile(join(dir, "backup.enc"));
    const decrypt = createDecipheriv("aes-256-gcm", key, saved.subarray(0, 12));
    decrypt.setAuthTag(saved.subarray(12, 28));
    const plain = Buffer.concat([
      decrypt.update(saved.subarray(28)),
      decrypt.final(),
    ]);
    assert.deepEqual(plain, bundle);
    const line = plain.indexOf(10),
      length = Number(plain.subarray(0, line).toString());
    const dumpRestored = plain.subarray(line + 1, line + 1 + length),
      assets = plain.subarray(line + 1 + length);
    const restoreStart = Date.now();
    await sql`create database ${sql(restored)}`;
    created = true;
    await command(
      [
        ...pg,
        "pg_restore",
        "-U",
        decodeURIComponent(url.username),
        "--no-owner",
        "-d",
        restored,
      ],
      dumpRestored,
    );
    const restoredDir = join(dir, "restored");
    await mkdir(restoredDir);
    await command(["tar", "-xzf", "-", "-C", restoredDir], assets);
    url.pathname = `/${restored}`;
    const child = Bun.spawn(["bun", "run", import.meta.path, "--verify"], {
      env: {
        ...process.env,
        DATABASE_URL: url.toString(),
        CERT_DIR: join(restoredDir, "files"),
        CERT_KEY_DIR: join(restoredDir, "keys"),
      },
      stdout: "inherit",
      stderr: "inherit",
    });
    assert.equal(await child.exited, 0);
    const report = {
      date: new Date().toISOString(),
      kind: "isolated logical backup/restore with authenticated encryption",
      databaseRestored: true,
      certificateMetadata: true,
      signatureValid: true,
      filesRestored: true,
      backupSha256: createHash("sha256").update(saved).digest("hex"),
      rtoSeconds: (Date.now() - restoreStart) / 1000,
      totalSeconds: (Date.now() - start) / 1000,
      rpo: "fixture snapshot only; production PITR unverified",
    };
    await Bun.write(
      "../../manuals/restore-drill-result.json",
      JSON.stringify(report, null, 2) + "\n",
    );
    console.log(JSON.stringify(report));
  } finally {
    if (created) await sql`drop database ${sql(restored)} with (force)`;
    await sql.end();
  }
}
