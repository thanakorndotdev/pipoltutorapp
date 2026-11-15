import { relations, sql } from "drizzle-orm";
import {
  boolean,
  doublePrecision,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  index,
} from "drizzle-orm/pg-core";
import { articles, attempts, examPacks, users } from "./schema";

const created = () =>
  timestamp("created_at", { withTimezone: true }).notNull().defaultNow();
export type Metric = "score" | "rank" | "mean" | "sd" | "z" | "percentile";
export type Metrics = Record<Metric, number | null>;
export type RankedRow = {
  userId: string;
  attemptId: string;
  name: string;
  email: string;
  activeSeconds: number | null;
  startedAt: string;
  flags: string[];
  reference: boolean;
  calculated: Metrics;
  official: Metrics;
  review: Metric[];
  overrides: Partial<
    Record<
      Metric,
      {
        value: number;
        reason: string;
        actorId: string | null;
        source: string;
        at: string;
      }
    >
  >;
};
export type RankingSnapshot = {
  nRank: number;
  nRef: number;
  mean: number | null;
  sd: number | null;
  rows: RankedRow[];
  publishedFinal: boolean;
  policy: string;
  visibility: string[];
  dataHash: string;
};
export const rankingConfigs = pgTable("ranking_configs", {
  packId: uuid("pack_id")
    .primaryKey()
    .references(() => examPacks.id, { onDelete: "cascade" }),
  policy: text("policy").notNull().default("best"),
  visibility: text("visibility")
    .array()
    .notNull()
    .default(sql`ARRAY['score','rank','mean','sd','z','percentile']::text[]`),
  publishedFinal: boolean("published_final").notNull().default(false),
  version: integer("version").notNull().default(0),
  currentVersionId: uuid("current_version_id"),
  suspiciousSeconds: integer("suspicious_seconds").notNull().default(30),
});
export const rankingDecisions = pgTable(
  "ranking_decisions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    packId: uuid("pack_id")
      .notNull()
      .references(() => examPacks.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    approvedReference: boolean("approved_reference").notNull().default(true),
    reason: text("reason").notNull(),
    actorId: uuid("actor_id"),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("ranking_decisions_pack_user_key").on(t.packId, t.userId),
  ],
);
export const rankingOverrides = pgTable(
  "ranking_overrides",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    packId: uuid("pack_id")
      .notNull()
      .references(() => examPacks.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    metric: text("metric").$type<Metric>().notNull(),
    value: doublePrecision("value").notNull(),
    reason: text("reason").notNull(),
    source: text("source").notNull(),
    actorId: uuid("actor_id"),
    createdAt: created(),
  },
  (t) => [
    uniqueIndex("ranking_overrides_pack_user_metric_key").on(
      t.packId,
      t.userId,
      t.metric,
    ),
  ],
);
export const rankingVersions = pgTable(
  "ranking_versions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    packId: uuid("pack_id")
      .notNull()
      .references(() => examPacks.id, { onDelete: "cascade" }),
    version: integer("version").notNull(),
    trigger: text("trigger").notNull(),
    actorId: uuid("actor_id"),
    reason: text("reason"),
    rollbackOf: uuid("rollback_of"),
    snapshot: jsonb("snapshot").$type<RankingSnapshot>().notNull(),
    affectedCount: integer("affected_count").notNull(),
    createdAt: created(),
  },
  (t) => [
    uniqueIndex("ranking_versions_pack_version_key").on(t.packId, t.version),
  ],
);
/** A digest-bound preview is committed once, against the same source version. */
export const actionPreviews = pgTable("action_previews", {
  id: uuid("id").primaryKey().defaultRandom(),
  module: text("module").notNull(),
  targetId: text("target_id").notNull(),
  actorKey: text("actor_key").notNull(),
  baseVersion: text("base_version").notNull(),
  payload: jsonb("payload").notNull(),
  digest: text("digest").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  committedAt: timestamp("committed_at", { withTimezone: true }),
  createdAt: created(),
});
export const categories = pgTable(
  "article_categories",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    kind: text("kind").notNull().default("category"),
    parentId: uuid("parent_id"),
    sortOrder: integer("sort_order").notNull().default(0),
    slug: text("slug").notNull(),
  },
  (t) => [uniqueIndex("article_categories_slug_key").on(t.slug)],
);
export const articleRevisions = pgTable(
  "article_revisions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    articleId: uuid("article_id")
      .notNull()
      .references(() => articles.id, { onDelete: "cascade" }),
    version: integer("version").notNull(),
    snapshot: jsonb("snapshot").notNull(),
    actorId: uuid("actor_id"),
    action: text("action").notNull(),
    createdAt: created(),
  },
  (t) => [
    uniqueIndex("article_revisions_article_version_key").on(
      t.articleId,
      t.version,
    ),
  ],
);
export const articleRedirects = pgTable("article_redirects", {
  slug: text("slug").primaryKey(),
  articleId: uuid("article_id")
    .notNull()
    .references(() => articles.id, { onDelete: "cascade" }),
});
export const comments = pgTable(
  "article_comments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    articleId: uuid("article_id")
      .notNull()
      .references(() => articles.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    parentId: uuid("parent_id"),
    text: text("text").notNull(),
    status: text("status").notNull().default("published"),
    flags: text("flags")
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    notifiedAt: timestamp("notified_at", { withTimezone: true }),
    createdAt: created(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("article_comments_article_idx").on(t.articleId)],
);
export const articleEvents = pgTable(
  "article_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    articleId: uuid("article_id")
      .notNull()
      .references(() => articles.id, { onDelete: "cascade" }),
    visitorKey: text("visitor_key").notNull(),
    day: text("day").notNull(),
    kind: text("kind").notNull(),
    referrer: text("referrer"),
    createdAt: created(),
  },
  (t) => [
    uniqueIndex("article_events_dedup_key").on(
      t.articleId,
      t.visitorKey,
      t.day,
      t.kind,
    ),
  ],
);
export const featureSettings = pgTable("feature_settings", {
  key: text("key").primaryKey(),
  value: jsonb("value").notNull(),
  version: integer("version").notNull().default(1),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});
