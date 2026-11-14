import { Elysia } from "elysia";

import { authorize, permitted, type Module } from "../../permissions";
import { currentUser,hasAdminKey } from "../../auth";
import { DomainError } from "../../features/common";

/**
 * Every /admin/* route hangs off this plugin. Admits a request carrying a
 * valid x-admin-key, or a session user listed in ADMIN_EMAILS. Nothing under
 * /admin is reachable by a student, so admin responses may include
 * the answer key (correctChoices, acceptedAnswers) — the one place it is
 * allowed out of the DB.
 */
export const adminGuard = new Elysia({ name: "admin-guard" }).onBeforeHandle(
  { as: "scoped" },
  async ({ headers, request, set }) => {
    const path = new URL(request.url).pathname;
    if(path.startsWith("/admin/uploads")){if(hasAdminKey(headers))return;const u=await currentUser(headers);if(u&&(["exam","article","certificate","daily"] as Module[]).some(m=>permitted(u,m,"write")))return;set.status=u?403:401;return {error:"ไม่มีสิทธิ์อัปโหลดรูป"};}
    let module: Module = "site";
    if (/\/(packs|questions|results|students)(\/|$)/.test(path)) module = "exam";
    if (/\/cert(ificates|-templates)(\/|$)/.test(path)) module = "certificate";
    if (/\/ranking(\/|$)/.test(path)) module = "ranking";
    if (/\/(articles|categories|media|cms)(\/|$)/.test(path)) module = "article";
    if (/\/comments(\/|$)/.test(path)) module = "comment";
    if (/\/daily(\/|$)/.test(path)) module = "daily";
    if (/\/(audit|errors|retention)(\/|$)/.test(path)) module = "audit";
    if (/\/users(\/|$)/.test(path)) module = "users";
    // Taxonomy edits and merges rewrite published articles, so they need publish rights (SoW 8.2: Author edits drafts only).
    const taxonomyWrite = request.method !== "GET" && /\/cms\/(categories|merge)(\/|$)/.test(path);
    const action = /\/(export|csv)(\/|$)/.test(path) ? "export" : taxonomyWrite || /\/(publish|schedule|approve)(\/|$)/.test(path) ? "publish" : request.method === "GET" ? "read" : "write";
    try { await authorize(headers, module, action, /\/keys(\/|$)/.test(path) || module === "users"); }
    catch (error) { if (!(error instanceof DomainError)) throw error; set.status = error.status; return { error: error.message }; }
  }
);
