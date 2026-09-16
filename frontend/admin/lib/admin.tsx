"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

import type { AdminUser } from "./types";

const KEY_STORAGE = "pipol.adminKey";

/**
 * Browser calls go to same-origin /api/* — Caddy in production, the next dev
 * rewrite on :3002 in the host loop. No host is ever hardcoded here.
 */
const API_BASE = "/api";

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

/**
 * Two ways in: the static ADMIN_API_KEY (tooling, host dev loop) or the
 * Google session cookie of a user whose role is admin/dev. The cookie is
 * same-origin, so the session path only works when Caddy serves /admin next
 * to /api — on :3002 the cookie lives on :3000 and the key is the way in.
 */
export type AdminAuth = { via: "key"; key: string; user: null } | { via: "session"; key: null; user: AdminUser };

type AdminContextValue = {
  auth: AdminAuth | null;
  ready: boolean;
  /** Last reason the session path was refused (e.g. signed in but still a student). */
  sessionError: string | null;
  signIn: (key: string) => Promise<boolean>;
  signOut: () => Promise<void>;
  api: <T>(path: string, init?: RequestInit & { json?: unknown }) => Promise<T>;
};

const AdminContext = createContext<AdminContextValue | null>(null);

function readStoredKey(): string {
  try {
    return window.sessionStorage.getItem(KEY_STORAGE) ?? "";
  } catch {
    return "";
  }
}
function storeKey(key: string) {
  try {
    if (key) window.sessionStorage.setItem(KEY_STORAGE, key);
    else window.sessionStorage.removeItem(KEY_STORAGE);
  } catch {
    // Storage blocked; the key just lives in memory for this page.
  }
}

type Verify = { ok: boolean; via?: "key" | "session"; user?: AdminUser | null; error?: string };

/** With a key checks the key; without one checks the session cookie. */
async function verify(key: string | null): Promise<Verify> {
  const r = await fetch(`${API_BASE}/settings/admin/verify`, { headers: key ? { "x-admin-key": key } : {} });
  const text = await r.text();
  try {
    return text ? (JSON.parse(text) as Verify) : { ok: r.ok };
  } catch {
    return { ok: false };
  }
}

export function AdminProvider({ children }: { children: ReactNode }) {
  const [auth, setAuth] = useState<AdminAuth | null>(null);
  const [ready, setReady] = useState(false);
  const [sessionError, setSessionError] = useState<string | null>(null);

  // Restore a key remembered in this tab, else fall back to the Google session.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const stored = readStoredKey();
      if (stored) {
        const v = await verify(stored);
        if (v.ok) return { via: "key", key: stored, user: null } as const;
        storeKey("");
      }
      const v = await verify(null);
      if (v.ok && v.via === "session" && v.user) return { via: "session", key: null, user: v.user } as const;
      if (v.error) setSessionError(v.error);
      return null;
    })()
      .then((a) => !cancelled && setAuth(a))
      .catch(() => {})
      .finally(() => !cancelled && setReady(true));
    return () => {
      cancelled = true;
    };
  }, []);

  const signIn = useCallback(async (candidate: string) => {
    const trimmed = candidate.trim();
    if (!trimmed) return false;
    const v = await verify(trimmed);
    if (v.ok) {
      storeKey(trimmed);
      setAuth({ via: "key", key: trimmed, user: null });
    }
    return v.ok;
  }, []);

  const signOut = useCallback(async () => {
    storeKey("");
    if (auth?.via === "session") {
      try {
        await fetch(`${API_BASE}/auth/logout`, { method: "POST" });
      } catch {
        // Cookie may outlive this; the next verify will say so.
      }
    }
    setAuth(null);
    setSessionError(null);
  }, [auth]);

  const api = useCallback(
    async <T,>(path: string, init: RequestInit & { json?: unknown } = {}): Promise<T> => {
      const { json, headers, ...rest } = init;
      const h = new Headers(headers);
      if (auth?.via === "key") h.set("x-admin-key", auth.key);
      if (json !== undefined) h.set("content-type", "application/json");
      const r = await fetch(`${API_BASE}${path}`, {
        ...rest,
        headers: h,
        body: json !== undefined ? JSON.stringify(json) : rest.body,
      });
      if (r.status === 401) {
        // Key revoked / rotated or session expired: drop it so the gate shows again.
        storeKey("");
        setAuth(null);
      }
      const text = await r.text();
      const data = text ? (JSON.parse(text) as unknown) : null;
      if (!r.ok) {
        const message =
          data && typeof data === "object" && "error" in data && typeof data.error === "string"
            ? data.error
            : `ผิดพลาด (${r.status})`;
        throw new ApiError(r.status, message);
      }
      return data as T;
    },
    [auth]
  );

  const value = useMemo(() => ({ auth, ready, sessionError, signIn, signOut, api }), [auth, ready, sessionError, signIn, signOut, api]);
  return <AdminContext.Provider value={value}>{children}</AdminContext.Provider>;
}

export function useAdmin(): AdminContextValue {
  const ctx = useContext(AdminContext);
  if (!ctx) throw new Error("useAdmin must be used inside AdminProvider");
  return ctx;
}

export const errorMessage = (e: unknown) => (e instanceof Error ? e.message : String(e));
