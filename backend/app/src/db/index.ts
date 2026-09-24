import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import { databaseUrl } from "./env";
import * as schema from "./schema";

/**
 * One pool for the process. `max` stays small because the API runs as a single
 * container next to Postgres in compose; raise it when the backend is scaled out.
 */
export const sql = postgres(databaseUrl(), {
  max: Number(process.env.DATABASE_POOL_MAX ?? 10),
  idle_timeout: 20,
  connect_timeout: 10,
  onnotice: () => {},
});

export const db = drizzle(sql, { schema });

export async function ping(): Promise<boolean> {
  const [row] = await sql`select 1 as ok`;
  return row?.ok === 1;
}

export { schema };
