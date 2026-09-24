/** Shapes returned by the Elysia backend's /admin/* and /settings/* routes. */

export type Subject = "math" | "science" | "general_aptitude" | "thai" | "english";

export const SUBJECTS: { id: Subject; label: string; short: string }[] = [
  { id: "math", label: "คณิตศาสตร์", short: "คณิต" },
  { id: "science", label: "วิทยาศาสตร์", short: "วิทย์" },
  { id: "general_aptitude", label: "ความสามารถทั่วไป", short: "ทั่วไป" },
  { id: "thai", label: "ภาษาไทย", short: "ไทย" },
  { id: "english", label: "ภาษาอังกฤษ", short: "อังกฤษ" },
];

export const subjectLabel = (id: Subject) => SUBJECTS.find((s) => s.id === id)?.label ?? id;

export type Choice = { key: string; text: string };

export type Question = {
  id: string;
  subject: Subject;
  topic: string;
  prompt: string;
  imageUrl: string | null;
  choices: Choice[];
  correctChoice: string;
  explanation: string | null;
  active: boolean;
  createdAt: string;
  updatedAt: string;
  usedInPacks?: number;
};

export type QuestionInput = {
  subject: Subject;
  topic: string;
  prompt: string;
  imageUrl: string | null;
  choices: Choice[];
  correctChoice: string;
  explanation: string | null;
  active: boolean;
};

export type Pack = {
  id: string;
  slug: string;
  title: string;
  /** Products that unlock the pack; empty means free. */
  productIds: string[];
  unlockedBy: { id: string; title: string }[];
  questionCount: number;
  durationSeconds: number;
  createdAt: string;
  assigned: number;
  attempts?: number;
};

export type PackInput = {
  slug: string;
  title: string;
  productIds: string[];
  questionCount: number;
  durationSeconds: number;
};

/** A question as it sits in a pack (admin projection, includes the key). */
export type PackQuestion = {
  position: number;
  id: string;
  subject: Subject;
  topic: string;
  prompt: string;
  imageUrl: string | null;
  choices: Choice[];
  correctChoice: string;
  active: boolean;
};

export type Product = {
  id: string;
  slug: string;
  kind: "course" | "exam_pack" | "bundle" | "fortune";
  title: string;
  description?: string | null;
  priceSatang: number;
  active: boolean;
};

export type ProductInput = {
  title: string;
  description: string | null;
  priceSatang: number;
  active: boolean;
};

export type CountdownStatus = "upcoming" | "urgent" | "passed";

export type ExamSettings = {
  examDate: string;
  examVenueLabel: string;
  enrollCloseAt: string;
  urgentDays: number;
  timeMultiplierPercent: number;
  serverNow: string;
  daysLeft: number;
  status: CountdownStatus;
  updatedAt: string;
};

export type DaySeries = { day: string; n: number }[];

export type Stats = {
  generatedAt: string;
  totals: {
    users: number;
    orders: number;
    paidOrders: number;
    revenueSatang: number;
    attempts: number;
    submittedAttempts: number;
    avgScore: number | null;
    activeEntitlements: number;
    questions: number;
    activeQuestions: number;
  };
  ordersByStatus: Partial<Record<"pending" | "paid" | "failed" | "refunded", number>>;
  series: { days: number; signups: DaySeries; attempts: DaySeries; paidOrders: DaySeries };
  packs: { id: string; slug: string; title: string; questionCount: number; assigned: number }[];
  recentOrders: {
    id: string;
    status: "pending" | "paid" | "failed" | "refunded";
    amountSatang: number;
    studentName: string | null;
    productTitle: string;
    createdAt: string;
  }[];
};

/** GET /admin/site/assets — every editable image slot with its current value. */
export type SiteAssetSlot = {
  key: string;
  label: string;
  hint: string;
  ratio: string;
  group: "brand" | "landing" | "about" | "courses";
  asset: { imageUrl: string; alt: string; updatedAt: string } | null;
};

/** GET /admin/site/texts — every editable copy slot with default + override. */
export type SiteTextSlot = {
  key: string;
  label: string;
  group: "brand" | "home" | "about" | "courses" | "footer";
  kind: "text" | "multiline" | "lines";
  hint?: string;
  default: string;
  override: { value: string; updatedAt: string } | null;
};

export type UserRole = "admin" | "dev" | "test" | "student";

export const ROLES: { id: UserRole; label: string; desc: string; tone: "brand" | "teal" | "amber" | "neutral" }[] = [
  { id: "admin", label: "ผู้ดูแลระบบ", desc: "เข้าแผงผู้ดูแลได้ทุกส่วน", tone: "brand" },
  { id: "dev", label: "นักพัฒนา", desc: "เข้าแผงผู้ดูแลได้เหมือน admin", tone: "teal" },
  { id: "test", label: "ผู้ทดสอบ", desc: "บัญชีทดสอบ ใช้งานเหมือนนักเรียน", tone: "amber" },
  { id: "student", label: "นักเรียน", desc: "ค่าเริ่มต้นของทุกคนที่สมัครใหม่", tone: "neutral" },
];

export const roleMeta = (id: UserRole) => ROLES.find((r) => r.id === id) ?? ROLES[3];

export type AdminUser = {
  id: string;
  email: string;
  displayName: string | null;
  avatarUrl: string | null;
  role: UserRole;
  createdAt?: string;
};

export type UsersResponse = { users: AdminUser[]; roles: UserRole[]; counts: Partial<Record<UserRole, number>> };
