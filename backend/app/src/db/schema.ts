import { relations, sql } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import { PCSHS_CAMPUS_CODES } from "../campuses";

/**
 * Domain model for PIPOL TUTOR (see PRODUCT.md).
 * Money is stored in satang (THB * 100) as an integer to avoid float drift.
 */

/**
 * Who a signed-in user is. Every Google sign-up starts as "student"; an admin
 * promotes from the dashboard. "admin" and "dev" open the admin panel; "test"
 * is a student-shaped account for QA, kept distinct so stats can exclude it.
 */
export const userRole = pgEnum("user_role", ["admin", "dev", "test", "student"]);
export const USER_ROLES = userRole.enumValues;
export type UserRole = (typeof USER_ROLES)[number];

export const productKind = pgEnum("product_kind", [
  "course",
  "exam_pack",
  "bundle",
  "fortune",
]);

export const orderStatus = pgEnum("order_status", [
  "pending",
  "paid",
  "failed",
  "refunded",
]);

export const attemptStatus = pgEnum("attempt_status", [
  "in_progress",
  "submitted",
  "expired",
]);

export const answerState = pgEnum("answer_state", [
  "untouched",
  "answered",
  "flagged",
]);

/** The five sections of the จภ. ม.1 paper; mirrors SUBJECTS in the exam UI. */
export const questionSubject = pgEnum("question_subject", [
  "math",
  "science",
  "general_aptitude",
  "thai",
  "english",
]);

/**
 * How a question is answered: one choice (radio), several choices
 * (checkbox), or a typed answer (เติมคำ).
 */
export const questionType = pgEnum("question_type", ["single", "multiple", "short"]);
export const QUESTION_TYPES = questionType.enumValues;

/**
 * How a "multiple" question is marked. "exact" gives full points only for
 * the exact set of correct choices; "partial" gives a share per correct
 * choice minus wrong picks (see src/scoring.ts). Other types are always exact.
 */
export const scoringMode = pgEnum("scoring_mode", ["exact", "partial"]);
export const SCORING_MODES = scoringMode.enumValues;

/** Entrance level a pack (and its certificate) is for; independent of the student's own grade. */
export const packLevel = pgEnum("pack_level", ["m1", "m4"]);
export const PACK_LEVELS = packLevel.enumValues;

/**
 * Life of one certificate revision. queued → valid once rendered and signed;
 * render_failed is retryable; revoked / superseded are no longer usable;
 * previous_valid is an older template version the admin chose to keep verifiable.
 */
export const certificateStatus = pgEnum("certificate_status", [
  "queued",
  "valid",
  "render_failed",
  "revoked",
  "previous_valid",
  "superseded",
]);
export const certJobStatus = pgEnum("cert_job_status", ["pending", "running", "done", "failed"]);
export const certTemplateStatus = pgEnum("cert_template_status", ["draft", "published", "archived"]);

/** The 18 จภ. campuses a student can apply to; values live in src/campuses.ts. */
export const pcshsCampus = pgEnum("pcshs_campus", PCSHS_CAMPUS_CODES);

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    googleId: text("google_id").notNull(),
    email: text("email").notNull(),
    displayName: text("display_name"),
    avatarUrl: text("avatar_url"),
    role: userRole("role").notNull().default("student"),
    /** Staff templates are separate from the legacy exam/testing role. */
    staffRole: text("staff_role").$type<"owner" | "admin" | "author" | "moderator" | "results_viewer" | "none">(),
    modulePermissions: jsonb("module_permissions").$type<Record<string, string[]>>().notNull().default(sql`'{}'::jsonb`),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    /**
     * Student profile filled in once after the first Google login. All four
     * are required before an exam can start; attempts copy them at start so
     * a later edit does not rewrite history.
     */
    firstName: text("first_name"),
    lastName: text("last_name"),
    nickname: text("nickname"),
    campus: pcshsCampus("campus"),
    /** Student-written "about me" shown on their profile; plain text, moderated by staff. */
    bio: text("bio"),
    /** Uploaded profile photo (/api/uploads/...), re-encoded server-side; overrides the Google avatar. */
    photoUrl: text("photo_url"),
    lineInviteSentAt: timestamp("line_invite_sent_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("users_google_id_key").on(t.googleId),
    uniqueIndex("users_email_key").on(t.email),
  ]
);

