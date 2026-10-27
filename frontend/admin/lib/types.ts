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

/** single = radio (ปรนัย), multiple = checkbox (หลายตัวเลือก), short = เติมคำตอบ. */
export type QuestionType = "single" | "multiple" | "short";
export type ScoringMode = "exact" | "partial";

export const QUESTION_TYPES: { id: QuestionType; label: string; short: string; icon: string }[] = [
  { id: "single", label: "ปรนัย เลือก 1 ข้อ (radio)", short: "ปรนัย", icon: "radio_button_checked" },
  { id: "multiple", label: "เลือกได้หลายข้อ (checkbox)", short: "หลายตัวเลือก", icon: "check_box" },
  { id: "short", label: "เติมคำตอบ", short: "เติมคำ", icon: "edit_note" },
];
export const typeMeta = (id: QuestionType) => QUESTION_TYPES.find((t) => t.id === id) ?? QUESTION_TYPES[0];

export type Question = {
  id: string;
  subject: Subject;
  topic: string;
  prompt: string;
  imageUrls: string[];
  linkUrls: string[];
  type: QuestionType;
  points: number;
  scoring: ScoringMode;
  choices: Choice[];
  correctChoices: string[];
  acceptedAnswers: string[];
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
  imageUrls: string[];
  linkUrls: string[];
  type: QuestionType;
  points: number;
  scoring: ScoringMode;
  choices: Choice[];
  correctChoices: string[];
  acceptedAnswers: string[];
  explanation: string | null;
  active: boolean;
};

export type Pack = {
  id: string;
  slug: string;
  title: string;
  /** คำชี้แจง shown before the timer starts. */
  description: string | null;
  questionCount: number;
  durationSeconds: number;
  /** null = unlimited. */
  maxAttempts: number | null;
  opensAt: string | null;
  /** Hard deadline. */
  closesAt: string | null;
  published: boolean;
  showReview: boolean;
  /** PDF of the paper (usually Google Drive); students see it only after starting. */
  paperUrl: string | null;
  createdAt: string;
  assigned: number;
  totalPoints?: number;
  attempts?: number;
  /** Students mid-attempt right now; structure edits wait for zero. */
  liveAttempts?: number;
};

export type PackInput = {
  slug: string;
  title: string;
  description: string | null;
  questionCount: number;
  durationSeconds: number;
  maxAttempts: number | null;
  opensAt: string | null;
  closesAt: string | null;
  published: boolean;
  showReview: boolean;
  paperUrl: string | null;
};

/** A question as it sits in a pack (admin projection, includes the key). */
export type PackQuestion = {
  position: number;
  section: string | null;
  id: string;
  subject: Subject;
  topic: string;
  type: QuestionType;
  points: number;
  prompt: string;
  imageUrls: string[];
  linkUrls: string[];
  choices: Choice[];
  correctChoices: string[];
  acceptedAnswers: string[];
  active: boolean;
};

export type AttemptStatus = "in_progress" | "submitted" | "expired";

export const ATTEMPT_STATUS: Record<AttemptStatus, { label: string; tone: "amber" | "green" | "brand" }> = {
  in_progress: { label: "กำลังทำ", tone: "amber" },
  submitted: { label: "ส่งแล้ว", tone: "green" },
  expired: { label: "หมดเวลา", tone: "brand" },
};

/** One attempt in the admin results table; profile fields are the snapshot taken at start. */
export type AdminAttempt = {
  id: string;
  userId: string;
  packId: string;
  attemptNo: number;
  status: AttemptStatus;
  startedAt: string;
  expiresAt: string;
  submittedAt: string | null;
  score: number | null;
  maxScore: number | null;
  resetAt: string | null;
  scoreHistory: { score: number | null; maxScore: number | null; at: string }[] | null;
  firstName: string | null;
  lastName: string | null;
  nickname: string | null;
  campus: string | null;
  email: string | null;
};

/** GET /admin/users/:id — profile plus every attempt on every pack. */
export type StudentDetail = {
  user: AdminUser;
  attempts: (AdminAttempt & { packTitle: string; packSlug: string })[];
};

export type AttemptDetail = {
  attempt: AdminAttempt & { pack: { title: string; slug: string } };
  questions: (Omit<PackQuestion, "id" | "subject" | "topic" | "active" | "imageUrls" | "linkUrls"> & {
    questionId: string;
    scoring: ScoringMode;
    selectedChoices: string[];
    textAnswer: string | null;
    pointsAwarded: number | null;
    answeredAt: string | null;
  })[];
};

export type RegradeResult = {
  checked: number;
  changes: { attemptId: string; oldScore: number | null; newScore: number; oldMaxScore: number | null; newMaxScore: number }[];
};

export type Product = {
  id: string;
  slug: string;
  kind: "course" | "exam_pack" | "bundle" | "fortune";
  title: string;
  description?: string | null;
  priceSatang: number;
  active: boolean;
  badge: string | null;
  unit: string | null;
  ctaLabel: string | null;
  features: string[];
  featured: boolean;
  sortOrder: number;
};

export type ProductInput = {
  title: string;
  description: string | null;
  priceSatang: number;
  active: boolean;
  /** Price-card copy on /courses and home; not shown for fortune topics. */
  badge: string | null;
  unit: string | null;
  ctaLabel: string | null;
  features: string[];
  featured: boolean;
  sortOrder: number;
};

export type CountdownStatus = "upcoming" | "urgent" | "passed";

export type ExamSettings = {
  examDate: string;
  examVenueLabel: string;
  enrollCloseAt: string;
  urgentDays: number;
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
  firstName?: string | null;
  lastName?: string | null;
  nickname?: string | null;
  campus?: string | null;
  createdAt?: string;
};

export type UsersResponse = { users: AdminUser[]; roles: UserRole[]; counts: Partial<Record<UserRole, number>> };

/** Same 18 codes as the backend's pcshs_campus enum, for labels only. */
export const CAMPUS_LABEL: Record<string, string> = {
  chiang_rai: "จภ. เชียงราย",
  phitsanulok: "จภ. พิษณุโลก",
  lopburi: "จภ. ลพบุรี",
  loei: "จภ. เลย",
  mukdahan: "จภ. มุกดาหาร",
  buriram: "จภ. บุรีรัมย์",
  pathum_thani: "จภ. ปทุมธานี",
  chonburi: "จภ. ชลบุรี",
  phetchaburi: "จภ. เพชรบุรี",
  nakhon_si_thammarat: "จภ. นครศรีธรรมราช",
  trang: "จภ. ตรัง",
  satun: "จภ. สตูล",
  lampang: "จภ. ลำปาง",
  kamphaeng_phet: "จภ. กำแพงเพชร",
  kalasin: "จภ. กาฬสินธุ์",
  ubon_ratchathani: "จภ. อุบลราชธานี",
  suphan_buri: "จภ. สุพรรณบุรี",
  sa_kaeo: "จภ. สระแก้ว",
};

export const fmtPoints = (n: number | null | undefined) =>
  n === null || n === undefined ? "—" : Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/0$/, "");
