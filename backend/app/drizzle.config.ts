import { defineConfig } from "drizzle-kit";

import { databaseUrl } from "./src/db/env";

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  // Credentials come from docker/.env (or DATABASE_URL when in a container).
  dbCredentials: { url: databaseUrl() },
  verbose: true,
  strict: true,
});