/**
 * Login sessions. The browser holds the random token in the pt_session
 * cookie; only its SHA-256 is stored, so a DB read cannot be replayed.
 */
export const sessions = pgTable(
  "sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tokenHash: text("token_hash").notNull(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [uniqueIndex("sessions_token_hash_key").on(t.tokenHash), index("sessions_user_id_idx").on(t.userId)]
);

export const products = pgTable(
  "products",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    slug: text("slug").notNull(),
    kind: productKind("kind").notNull(),
    title: text("title").notNull(),
    description: text("description"),
    priceSatang: integer("price_satang").notNull(),
    active: boolean("active").notNull().default(true),
    /**
     * Price-card copy for the /courses and home grids (fortune products are
     * not shown there). Null badge/unit/ctaLabel fall back to per-kind defaults.
     */
    badge: text("badge"),
    unit: text("unit"),
    ctaLabel: text("cta_label"),
    features: text("features").array().notNull().default(sql`'{}'::text[]`),
    /** Rendered as the highlighted (gradient) card. */
    featured: boolean("featured").notNull().default(false),
    /** Ascending; ties fall back to price. */
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [uniqueIndex("products_slug_key").on(t.slug)]
);

export const orders = pgTable(
  "orders",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "restrict" }),
    status: orderStatus("status").notNull().default("pending"),
    amountSatang: integer("amount_satang").notNull(),
    /**
     * Student details captured on the checkout form. Nullable because orders
     * created before the form existed have none; the API requires them.
     */
    studentName: text("student_name"),
    currentSchool: text("current_school"),
    /** Which จภ. the student is aiming for. */
    targetCampus: pcshsCampus("target_campus"),
    /** Instagram handle without the leading "@". */
    studentInstagram: text("student_instagram"),
    parentPhone: text("parent_phone"),
    receiptEmail: text("receipt_email"),
    /** Gateway not chosen yet; keep the raw reference and payload opaque. */
    gateway: text("gateway"),
    gatewayRef: text("gateway_ref"),
    gatewayPayload: jsonb("gateway_payload"),
    paidAt: timestamp("paid_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("orders_user_id_idx").on(t.userId)]
);

/** What a user may open right now. Written when an order flips to paid. */
export const entitlements = pgTable(
  "entitlements",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    orderId: uuid("order_id").references(() => orders.id, {
      onDelete: "set null",
    }),
    grantedAt: timestamp("granted_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
  },
  (t) => [
    uniqueIndex("entitlements_user_product_key").on(t.userId, t.productId),
  ]
);

export const examPacks = pgTable(
  "exam_packs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    slug: text("slug").notNull(),
    title: text("title").notNull(),
    questionCount: integer("question_count").notNull().default(100),
    durationSeconds: integer("duration_seconds").notNull(),
    /** คำชี้แจง shown on the instructions screen before the timer starts. */
    description: text("description"),
    /** Finished attempts a student may have; null means unlimited. Reset attempts do not count. */
    maxAttempts: integer("max_attempts").default(1),
    /** Window in which an attempt may start. Null = no bound on that side. */
    opensAt: timestamp("opens_at", { withTimezone: true }),
    /**
     * Hard deadline: no attempt starts after it and every open attempt's
     * expiresAt is capped at it.
     */
    closesAt: timestamp("closes_at", { withTimezone: true }),
    /** Hidden packs are invisible to students; staff can still open them to test. */
    published: boolean("published").notNull().default(false),
    /** Whether a student may see per-question review and explanations after submitting. */
    showReview: boolean("show_review").notNull().default(false),
    /**
     * Link to the paper as a PDF (usually Google Drive). Students get it only
     * from an open attempt, never before the timer starts.
     */
    paperUrl: text("paper_url"),
    /** ม.1 / ม.4; printed on the certificate and used to file the pack. Null = unspecified. */
    level: packLevel("level"),
    /** Subject line for the certificate, e.g. "คณิตศาสตร์" or "รวม 5 วิชา". */
    subjectLabel: text("subject_label"),
    /** Whether finishing this pack earns a certificate at all (CERT-01). */
    certificateEnabled: boolean("certificate_enabled").notNull().default(false),
    /** Attempt ended by its own timer (status expired, not at the pack deadline). */
    certOnAutoSubmit: boolean("cert_on_auto_submit").notNull().default(true),
    /** Attempt cut off by the pack's hard deadline (closesAt). */
    certOnHardCutoff: boolean("cert_on_hard_cutoff").notNull().default(true),
    /** Attempt an admin reset so the student may sit again. */
    certOnReopen: boolean("cert_on_reopen").notNull().default(false),
    /** Published template for this pack; null = the built-in default layout. */
    certTemplateId: uuid("cert_template_id"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [uniqueIndex("exam_packs_slug_key").on(t.slug)]
);

/**
 * Which products unlock a pack. A pack with no rows here is free; otherwise a
 * student needs a live entitlement on any one of the linked products. This is
 * how the three price tiers map onto packs: the exam-pack product unlocks its
 * packs, the bundle unlocks every pack, and a course may unlock a subset.
 */
export const packProducts = pgTable(
  "pack_products",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    packId: uuid("pack_id")
      .notNull()
      .references(() => examPacks.id, { onDelete: "cascade" }),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
  },
  (t) => [
    uniqueIndex("pack_products_pack_product_key").on(t.packId, t.productId),
    index("pack_products_product_id_idx").on(t.productId),
  ]
);

