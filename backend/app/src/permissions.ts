import { currentUser, hasAdminKey } from "./auth";
import { hostEnv } from "./db/env";
import type { SessionUser } from "./sessions";
import { fail } from "./features/common";

export const MODULES = [
  "exam",
  "certificate",
  "ranking",
  "article",
  "comment",
  "daily",
  "audit",
  "users",
  "site",
] as const;
export type Module = (typeof MODULES)[number];
export const ACTIONS = ["read", "write", "publish", "export"] as const;
export const STAFF_ROLES = [
  "owner",
  "admin",
  "author",
  "moderator",
  "results_viewer",
  "none",
] as const;
export function staffRole(user: SessionUser) {
  // Once explicitly set (including none), database role wins over bootstrap configuration.
  if (user.staffRole) return user.staffRole;
  if (
    (hostEnv("OWNER_EMAILS") ?? "")
      .split(",")
      .map((x) => x.trim().toLowerCase())
      .includes(user.email.toLowerCase())
  )
    return "owner";
  return user.role === "admin" || user.role === "dev" ? "admin" : "none";
}
export function permitted(user: SessionUser, module: Module, action: string) {
  const role = staffRole(user);
  if (role === "owner") return true;
  if (module === "users") return false;
  const custom = user.modulePermissions[module];
  if (custom) return custom.includes(action);
  if (role === "admin") return true;
  if (role === "author")
    return module === "article" && ["read", "write"].includes(action);
  if (role === "moderator")
    return module === "comment" && ["read", "write"].includes(action);
  return (
    role === "results_viewer" &&
    ["exam", "ranking"].includes(module) &&
    action === "read"
  );
}
export async function authorize(
  headers: Record<string, string | undefined>,
  module: Module,
  action = "read",
  ownerOnly = false,
) {
  if (hasAdminKey(headers)) return null; // Owner-controlled server tooling credential.
  const user = await currentUser(headers);
  if (!user) fail("กรุณาเข้าสู่ระบบผู้ดูแล", 401);
  if (
    ownerOnly ? staffRole(user!) !== "owner" : !permitted(user!, module, action)
  )
    fail("ไม่มีสิทธิ์ใช้งานส่วนนี้", 403);
  return user!;
}
