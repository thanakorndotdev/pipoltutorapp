import { eq } from "drizzle-orm";
import { Elysia, t } from "elysia";

import { db } from "../db";
import { siteAssets, siteTexts } from "../db/schema";
import { SITE_ASSET_SLOTS, isSiteAssetKey } from "../site-assets";
import { SITE_TEXT_DEFAULTS, SITE_TEXT_SLOTS, isSiteTextKey } from "../site-texts";
import { adminGuard } from "./admin/guard";

export type SiteAssetValue = { imageUrl: string; alt: string; updatedAt: Date };

async function loadAssets(): Promise<Record<string, SiteAssetValue>> {
  const rows = await db
    .select({ key: siteAssets.key, imageUrl: siteAssets.imageUrl, alt: siteAssets.alt, updatedAt: siteAssets.updatedAt })
    .from(siteAssets);
  const out: Record<string, SiteAssetValue> = {};
  for (const r of rows) out[r.key] = { imageUrl: r.imageUrl, alt: r.alt, updatedAt: r.updatedAt };
  return out;
}

async function loadTextOverrides(): Promise<Record<string, { value: string; updatedAt: Date }>> {
  const rows = await db.select({ key: siteTexts.key, value: siteTexts.value, updatedAt: siteTexts.updatedAt }).from(siteTexts);
  const out: Record<string, { value: string; updatedAt: Date }> = {};
  for (const r of rows) if (isSiteTextKey(r.key)) out[r.key] = { value: r.value, updatedAt: r.updatedAt };
  return out;
}

const keyParam = t.Object({ key: t.String({ minLength: 1, maxLength: 80 }) });

export const siteRoutes = new Elysia({ prefix: "/site" })
  /** Public: only the slots that have an image, keyed by slot. */
  .get("/assets", async () => ({ assets: await loadAssets() }))
  /** Public: every registered text, override applied over its default. */
  .get("/texts", async () => {
    const overrides = await loadTextOverrides();
    const texts: Record<string, string> = { ...SITE_TEXT_DEFAULTS };
    for (const [k, v] of Object.entries(overrides)) texts[k] = v.value;
    return { texts };
  });

export const adminSiteRoutes = new Elysia({ prefix: "/admin/site" })
  .use(adminGuard)
  /** Every slot with its current value (null when unset) for the admin page. */
  .get("/assets", async () => {
    const current = await loadAssets();
    return { slots: SITE_ASSET_SLOTS.map((s) => ({ ...s, asset: current[s.key] ?? null })) };
  })
  .put(
    "/assets/:key",
    async ({ params, body, set }) => {
      if (!isSiteAssetKey(params.key)) {
        set.status = 404;
        return { error: "ไม่พบช่องรูปนี้" };
      }
      const imageUrl = body.imageUrl.trim();
      const alt = (body.alt ?? "").trim();
      const [row] = await db
        .insert(siteAssets)
        .values({ key: params.key, imageUrl, alt })
        .onConflictDoUpdate({ target: siteAssets.key, set: { imageUrl, alt, updatedAt: new Date() } })
        .returning({ key: siteAssets.key, imageUrl: siteAssets.imageUrl, alt: siteAssets.alt, updatedAt: siteAssets.updatedAt });
      return { asset: row };
    },
    {
      params: keyParam,
      body: t.Object({
        /** An /api/uploads/<name> path or an absolute https URL. */
        imageUrl: t.String({ minLength: 1, maxLength: 2000 }),
        alt: t.Optional(t.String({ maxLength: 300 })),
      }),
    }
  )
  .delete(
    "/assets/:key",
    async ({ params, set }) => {
      if (!isSiteAssetKey(params.key)) {
        set.status = 404;
        return { error: "ไม่พบช่องรูปนี้" };
      }
      await db.delete(siteAssets).where(eq(siteAssets.key, params.key));
      return { ok: true };
    },
    { params: keyParam }
  )
  /** Every text slot with its default and current override for the admin page. */
  .get("/texts", async () => {
    const overrides = await loadTextOverrides();
    return { slots: SITE_TEXT_SLOTS.map((s) => ({ ...s, override: overrides[s.key] ?? null })) };
  })
  .put(
    "/texts/:key",
    async ({ params, body, set }) => {
      if (!isSiteTextKey(params.key)) {
        set.status = 404;
        return { error: "ไม่พบข้อความนี้" };
      }
      const value = body.value.replace(/\r\n/g, "\n");
      const [row] = await db
        .insert(siteTexts)
        .values({ key: params.key, value })
        .onConflictDoUpdate({ target: siteTexts.key, set: { value, updatedAt: new Date() } })
        .returning({ key: siteTexts.key, value: siteTexts.value, updatedAt: siteTexts.updatedAt });
      return { override: row };
    },
    { params: keyParam, body: t.Object({ value: t.String({ maxLength: 20_000 }) }) }
  )
  /** Reset one text to its default. */
  .delete(
    "/texts/:key",
    async ({ params, set }) => {
      if (!isSiteTextKey(params.key)) {
        set.status = 404;
        return { error: "ไม่พบข้อความนี้" };
      }
      await db.delete(siteTexts).where(eq(siteTexts.key, params.key));
      return { ok: true };
    },
    { params: keyParam }
  );
