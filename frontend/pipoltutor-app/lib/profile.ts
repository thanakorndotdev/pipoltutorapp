import { BACKEND_URL } from "@/lib/api";
import { sessionHeaders } from "@/lib/auth";

export { BIO_MAX } from "@/lib/profile-limits";

/** GET /profile — the signed-in student's own profile. */
export type MyProfile = {
  id: string;
  firstName: string | null;
  lastName: string | null;
  nickname: string | null;
  campus: string | null;
  email: string;
  complete: boolean;
  bio: string | null;
  /** Uploaded photo only; null means the Google avatar (avatarUrl) is shown. */
  photoUrl: string | null;
  avatarUrl: string | null;
  joinedAt: string | null;
};

/** GET /profiles/:id — what other signed-in students see. Nickname only, no scores. */
export type PublicProfile = {
  id: string;
  name: string;
  bio: string | null;
  photo: string | null;
  joinedAt: string;
  highestFire: number;
  certificates: number;
  isMe: boolean;
};

/** Server components only. Null when signed out or unreachable. */
export async function fetchMyProfile(): Promise<MyProfile | null> {
  try {
    const res = await fetch(`${BACKEND_URL}/profile`, { cache: "no-store", headers: await sessionHeaders() });
    if (!res.ok) return null;
    return ((await res.json()) as { profile: MyProfile }).profile;
  } catch {
    return null;
  }
}

/** Server components only. Null for a missing/deleted profile or a signed-out viewer. */
export async function fetchPublicProfile(id: string): Promise<PublicProfile | null> {
  try {
    const res = await fetch(`${BACKEND_URL}/profiles/${encodeURIComponent(id)}`, { cache: "no-store", headers: await sessionHeaders() });
    if (!res.ok) return null;
    return ((await res.json()) as { profile: PublicProfile }).profile;
  } catch {
    return null;
  }
}
