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

export type Pack = CertPackSettings & {
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

export type PackInput = CertPackSettings & {
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

/** One piece of an article body; mirrors ArticleBlock in backend/app/src/db/schema.ts. */
export type ArticleBlock =
  | { type: "heading"; text: string }
  /** Paragraphs split on blank lines; **bold** and bare https links are the only inline marks. */
  | { type: "text"; text: string }
  | { type: "image"; url: string; alt: string; caption: string; width?: number; align?: "left" | "center" | "right" }
  | { type: "rich"; text: string; fontSize?: number; color?: string; background?: string; align?: "left" | "center" | "right" }
  | { type: "list"; items: string[]; ordered: boolean }
  | { type: "quote" | "code" | "callout" | "math"; text: string }
  | { type: "separator" }
  | { type: "button" | "attachment"; text: string; url: string }
  | { type: "video"; url: string; title: string }
  | { type: "columns"; columns: ArticleBlock[][] }
  | { type: "table"; rows: { text: string; rowSpan?: number; colSpan?: number; align?: "left" | "center" | "right"; background?: string }[][] };

export type ArticleCard = {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  coverUrl: string | null;
  published: boolean;
  /** Set the first time it was published. */
  publishedAt: string | null;
  updatedAt: string;
};

export type Article = ArticleCard & { blocks: ArticleBlock[] };

export type ArticleInput = {
  title: string;
  excerpt: string | null;
  coverUrl: string | null;
  blocks: ArticleBlock[];
  published: boolean;
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
  effectivePermissions?: Record<string, string[]>;
  staffRole?:string|null;
  modulePermissions?:Record<string,string[]>;
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

/** Certificates (SoW M1). Shapes from /admin/certificates and /admin/cert-templates. */
export type CertStatus = "queued" | "valid" | "render_failed" | "revoked" | "previous_valid" | "superseded";

export const CERT_STATUS: Record<CertStatus, { label: string; tone: "amber" | "green" | "red" | "brand" | "neutral" }> = {
  queued: { label: "รอสร้างไฟล์", tone: "amber" },
  valid: { label: "ใช้ได้", tone: "green" },
  render_failed: { label: "สร้างไม่สำเร็จ (ลองใหม่ได้)", tone: "red" },
  revoked: { label: "เพิกถอนแล้ว", tone: "neutral" },
  previous_valid: { label: "ฉบับก่อนหน้า (ยังใช้ได้)", tone: "brand" },
  superseded: { label: "ถูกแทนที่", tone: "neutral" },
};

export type AdminCertificate = {
  id: string;
  publicId: string;
  serial: string;
  status: CertStatus;
  revision: number;
  recipientName: string;
  issuedAt: string;
  revokedAt: string | null;
  revokeReason: string | null;
  attemptId: string;
  packId: string;
  packTitle: string;
  email: string;
  jobStatus: "pending" | "running" | "done" | "failed" | null;
  jobTries: number | null;
  jobError: string | null;
};

export type CertPackSettings = {
  level: "m1" | "m4" | null;
  subjectLabel: string | null;
  certificateEnabled: boolean;
  certOnAutoSubmit: boolean;
  certOnHardCutoff: boolean;
  certOnReopen: boolean;
  certTemplateId: string | null;
};

export type CertPack = CertPackSettings & { id: string; title: string; slug: string; live: number };

export type CertElement =
  | { id: string; type: "text"; text: string; x: number; y: number; w: number; size: number; weight: 400 | 500 | 600; font: "display" | "body"; color: string; align: "left" | "center" | "right"; fit?: boolean; lineHeight?: number }
  | { id: string; type: "image"; url: string; x: number; y: number; w: number; h: number; crop?: { zoom: number; offsetX: number; offsetY: number } }
  | { id: string; type: "qr"; x: number; y: number; size: number };

export type CertLayout = {
  paper: "a4-landscape" | "a4-portrait";
  background: string | null;
  backgroundFit?: { zoom: number; offsetX: number; offsetY: number };
  decor: "standard" | "none";
  elements: CertElement[];
};

export type CertTemplate = { id: string; name: string; status: "draft" | "published" | "archived"; publishedVersion: number; updatedAt: string; usedByPacks?: number; layout?: CertLayout };

export type CertSigningKey = { keyId: string; algorithm: string; active: boolean; createdAt: string; retiredAt: string | null };