/**
 * The question bank. A question belongs to no pack by itself; pack_questions
 * places it into one or more packs at a position.
 *
 * The key (`correctChoices`, `acceptedAnswers`) never leaves the server on
 * student-facing paths: grading runs server-side so it is not reachable from
 * the browser. Only the admin API may read or write it.
 */
export const questions = pgTable(
  "questions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    subject: questionSubject("subject").notNull(),
    /** Free-text chapter/topic within the subject, e.g. "สมการเชิงเส้น". */
    topic: text("topic").notNull(),
    prompt: text("prompt").notNull(),
    /** Figures shown under the prompt, in order; any number, empty for none. */
    imageUrls: text("image_urls").array().notNull().default(sql`'{}'::text[]`),
    /** http(s) links shown as named links under the figures, in order. */
    linkUrls: text("link_urls").array().notNull().default(sql`'{}'::text[]`),
    type: questionType("type").notNull().default("single"),
    /** Points for a fully correct answer; decimals allowed (e.g. 1.5). */
    points: numeric("points", { precision: 8, scale: 2, mode: "number" }).notNull().default(1),
    /** Only meaningful for "multiple"; single and short are always exact. */
    scoring: scoringMode("scoring").notNull().default("exact"),
    /** [{ key: "a", text: "..." }, ...]; empty for "short". */
    choices: jsonb("choices").notNull(),
    /** Correct choice keys: one for "single", one or more for "multiple", empty for "short". */
    correctChoices: text("correct_choices").array().notNull().default(sql`'{}'::text[]`),
    /**
     * Accepted typed answers for "short", compared exactly: case, spaces and
     * number format all count ("0.5" and "0.50" differ). Add each variant.
     */
    acceptedAnswers: text("accepted_answers").array().notNull().default(sql`'{}'::text[]`),
    explanation: text("explanation"),
    /** Inactive questions stay in the bank but cannot be added to a pack. */
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("questions_subject_idx").on(t.subject),
    index("questions_topic_idx").on(t.topic),
  ]
);

/** Ordered composition of a pack from the bank. `position` is 1-based. */
export const packQuestions = pgTable(
  "pack_questions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    packId: uuid("pack_id")
      .notNull()
      .references(() => examPacks.id, { onDelete: "cascade" }),
    questionId: uuid("question_id")
      .notNull()
      .references(() => questions.id, { onDelete: "restrict" }),
    position: integer("position").notNull(),
    /** ตอน label, e.g. "ตอนที่ 1 ปรนัย". Null means the pack is not split into sections. */
    section: text("section"),
  },
  (t) => [
    uniqueIndex("pack_questions_pack_position_key").on(t.packId, t.position),
    uniqueIndex("pack_questions_pack_question_key").on(t.packId, t.questionId),
  ]
);