export const searchQueries = pgTable(
  "article_search_queries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    query: text("query").notNull(),
    visitorKey: text("visitor_key").notNull(),
    day: text("day").notNull(),
    createdAt: created(),
  },
  (t) => [
    uniqueIndex("search_queries_dedup_key").on(t.query, t.visitorKey, t.day),
  ],
);
export type DailyQuestion = {
  id: string;
  type: "single" | "multiple" | "short";
  subject: "math" | "science" | "general_aptitude" | "thai" | "english";
  topic: string;
  prompt: string;
  choices: { key: string; text: string }[];
  correctChoices: string[];
  acceptedAnswers: string[];
  hint: string;
  showHint: boolean;
  explanation: string;
  reveal: "finished" | "next_day";
  /** Figures and reference links, same rules as the exam question bank. */
  imageUrls?: string[];
  linkUrls?: string[];
  /** Exam-bank question this item was copied from; the daily keeps its own snapshot. */
  sourceQuestionId?: string;
};
export const dailyChallenges = pgTable(
  "daily_challenges",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    title: text("title").notNull(),
    date: text("local_date"),
    status: text("status").notNull().default("draft"),
    queueOrder: integer("queue_order").notNull().default(0),
    questions: jsonb("questions").$type<DailyQuestion[]>().notNull(),
    revision: integer("revision").notNull().default(1),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    createdAt: created(),
  },
  (t) => [
    uniqueIndex("daily_challenges_date_key")
      .on(t.date)
      .where(sql`${t.status} <> 'draft'`),
  ],
);
export const dailyAssignments = pgTable("daily_assignments", {
  date: text("local_date").primaryKey(),
  challengeId: uuid("challenge_id").references(() => dailyChallenges.id),
  title: text("title").notNull(),
  questions: jsonb("questions").$type<DailyQuestion[]>().notNull(),
  revision: integer("revision").notNull().default(1),
  archivedQuestionIds: uuid("archived_question_ids").array(),
  createdAt: created(),
});
export type DailyAnswer = {
  selectedChoices: string[];
  textAnswer: string | null;
};
export const dailyResponses = pgTable(
  "daily_responses",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    date: text("local_date")
      .notNull()
      .references(() => dailyAssignments.date),
    questionId: text("question_id").notNull(),
    tryNo: integer("try_no").notNull(),
    requestId: uuid("request_id").notNull(),
    answer: jsonb("answer").$type<DailyAnswer>().notNull(),
    correct: boolean("correct").notNull(),
    hintShown: boolean("hint_shown").notNull().default(false),
    verdictHistory: jsonb("verdict_history")
      .$type<{ correct: boolean; at: string; reason: string }[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    createdAt: created(),
  },
  (t) => [
    uniqueIndex("daily_responses_user_question_try_key").on(
      t.userId,
      t.date,
      t.questionId,
      t.tryNo,
    ),
    uniqueIndex("daily_responses_user_request_key").on(t.userId, t.requestId),
  ],
);
export const fireSummary = pgTable("fire_summary", {
  userId: uuid("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  current: integer("current").notNull().default(0),
  highest: integer("highest").notNull().default(0),
  lastDate: text("last_date").notNull(),
  pendingDate: text("pending_date"),
  version: integer("version").notNull().default(1),
});
export const fireLedger = pgTable(
  "fire_daily_ledger",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    date: text("local_date").notNull(),
    state: text("state").notNull(),
    increment: integer("increment").notNull().default(0),
    /** Current immediately before a missed day reset; enables audited outage recovery. */
    previousCurrent: integer("previous_current"),
    source: text("source"),
    createdAt: created(),
  },
  (t) => [uniqueIndex("fire_ledger_user_date_key").on(t.userId, t.date)],
);
/**
 * FIRE-12 Extend: an approved outage window that keeps one Bangkok day's
 * challenge open past its normal 23:59:59 close. Created only before that
 * close, so the answer key has never been revealed or archived. userIds null
 * means every learner. While any row for a date is active, reveal and archive
 * copy of that date wait for the latest `until`.
 */
