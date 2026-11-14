import type { CertElement, CertLayout } from "../db/schema";

/** Values a template may print. Keys are the {placeholders} admins type into text elements. */
export type CertData = {
  recipient_full_name: string;
  /** "ม.1" / "ม.4" / "". */
  grade: string;
  subject: string;
  exam_title: string;
  /** The printed serial, e.g. PT-000123. */
  certificate_id: string;
  issue_date: string;
  issuer_name: string;
  score: string;
  max_score: string;
  percent: string;
  rank: string;
};

export const CERT_FIELDS: { key: keyof CertData; label: string }[] = [
  { key: "recipient_full_name", label: "ชื่อ–นามสกุลผู้รับ" },
  { key: "grade", label: "ระดับชั้นของข้อสอบ" },
  { key: "subject", label: "วิชา" },
  { key: "exam_title", label: "ชื่อชุดข้อสอบ" },
  { key: "certificate_id", label: "เลขที่เกียรติบัตร" },
  { key: "issue_date", label: "วันที่ออก" },
  { key: "issuer_name", label: "ชื่อผู้ออกใบ" },
  { key: "score", label: "คะแนน" },
  { key: "max_score", label: "คะแนนเต็ม" },
  { key: "percent", label: "เปอร์เซ็นต์" },
  { key: "rank", label: "อันดับรับรอง" },
];

/** A published template must still carry these, or the certificate cannot be verified (3.2). */
const REQUIRED_FIELDS: (keyof CertData)[] = ["recipient_full_name", "certificate_id"];

export const SHEET = {
  "a4-landscape": { w: 2000, h: 1414, pdf: [841.89, 595.28] as [number, number] },
  "a4-portrait": { w: 1414, h: 2000, pdf: [595.28, 841.89] as [number, number] },
} as const;

/** Replaces {field} with its value; unknown placeholders are left as typed so a typo is visible in preview. */
export function fillFields(text: string, data: CertData): string {
  return text.replace(/\{([a-z_]+)\}/g, (raw, key: string) => (key in data ? data[key as keyof CertData] : raw));
}

/** Problems that block publishing; empty = publishable. */
export function layoutProblems(layout: CertLayout): string[] {
  const problems: string[] = [];
  const texts = layout.elements.filter((e): e is Extract<CertElement, { type: "text" }> => e.type === "text").map((e) => e.text);
  for (const f of REQUIRED_FIELDS) {
    if (!texts.some((t) => t.includes(`{${f}}`))) problems.push(`ต้องมีช่อง {${f}} (${CERT_FIELDS.find((c) => c.key === f)?.label}) อย่างน้อย 1 ที่`);
  }
  if (!layout.elements.some((e) => e.type === "qr")) problems.push("ต้องมี QR สำหรับตรวจสอบ 1 จุด");
  return problems;
}

const text = (
  id: string,
  value: string,
  y: number,
  size: number,
  o: Partial<Extract<CertElement, { type: "text" }>> = {}
): CertElement => ({ id, type: "text", text: value, x: 0.5, y, w: 0.7, size, weight: 400, font: "body", color: "#46557a", align: "center", ...o });

/**
 * The built-in certificate: participation wording, no score or rank
 * (CERT-04). Used by every pack that has no template of its own.
 */
export const DEFAULT_LAYOUT: CertLayout = {
  paper: "a4-landscape",
  background: null,
  decor: "standard",
  elements: [
    text("title", "เกียรติบัตร", 0.263, 128, { weight: 600, font: "display", color: "#1e2f86" }),
    text("intro", "ขอมอบเกียรติบัตรฉบับนี้ให้ไว้เพื่อแสดงว่า", 0.396, 42),
    text("name", "{recipient_full_name}", 0.499, 112, { weight: 600, font: "display", color: "#111c3e", w: 0.74, fit: true }),
    text("body", "ได้เข้าร่วมการสอบ {exam_title}\n{grade} {subject}", 0.612, 44),
    text("date", "ให้ไว้ ณ วันที่ {issue_date}", 0.742, 34, { color: "#8493b4" }),
    text("issuer", "{issuer_name}", 0.876, 40, { weight: 500, font: "display", color: "#111c3e", w: 0.34 }),
    text("issuer_title", "ผู้สอน pipoltutor", 0.91, 28, { color: "#8493b4", w: 0.34 }),
    { id: "qr", type: "qr", x: 0.868, y: 0.79, size: 0.105 },
    text("serial", "เลขที่ {certificate_id}", 0.9, 24, { x: 0.868, w: 0.2, color: "#8493b4" }),
  ],
};