export const attempts = pgTable(
  "attempts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    packId: uuid("pack_id")
      .notNull()
      .references(() => examPacks.id, { onDelete: "cascade" }),
    status: attemptStatus("status").notNull().default("in_progress"),
    startedAt: timestamp("started_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    /** Deadline computed at start; the server, not the client, owns the clock. */
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    submittedAt: timestamp("submitted_at", { withTimezone: true }),
    /** Points earned; decimals possible with partial or fractional points. */
    score: numeric("score", { precision: 10, scale: 2, mode: "number" }),
    /** Sum of the pack's question points at grading time. */
    maxScore: numeric("max_score", { precision: 10, scale: 2, mode: "number" }),
    /** { "<topic>": { correct: n, total: n } } filled in at grading time. */
    topicBreakdown: jsonb("topic_breakdown"),
    /** 1-based count of this user's attempts on the pack, reset ones included. */
    attemptNo: integer("attempt_no").notNull().default(1),
    /**
     * Profile as it was when the attempt started, so exports and history keep
     * the name and campus the student sat under.
     */
    studentFirstName: text("student_first_name"),
    studentLastName: text("student_last_name"),
    studentNickname: text("student_nickname"),
    studentCampus: pcshsCampus("student_campus"),
    studentEmail: text("student_email"),
    /** Set when an admin resets the student's quota; the attempt is kept but no longer counts. */
    resetAt: timestamp("reset_at", { withTimezone: true }),
    /** [{ score, maxScore, at }] — scores replaced by a regrade, oldest first. */
    scoreHistory: jsonb("score_history"),
    /** Server-verified cumulative duration; null for legacy attempts until reviewed. */
    activeSeconds: integer("active_seconds"),
    activeVerified: boolean("active_verified").notNull().default(false),
    activeCheckpointAt: timestamp("active_checkpoint_at", { withTimezone: true }),
    /** Millisecond carry avoids losing/inventing time when checkpoints are frequent. */
    activeRemainderMs: integer("active_remainder_ms").notNull().default(0),
    activeReviewedAt: timestamp("active_reviewed_at", { withTimezone: true }),
  },
  (t) => [
    index("attempts_user_id_idx").on(t.userId),
    /** At most one open attempt per user and pack, so a double start cannot split answers. */
    uniqueIndex("attempts_open_user_pack_key")
      .on(t.userId, t.packId)
      .where(sql`${t.status} = 'in_progress'`),
  ]
);

export const attemptAnswers = pgTable(
  "attempt_answers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    attemptId: uuid("attempt_id")
      .notNull()
      .references(() => attempts.id, { onDelete: "cascade" }),
    questionId: uuid("question_id")
      .notNull()
      .references(() => questions.id, { onDelete: "cascade" }),
    /** Picked choice keys for single/multiple; empty when none. */
    selectedChoices: text("selected_choices").array().notNull().default(sql`'{}'::text[]`),
    /** Typed answer for "short", stored exactly as entered. */
    textAnswer: text("text_answer"),
    state: answerState("state").notNull().default("untouched"),
    /** True only for full points; null until graded. */
    isCorrect: boolean("is_correct"),
    pointsAwarded: numeric("points_awarded", { precision: 8, scale: 2, mode: "number" }),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("attempt_answers_attempt_question_key").on(
      t.attemptId,
      t.questionId
    ),
  ]
);

/**
 * Single-row exam configuration, edited by an admin and read by everyone.
 * `key` is always "default" so the row can be upserted; the uuid is for
 * consistency with the other tables.
 */
export const examSettings = pgTable(
  "exam_settings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    key: text("key").notNull().default("default"),
    /** Date of the จภ. entrance exam the countdown targets. */
    examDate: timestamp("exam_date", { withTimezone: true }).notNull(),
    /** Short venue label shown next to the date, e.g. "จภ.". */
    examVenueLabel: text("exam_venue_label").notNull().default("จภ."),
    /** Last moment a course can be bought. */
    enrollCloseAt: timestamp("enroll_close_at", { withTimezone: true }).notNull(),
    /** Countdown turns orange when this many days or fewer remain. */
    urgentDays: integer("urgent_days").notNull().default(30),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [uniqueIndex("exam_settings_key_key").on(t.key)]
);

/**
 * Editable site images (logo, hero portrait, about-page photos, course
 * posters). One row per slot; the slot list lives in src/site-assets.ts and
 * a slot with no row falls back to the frontend's placeholder. image_url is
 * usually a /api/uploads/<name> path from POST /admin/uploads.
 */
export const siteAssets = pgTable(
  "site_assets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    key: text("key").notNull(),
    imageUrl: text("image_url").notNull(),
    /** Alt text for the <img>; empty means decorative. */
    alt: text("alt").notNull().default(""),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [uniqueIndex("site_assets_key_key").on(t.key)]
);

/**
 * Admin overrides for site copy. One row per overridden key from
 * src/site-texts.ts; a key with no row renders its registered default.
 */
