/** Export request schemas directly from mounted application; no secrets or DB requests. */
import { resolve } from "node:path";
import { app } from "../src/app";
const routes = app.routes.map((r) => ({
  method: r.method,
  path: r.path,
  request: { body: r.hooks.body, query: r.hooks.query, params: r.hooks.params },
  response: r.hooks.response ?? null,
}));
await Bun.write(
  resolve("../../manuals/api-contract.json"),
  JSON.stringify(
    {
      generatedAt: new Date().toISOString(),
      format:
        "Elysia TypeBox schemas; see api-contract.md for response/privacy/permission notes",
      routes,
    },
    (_k, v) => (typeof v === "function" ? undefined : v),
    2,
  ) + "\n",
);
console.log(`Exported ${routes.length} mounted route schemas.`);