export const dailyExtensions = pgTable(
  "daily_extensions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    date: text("local_date").notNull(),
    until: timestamp("until", { withTimezone: true }).notNull(),
    userIds: jsonb("user_ids").$type<string[] | null>(),
    source: uuid("source").notNull(),
    reason: text("reason").notNull(),
    createdAt: created(),
  },
  (t) => [
    index("daily_extensions_date_idx").on(t.date),
    uniqueIndex("daily_extensions_source_key").on(t.source),
  ],
);
export const fireRecovery = pgTable(
  "fire_recovery",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    missedDate: text("missed_date").notNull(),
    month: text("month").notNull(),
    usedQuota: boolean("used_quota").notNull().default(true),
    reason: text("reason"),
    createdAt: created(),
  },
  (t) => [
    uniqueIndex("fire_recovery_user_missed_key").on(t.userId, t.missedDate),
  ],
);
export const dailyRevisions = pgTable("daily_revisions", {
  id: uuid("id").primaryKey().defaultRandom(),
  challengeId: uuid("challenge_id")
    .notNull()
    .references(() => dailyChallenges.id),
  version: integer("version").notNull(),
  snapshot: jsonb("snapshot").notNull(),
  actorId: uuid("actor_id"),
  reason: text("reason").notNull(),
  createdAt: created(),
});
export const errorLogs = pgTable("error_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  module: text("module").notNull(),
  code: text("code").notNull(),
  requestId: text("request_id"),
  message: text("message").notNull(),
  createdAt: created(),
});
export const retentionPolicies = pgTable("retention_policies", {
  category: text("category").primaryKey(),
  days: integer("days"),
  approvedBy: uuid("approved_by"),
  approvedAt: timestamp("approved_at", { withTimezone: true }),
  version: integer("version").notNull().default(1),
});
export const deletionConsents = pgTable("deletion_consents", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull(),
  certificatePolicy: text("certificate_policy").notNull(),
  noticeVersion: text("notice_version").notNull(),
  createdAt: created(),
});