export const siteTexts = pgTable(
  "site_texts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    key: text("key").notNull(),
    value: text("value").notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [uniqueIndex("site_texts_key_key").on(t.key)]
);

/**
 * Certificate layout. Coordinates are fractions of the sheet (0–1) so one
 * layout renders at any resolution; sizes are in units of a 2000-wide sheet.
 * Text may contain {field} placeholders, see CERT_FIELDS in src/certificates/layout.ts.
 */
export type CertElement =
  | {
      id: string;
      type: "text";
      text: string;
      /** Anchor point; `align` says which edge of the text sits on x. */
      x: number;
      y: number;
      /** Max width as a fraction of the sheet; longer text wraps (or shrinks when `fit`). */
      w: number;
      size: number;
      weight: 400 | 500 | 600;
      font: "display" | "body";
      color: string;
      align: "left" | "center" | "right";
      /** One line, shrunk to fit `w` instead of wrapping (names). */
      fit?: boolean;
      /** Line-height multiplier; defaults to 1.6 to keep Thai marks clear. */
      lineHeight?: number;
    }
  | { id: string; type: "image"; url: string; x: number; y: number; w: number; h: number; crop?: { zoom: number; offsetX: number; offsetY: number } }
  | { id: string; type: "qr"; x: number; y: number; size: number };

export type CertLayout = {
  paper: "a4-landscape" | "a4-portrait";
  /** An /api/uploads/<name> path; null = white. */
  background: string | null;
  /** How the background sits when its ratio differs from the paper: zoom ≥ 1, offsets -1..1. */
  backgroundFit?: { zoom: number; offsetX: number; offsetY: number };
  /** "standard" draws the built-in frame, brand row and seal under the elements. */
  decor: "standard" | "none";
  elements: CertElement[];
};

