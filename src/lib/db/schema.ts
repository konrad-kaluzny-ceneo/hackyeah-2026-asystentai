import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";

/**
 * Canonical store for meta events produced by the client-side behavior
 * pipeline (src/behavior/). Raw events are NEVER persisted — only
 * privacy-safe, deduplicated meta events.
 *
 * Idempotency is enforced by the UNIQUE constraint on `event_id`; producers
 * may retry the same batch without creating duplicates.
 */
export const metaEvents = pgTable(
  "meta_events",
  {
    id: bigint("id", { mode: "bigint" })
      .primaryKey()
      .generatedAlwaysAsIdentity(),
    eventId: text("event_id").notNull().unique(),
    batchId: text("batch_id").notNull(),
    schemaVersion: varchar("schema_version", { length: 16 }).notNull(),
    eventName: varchar("event_name", { length: 64 }).notNull(),
    detectedAt: timestamp("detected_at", {
      withTimezone: true,
      mode: "date",
    }).notNull(),
    serverReceivedAt: timestamp("server_received_at", {
      withTimezone: true,
      mode: "date",
    })
      .notNull()
      .defaultNow(),
    windowStartedAt: timestamp("window_started_at", {
      withTimezone: true,
      mode: "date",
    }).notNull(),
    windowEndedAt: timestamp("window_ended_at", {
      withTimezone: true,
      mode: "date",
    }).notNull(),
    windowDurationMs: integer("window_duration_ms").notNull(),
    sessionId: text("session_id").notNull(),
    pageViewId: text("page_view_id").notNull(),
    journeyId: text("journey_id"),
    pageType: varchar("page_type", { length: 32 }).notNull(),
    previousPageType: varchar("previous_page_type", { length: 32 }),
    /**
     * Safe route template (e.g. `/product/[id]`) or sanitized pathname.
     * Never store full URLs with query strings that could carry PII.
     */
    routeTemplate: text("route_template"),
    subjectType: varchar("subject_type", { length: 32 }),
    subjectId: text("subject_id"),
    categoryId: text("category_id"),
    brandId: text("brand_id"),
    ecommerceContext: jsonb("ecommerce_context").notNull(),
    metrics: jsonb("metrics").notNull(),
    strength: doublePrecision("strength").notNull(),
    evidenceCount: integer("evidence_count").notNull(),
    algorithmVersion: varchar("algorithm_version", { length: 32 }).notNull(),
    partialData: boolean("partial_data").notNull(),
    consentVersion: varchar("consent_version", { length: 32 }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .notNull()
      .default(sql`now()`),
  },
  (table) => [
    index("meta_events_name_detected_at_idx").on(
      table.eventName,
      table.detectedAt,
    ),
    index("meta_events_session_detected_at_idx").on(
      table.sessionId,
      table.detectedAt,
    ),
    index("meta_events_page_view_id_idx").on(table.pageViewId),
    index("meta_events_journey_id_idx").on(table.journeyId),
    index("meta_events_page_type_detected_at_idx").on(
      table.pageType,
      table.detectedAt,
    ),
    index("meta_events_subject_idx").on(table.subjectType, table.subjectId),
    index("meta_events_category_detected_at_idx").on(
      table.categoryId,
      table.detectedAt,
    ),
  ],
);

export type MetaEventRow = typeof metaEvents.$inferSelect;
export type NewMetaEventRow = typeof metaEvents.$inferInsert;
