/**
 * Client-side mock of an attempt for the UI build. Deliberately carries no
 * answer key — the real engine grades on the server (exam-engine-rules).
 */
export type Subject = { id: string; label: string; icon: string; total: number; from: number };

export const SUBJECTS: Subject[] = [
  { id: "math", label: "คณิตศาสตร์", icon: "functions", total: 30, from: 1 },
  { id: "sci", label: "วิทยาศาสตร์", icon: "science", total: 30, from: 31 },
  { id: "iq", label: "ความสามารถทั่วไป", icon: "extension", total: 15, from: 61 },
  { id: "th", label: "ภาษาไทย", icon: "menu_book", total: 15, from: 76 },
  { id: "en", label: "ภาษาอังกฤษ", icon: "translate", total: 10, from: 91 },
];

export const TOTAL = 100;
export const KEYS = ["ก", "ข", "ค", "ง"] as const;
export type Key = (typeof KEYS)[number];

export type MockQuestion = { topic: string; stem: string; choices: string[]; figure?: boolean };

const STEMS: MockQuestion[] = [
  { topic: "สมการเชิงเส้น", stem: "ถ้า 3x + 7 = 25 แล้วค่าของ x² − 2x เท่ากับข้อใด", choices: ["18", "24", "30", "36"], figure: true },
  { topic: "อัตราส่วน", stem: "น้ำผลไม้ผสมน้ำเชื่อมในอัตราส่วน 3 : 2 ถ้ามีน้ำผลไม้ 450 มิลลิลิตร ต้องใช้น้ำเชื่อมกี่มิลลิลิตร", choices: ["200", "270", "300", "675"] },
  { topic: "เรขาคณิต", stem: "สี่เหลี่ยมผืนผ้ากว้าง 6 ซม. มีเส้นทแยงมุมยาว 10 ซม. พื้นที่เท่ากับกี่ตารางเซนติเมตร", choices: ["36", "48", "60", "80"] },
  { topic: "จำนวนและการดำเนินการ", stem: "ผลบวกของจำนวนคี่ตั้งแต่ 1 ถึง 39 เท่ากับข้อใด", choices: ["361", "380", "400", "441"] },
];

export function questionFor(n: number): MockQuestion {
  return STEMS[(n - 1) % STEMS.length];
}

export function subjectOf(n: number): Subject {
  return SUBJECTS.find((s) => n >= s.from && n < s.from + s.total) ?? SUBJECTS[0];
}

/** Fresh attempt: nothing answered, nothing flagged, at ข้อ 1. */
export function initialState() {
  const answers: Record<number, Key | undefined> = {};
  const flags = new Set<number>();
  return { answers, flags, current: 1 };
}
