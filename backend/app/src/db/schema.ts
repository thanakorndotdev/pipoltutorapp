import { relations } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  jsonb,
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
 * `correctChoice` never leaves the server on student-facing paths: grading
 * runs server-side so the answer key is not reachable from the browser. Only
 * the admin API (x-admin-key) may read or write it.
 */
export const questions = pgTable(
  "questions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    subject: questionSubject("subject").notNull(),
    /** Free-text chapter/topic within the subject, e.g. "สมการเชิงเส้น". */
    topic: text("topic").notNull(),
    prompt: text("prompt").notNull(),
    imageUrl: text("image_url"),
    /** [{ key: "a", text: "..." }, ...] */
    choices: jsonb("choices").notNull(),
    correctChoice: text("correct_choice").notNull(),
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
    score: integer("score"),
    /** { "<topic>": { correct: n, total: n } } filled in at grading time. */
    topicBreakdown: jsonb("topic_breakdown"),
  },
  (t) => [index("attempts_user_id_idx").on(t.userId)]
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
    selectedChoice: text("selected_choice"),
    state: answerState("state").notNull().default("untouched"),
    isCorrect: boolean("is_correct"),
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
    /**
     * Attempt time allowance as a percentage of exam_packs.duration_seconds.
     * 150 = 1.5× the pack's set time. Integer to avoid float drift.
     */
    timeMultiplierPercent: integer("time_multiplier_percent").notNull().default(150),
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
