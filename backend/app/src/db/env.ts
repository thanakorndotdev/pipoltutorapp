import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Credentials live in exactly one place: docker/.env.
 *
 * Inside a container, compose has already injected DATABASE_URL, so that wins.
 * On the host (drizzle-kit, seeds, `bun run dev`) there is no DATABASE_URL, so
 * we read docker/.env ourselves and point at the port compose publishes on
 * 127.0.0.1 — the container hostname `postgres` does not resolve from the host.
 */

/**
 * Candidates, in order. drizzle-kit bundles this config, so `import.meta.dir`
 * is not always meaningful there; the cwd path covers commands run from
 * backend/app, which is how every db: script runs.
 */
const ENV_FILE_CANDIDATES = [
  resolve(process.cwd(), "../../docker/.env"),
  typeof import.meta.dir === "string"
    ? resolve(import.meta.dir, "../../../../docker/.env")
    : null,
].filter((p): p is string => p !== null);

/** Minimal KEY=VALUE reader: comments, blank lines, optional surrounding quotes. */
function readEnvFile(path: string): Record<string, string> {
  let raw: string;
  try {
    raw = readFileSync(path, "utf8");
  } catch {
    return {};
  }

  const out: Record<string, string> = {};
  for (const line of raw.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;

    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    out[key] = value;
  }
  return out;
}

/**
 * Non-DB setting from the environment, falling back to docker/.env on the
 * host so `bun run dev` sees the same ADMIN_API_KEY / ADMIN_EMAILS /
 * ALLOW_DEV_AUTH the container gets from compose. process.env always wins.
 */
export function hostEnv(key: string): string | undefined {
  if (process.env[key] !== undefined) return process.env[key];
  for (const candidate of ENV_FILE_CANDIDATES) {
    const file = readEnvFile(candidate);
    if (key in file) return file[key];
  }
  return undefined;
}

export function databaseUrl(): string {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;

  let file: Record<string, string> = {};
  for (const candidate of ENV_FILE_CANDIDATES) {
    file = readEnvFile(candidate);
    if (file.POSTGRES_PASSWORD) break;
  }

  const user = process.env.POSTGRES_USER ?? file.POSTGRES_USER;
  const password = process.env.POSTGRES_PASSWORD ?? file.POSTGRES_PASSWORD;
  const database = process.env.POSTGRES_DB ?? file.POSTGRES_DB;
  const port = process.env.POSTGRES_PORT ?? file.POSTGRES_PORT ?? "5432";

  if (!user || !password || !database) {
    throw new Error(
      `No DATABASE_URL, and docker/.env is missing or incomplete ` +
        `(looked in: ${ENV_FILE_CANDIDATES.join(", ")}). ` +
        `Run: cp docker/.env.example docker/.env, then set POSTGRES_PASSWORD.`
    );
  }

  return `postgres://${encodeURIComponent(user)}:${encodeURIComponent(
    password
  )}@localhost:${port}/${database}`;
}
