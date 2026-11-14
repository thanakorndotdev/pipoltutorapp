import "server-only";

import { BACKEND_URL } from "./api";
import { sessionHeaders } from "./auth";

/** GET /notifications?all=1 — the signed-in student's own notices, closed ones included. */
export type Notice = {
  id: string;
  kind: string;
  title: string;
  body: string | null;
  /** Same-site path, e.g. the comment thread that was answered. */
  link: string | null;
  createdAt: string;
  /** Set once the popup was closed; the row stays in this list. */
  dismissedAt: string | null;
};

/** Server components: newest first; empty when signed out or unreachable. */
export async function fetchMyNotifications(): Promise<Notice[]> {
  try {
    const res = await fetch(`${BACKEND_URL}/notifications?all=1`, { cache: "no-store", headers: await sessionHeaders() });
    if (!res.ok) return [];
    return ((await res.json()) as { notifications: Notice[] }).notifications;
  } catch {
    return [];
  }
}