export const rankingConfigsRelations = relations(rankingConfigs, ({ one }) => ({
  pack: one(examPacks, {
    fields: [rankingConfigs.packId],
    references: [examPacks.id],
  }),
}));
export const rankingDecisionsRelations = relations(
  rankingDecisions,
  ({ one }) => ({
    user: one(users, {
      fields: [rankingDecisions.userId],
      references: [users.id],
    }),
  }),
);
export const rankingOverridesRelations = relations(
  rankingOverrides,
  ({ one }) => ({
    user: one(users, {
      fields: [rankingOverrides.userId],
      references: [users.id],
    }),
  }),
);
export const rankingVersionsRelations = relations(
  rankingVersions,
  ({ one }) => ({
    pack: one(examPacks, {
      fields: [rankingVersions.packId],
      references: [examPacks.id],
    }),
  }),
);
export const actionPreviewsRelations = relations(actionPreviews, () => ({}));
export const categoriesRelations = relations(categories, () => ({}));
export const articleRevisionsRelations = relations(
  articleRevisions,
  ({ one }) => ({
    article: one(articles, {
      fields: [articleRevisions.articleId],
      references: [articles.id],
    }),
  }),
);
export const articleRedirectsRelations = relations(
  articleRedirects,
  ({ one }) => ({
    article: one(articles, {
      fields: [articleRedirects.articleId],
      references: [articles.id],
    }),
  }),
);
export const commentsRelations = relations(comments, ({ one }) => ({
  user: one(users, { fields: [comments.userId], references: [users.id] }),
  article: one(articles, {
    fields: [comments.articleId],
    references: [articles.id],
  }),
}));
export const articleEventsRelations = relations(articleEvents, ({ one }) => ({
  article: one(articles, {
    fields: [articleEvents.articleId],
    references: [articles.id],
  }),
}));
export const featureSettingsRelations = relations(featureSettings, () => ({}));
export const searchQueriesRelations = relations(searchQueries, () => ({}));
export const dailyChallengesRelations = relations(dailyChallenges, () => ({}));
export const dailyAssignmentsRelations = relations(
  dailyAssignments,
  ({ one }) => ({
    challenge: one(dailyChallenges, {
      fields: [dailyAssignments.challengeId],
      references: [dailyChallenges.id],
    }),
  }),
);
export const dailyResponsesRelations = relations(dailyResponses, ({ one }) => ({
  user: one(users, { fields: [dailyResponses.userId], references: [users.id] }),
}));
export const fireSummaryRelations = relations(fireSummary, ({ one }) => ({
  user: one(users, { fields: [fireSummary.userId], references: [users.id] }),
}));
export const fireLedgerRelations = relations(fireLedger, ({ one }) => ({
  user: one(users, { fields: [fireLedger.userId], references: [users.id] }),
}));
export const fireRecoveryRelations = relations(fireRecovery, ({ one }) => ({
  user: one(users, { fields: [fireRecovery.userId], references: [users.id] }),
}));
export const dailyRevisionsRelations = relations(dailyRevisions, ({ one }) => ({
  challenge: one(dailyChallenges, {
    fields: [dailyRevisions.challengeId],
    references: [dailyChallenges.id],
  }),
}));
export const errorLogsRelations = relations(errorLogs, () => ({}));
export const retentionPoliciesRelations = relations(
  retentionPolicies,
  () => ({}),
);
export const deletionConsentsRelations = relations(
  deletionConsents,
  () => ({}),
);

/** Browser activity is evidence for review, never an automatically trusted duration. */
export const attemptActivityStreams = pgTable("attempt_activity_streams", {
  id: uuid("id").primaryKey().defaultRandom(),
  attemptId: uuid("attempt_id").notNull().references(() => attempts.id, { onDelete: "cascade" }),
  clientId: uuid("client_id").notNull(),
  startedAt: timestamp("created_at", {withTimezone:true}).notNull().defaultNow(),
  sequence: integer("sequence").notNull().default(0),
  elapsedMs: integer("elapsed_ms").notNull().default(0),
  activeMs: integer("active_ms").notNull().default(0),
  offlineMs: integer("offline_ms").notNull().default(0),
  updatedAt: timestamp("updated_at", {withTimezone:true}).notNull().defaultNow(),
  checkpoints: jsonb("checkpoints").$type<{sequence:number;elapsedMs:number;activeMs:number;offlineMs:number;receivedAt:string}[]>().notNull().default([]),
}, t => [uniqueIndex("attempt_activity_attempt_client_key").on(t.attemptId,t.clientId)]);
export const attemptActivityStreamsRelations = relations(attemptActivityStreams, ({one}) => ({
  attempt:one(attempts,{fields:[attemptActivityStreams.attemptId],references:[attempts.id]}),
}));
