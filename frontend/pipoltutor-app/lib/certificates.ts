import "server-only";

import { BACKEND_URL } from "./api";
import { sessionHeaders } from "./auth";

/** What the public and the owner see; "pending" covers queued and a render being retried. */
export type CertificateStatus = "pending" | "valid" | "revoked" | "previous_valid" | "superseded";

/** GET /certificates — one row per certificate revision of the signed-in student. */
export type Certificate = {
  id: string;
  /** Public locator used by the QR code and /cert/<publicId>. */
  publicId: string;
  serial: string;
  status: CertificateStatus;
  revision: number;
  recipientName: string;
  issuedAt: string;
  attemptId: string;
  packId: string;
  packTitle: string;
  packSlug: string;
  attemptNo: number;
  score: number | null;
  maxScore: number | null;
  submittedAt: string | null;
  /** The attempt the dashboard opens first for this pack: best score, then less time, then earlier start. */
  isDefault: boolean;
};

/** Server components: the caller's certificates, newest first; empty when signed out or unreachable. */
export async function fetchMyCertificates(): Promise<Certificate[]> {
  try {
    const res = await fetch(`${BACKEND_URL}/certificates`, { cache: "no-store", headers: await sessionHeaders() });
    if (!res.ok) return [];
    return ((await res.json()) as { certificates: Certificate[] }).certificates;
  } catch {
    return [];
  }
}

/** Same-origin URL of the rendered file; the backend checks the session cookie and ownership. */
export { certificateFileUrl } from "./certificate-file";

/** GET /cert/:publicId — public verification; never carries a name, email or score. */
export type CertificateVerification =
  | { status: "not_found" }
  | {
      status: CertificateStatus;
      serial: string;
      examTitle: string;
      level: "m1" | "m4" | null;
      subject: string | null;
      issuedAt: string;
      revision: number;
      /** The server re-checked the signed manifest just now. */
      signatureValid: boolean;
      keyId: string | null;
      /** A newer valid revision exists for the same exam sitting. */
      hasCurrent: boolean;
    };

export async function fetchVerification(publicId: string): Promise<CertificateVerification | null> {
  try {
    const res = await fetch(`${BACKEND_URL}/cert/${encodeURIComponent(publicId)}`, { cache: "no-store" });
    if (res.status === 404 || res.status === 422) return { status: "not_found" };
    if (!res.ok) return null;
    return (await res.json()) as CertificateVerification;
  } catch {
    return null;
  }
}

/** The attempt behind a certificate, only for the account that sat it; `denied` carries the backend's message. */
export async function fetchMyAttemptForCertificate(publicId: string): Promise<{ attemptId: string } | { denied: string }> {
  try {
    const res = await fetch(`${BACKEND_URL}/cert/${encodeURIComponent(publicId)}/mine`, { cache: "no-store", headers: await sessionHeaders() });
    const data = (await res.json()) as { attemptId?: string; error?: string };
    if (res.ok && data.attemptId) return { attemptId: data.attemptId };
    return { denied: data.error ?? "ไม่มีสิทธิ์เข้าถึงข้อมูลผลสอบนี้" };
  } catch {
    return { denied: "ติดต่อเซิร์ฟเวอร์ไม่ได้ ลองใหม่อีกครั้ง" };
  }
}

export const LEVEL_LABEL: Record<"m1" | "m4", string> = { m1: "ม.1", m4: "ม.4" };