/** Editable template. Certificates never read this row: they point at a published version. */
export const certTemplates = pgTable("cert_templates", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  status: certTemplateStatus("status").notNull().default("draft"),
  /** Working copy; becomes a cert_template_versions row on publish. */
  layout: jsonb("layout").$type<CertLayout>().notNull(),
  /** Latest published version number; 0 = never published. */
  publishedVersion: integer("published_version").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/** Immutable snapshot of a template at publish time; old certificates keep rendering from it. */
export const certTemplateVersions = pgTable(
  "cert_template_versions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    templateId: uuid("template_id")
      .notNull()
      .references(() => certTemplates.id, { onDelete: "cascade" }),
    version: integer("version").notNull(),
    layout: jsonb("layout").$type<CertLayout>().notNull(),
    publishedAt: timestamp("published_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("cert_template_versions_template_version_key").on(t.templateId, t.version)]
);

/**
 * Public half of every signing key ever used, by key id, so a certificate
 * signed before a rotation still verifies. The private half is a PEM file in
 * CERT_KEY_DIR and is never stored here or sent anywhere.
 */
export const certSigningKeys = pgTable("cert_signing_keys", {
  keyId: text("key_id").primaryKey(),
  algorithm: text("algorithm").notNull().default("RSA-PSS-SHA256"),
  publicKeyPem: text("public_key_pem").notNull(),
  /** Exactly one key signs new certificates. */
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  retiredAt: timestamp("retired_at", { withTimezone: true }),
});

/** What the signature covers; stored exactly as signed. */
export type CertManifest = {
  v: 1;
  issuer: string;
  certificate_id: string;
  serial: string;
  attempt_id: string;
  recipient_name: string;
  exam: { pack_id: string; title: string; level: string | null; subject: string | null };
  issued_at: string;
  revision: number;
  template: { id: string | null; version: number };
  key_id: string;
  dynamic_fields?: Record<string,string>;
};

/**
 * One certificate revision for one attempt. A new revision (rename, template
 * change) is a new row with a new public id; the old row changes status.
 */
export const certificates = pgTable(
  "certificates",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** Random public locator: the QR target and the verify URL. Not a secret, not guessable. */
    publicId: text("public_id").notNull(),
    /** Running number printed on the sheet as PT-000123. */
    serialNo: integer("serial_no").generatedAlwaysAsIdentity(),
    attemptId: uuid("attempt_id")
      .notNull()
      .references(() => attempts.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    packId: uuid("pack_id")
      .notNull()
      .references(() => examPacks.id, { onDelete: "cascade" }),
    /** 1-based per attempt. */
    revision: integer("revision").notNull().default(1),
    status: certificateStatus("status").notNull().default("queued"),
    /** Name as printed and signed; a later profile edit makes a new revision instead of changing this. */
    recipientName: text("recipient_name").notNull(),
    /** Null = built-in default layout. */
    templateVersionId: uuid("template_version_id").references(() => certTemplateVersions.id, { onDelete: "restrict" }),
    manifest: jsonb("manifest").$type<CertManifest>(),
    /** SHA-256 of the canonical manifest, hex. */
    manifestHash: text("manifest_hash"),
    /** Base64 RSA-PSS signature of the canonical manifest. */
    signature: text("signature"),
    keyId: text("key_id").references(() => certSigningKeys.keyId, { onDelete: "restrict" }),
    issuedAt: timestamp("issued_at", { withTimezone: true }).notNull().defaultNow(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    /** Machine reason: name_changed | template_changed | attempt_reset | admin. */
    revokeReason: text("revoke_reason"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("certificates_public_id_key").on(t.publicId),
    index("certificates_user_id_idx").on(t.userId),
    index("certificates_pack_id_idx").on(t.packId),
    /** At most one live revision per attempt, so a double trigger cannot issue twice. */
    uniqueIndex("certificates_active_attempt_key")
      .on(t.attemptId)
      .where(sql`${t.status} in ('queued', 'valid', 'render_failed')`),
  ]
);

/** Render queue. One job per certificate; the worker in src/certificates/worker.ts drains it. */
export const certificateJobs = pgTable(
  "certificate_jobs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    certificateId: uuid("certificate_id")
      .notNull()
      .references(() => certificates.id, { onDelete: "cascade" }),
    status: certJobStatus("status").notNull().default("pending"),
    tries: integer("tries").notNull().default(0),
    lastError: text("last_error"),
    /** Not before this moment; pushed back after each failure. */
    runAfter: timestamp("run_after", { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("certificate_jobs_certificate_id_key").on(t.certificateId),
    index("certificate_jobs_status_run_after_idx").on(t.status, t.runAfter),
  ]
);

/**
 * In-site notifications (no email/SMS). The popup shows once per row:
 * dismissedAt set means never again.
 */
export const notifications = pgTable(
  "notifications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    /** certificate_reissued | comment_reply | ... */
    kind: text("kind").notNull(),
    title: text("title").notNull(),
    body: text("body"),
    /** Same-origin path to open. */
    link: text("link"),
    dismissedAt: timestamp("dismissed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("notifications_user_id_idx").on(t.userId, t.dismissedAt)]
);

/**
 * Who changed what, for anything touching certificates, statistics, fire,
 * permissions or publishing. Never holds credentials or private keys.
 */
export const auditLogs = pgTable(
  "audit_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** users.id, or null for the API key / the system. */
    actorId: uuid("actor_id").references(() => users.id, { onDelete: "set null" }),
    /** "user" | "api-key" | "system". */
    actorKind: text("actor_kind").notNull(),
    action: text("action").notNull(),
    module: text("module").notNull(),
    targetId: text("target_id"),
    before: jsonb("before"),
    after: jsonb("after"),
    reason: text("reason"),
    result: text("result").notNull().default("ok"),
    requestId: text("request_id"),
    revisionId: text("revision_id"),
    sourceId: text("source_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("audit_logs_module_created_idx").on(t.module, t.createdAt), index("audit_logs_target_idx").on(t.targetId)]
);

/**
 * One piece of an article body. Stored structured rather than as HTML or
 * markdown so the public page renders it without parsing or sanitising:
 * the admin API validates each block (image URLs included) on the way in.
 */
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

/** บทความ on /articles, written in the admin panel. */
export const articles = pgTable(
  "articles",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** URL segment; fixed after creation so shared links keep working. */
    slug: text("slug").notNull(),
    title: text("title").notNull(),
    /** Short summary for the list card and the page description. */
    excerpt: text("excerpt"),
    /** 16:9 cover; an /api/uploads/<name> path or an https URL. */
    coverUrl: text("cover_url"),
    blocks: jsonb("blocks").$type<ArticleBlock[]>().notNull().default(sql`'[]'::jsonb`),
    kind: text("kind").$type<"lesson" | "news">().notNull().default("lesson"),
    levels: text("levels").array().notNull().default(sql`'{}'::text[]`),
    subjects: text("subjects").array().notNull().default(sql`'{}'::text[]`),
    categoryIds: uuid("category_ids").array().notNull().default(sql`'{}'::uuid[]`),
    tags: text("tags").array().notNull().default(sql`'{}'::text[]`),
    workflow: text("workflow").notNull().default("draft"),
    authorId: uuid("author_id").references(() => users.id, { onDelete: "set null" }),
    approvedBy: uuid("approved_by").references(() => users.id, { onDelete: "set null" }),
    scheduledAt: timestamp("scheduled_at", { withTimezone: true }),
    sourceUrl: text("source_url"),
    sourceCredit: text("source_credit"),
    sourceDate: text("source_date"),
    deadline: timestamp("deadline", { withTimezone: true }),
    viewMode: text("view_mode").notNull().default("none"),
    revision: integer("revision").notNull().default(0),
    /** Public content remains frozen while the next draft is edited. */
    publishedSnapshot: jsonb("published_snapshot"),
    /** Drafts are visible only to admins. */
    published: boolean("published").notNull().default(false),
    /** Set the first time the article is published; kept if it is hidden and shown again. */
    publishedAt: timestamp("published_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("articles_slug_key").on(t.slug),
    index("articles_published_at_idx").on(t.publishedAt),
  ]
);

export const fortuneReadings = pgTable("fortune_readings", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  orderId: uuid("order_id").references(() => orders.id, {
    onDelete: "set null",
  }),
  /** Raw form submission; the prediction rules are still owed by the client. */
  input: jsonb("input").notNull(),
  result: jsonb("result"),
  parentConsent: boolean("parent_consent").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, { fields: [sessions.userId], references: [users.id] }),
}));

export const usersRelations = relations(users, ({ many }) => ({
  sessions: many(sessions),
  orders: many(orders),
  entitlements: many(entitlements),
  attempts: many(attempts),
  fortuneReadings: many(fortuneReadings),
}));

export const productsRelations = relations(products, ({ many }) => ({
  orders: many(orders),
  entitlements: many(entitlements),
  packProducts: many(packProducts),
}));

export const ordersRelations = relations(orders, ({ one, many }) => ({
  user: one(users, { fields: [orders.userId], references: [users.id] }),
  product: one(products, {
    fields: [orders.productId],
    references: [products.id],
  }),
  entitlements: many(entitlements),
}));

export const entitlementsRelations = relations(entitlements, ({ one }) => ({
  user: one(users, { fields: [entitlements.userId], references: [users.id] }),
  product: one(products, {
    fields: [entitlements.productId],
    references: [products.id],
  }),
  order: one(orders, { fields: [entitlements.orderId], references: [orders.id] }),
}));

export const examPacksRelations = relations(examPacks, ({ many }) => ({
  packProducts: many(packProducts),
  packQuestions: many(packQuestions),
  attempts: many(attempts),
}));

export const packProductsRelations = relations(packProducts, ({ one }) => ({
  pack: one(examPacks, {
    fields: [packProducts.packId],
    references: [examPacks.id],
  }),
  product: one(products, {
    fields: [packProducts.productId],
    references: [products.id],
  }),
}));

export const questionsRelations = relations(questions, ({ many }) => ({
  packQuestions: many(packQuestions),
  answers: many(attemptAnswers),
}));

export const packQuestionsRelations = relations(packQuestions, ({ one }) => ({
  pack: one(examPacks, {
    fields: [packQuestions.packId],
    references: [examPacks.id],
  }),
  question: one(questions, {
    fields: [packQuestions.questionId],
    references: [questions.id],
  }),
}));

export const attemptsRelations = relations(attempts, ({ one, many }) => ({
  user: one(users, { fields: [attempts.userId], references: [users.id] }),
  pack: one(examPacks, {
    fields: [attempts.packId],
    references: [examPacks.id],
  }),
  answers: many(attemptAnswers),
}));

export const attemptAnswersRelations = relations(attemptAnswers, ({ one }) => ({
  attempt: one(attempts, {
    fields: [attemptAnswers.attemptId],
    references: [attempts.id],
  }),
  question: one(questions, {
    fields: [attemptAnswers.questionId],
    references: [questions.id],
  }),
}));

export const fortuneReadingsRelations = relations(fortuneReadings, ({ one }) => ({
  user: one(users, { fields: [fortuneReadings.userId], references: [users.id] }),
  order: one(orders, {
    fields: [fortuneReadings.orderId],
    references: [orders.id],
  }),
}));
