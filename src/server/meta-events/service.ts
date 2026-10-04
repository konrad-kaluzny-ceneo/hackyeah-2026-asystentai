import { desc, eq, sql } from "drizzle-orm";

import type { MetaEvent } from "@/behavior/types";
import { MetaEventSchema } from "@/behavior/meta-event-schema";
import { getDb, type Database } from "@/lib/db/client";
import { metaEvents, type NewMetaEventRow } from "@/lib/db/schema";
import type { ValidatedBatchPayload, ValidatedMetaEvent } from "./validation";

export interface SaveBatchResult {
  readonly acceptedEventIds: readonly string[];
  readonly duplicateEventIds: readonly string[];
}

export async function getRecentMetaEvents(
  sessionId: string,
  options: { db?: Database; limit?: number } = {},
): Promise<readonly MetaEvent[]> {
  const db = options.db ?? getDb();
  const limit = Math.max(1, Math.floor(options.limit ?? 5));
  const rows = await db
    .select()
    .from(metaEvents)
    .where(eq(metaEvents.sessionId, sessionId))
    .orderBy(desc(metaEvents.detectedAt), desc(metaEvents.id))
    .limit(limit);

  return rows.reverse().map((row) =>
    MetaEventSchema.parse({
      schemaVersion: row.schemaVersion,
      eventId: row.eventId,
      name: row.eventName,
      detectedAt: row.detectedAt.toISOString(),
      window: {
        startedAt: row.windowStartedAt.toISOString(),
        endedAt: row.windowEndedAt.toISOString(),
        durationMs: row.windowDurationMs,
      },
      identity: {
        sessionId: row.sessionId,
        pageViewId: row.pageViewId,
        journeyId: row.journeyId ?? undefined,
      },
      page: {
        type: row.pageType,
        previousPageType: row.previousPageType ?? undefined,
        routeTemplate: row.routeTemplate ?? undefined,
      },
      subject:
        row.subjectType === null
          ? undefined
          : {
              type: row.subjectType,
              id: row.subjectId ?? undefined,
              categoryId: row.categoryId ?? undefined,
              brandId: row.brandId ?? undefined,
            },
      ecommerce: row.ecommerceContext,
      metrics: row.metrics,
      quality: {
        strength: row.strength,
        evidenceCount: row.evidenceCount,
        algorithmVersion: row.algorithmVersion,
        partialData: row.partialData,
      },
      privacy: {
        consentVersion: row.consentVersion ?? undefined,
        containsFreeText: false,
        rawDataUploaded: false,
      },
    }),
  );
}

const MAX_METRICS_KEYS = 32;

/**
 * Persists a validated batch. Idempotent on `event_id` via
 * `ON CONFLICT (event_id) DO NOTHING` — safe for client retries.
 */
export async function saveBatch(
  batch: ValidatedBatchPayload,
  options: { db?: Database } = {},
): Promise<SaveBatchResult> {
  const db = options.db ?? getDb();
  if (batch.events.length === 0) {
    return { acceptedEventIds: [], duplicateEventIds: [] };
  }

  const rows = batch.events.map((event) => toRow(batch.batchId, event));

  // Drizzle's `.returning({ eventId })` after `ON CONFLICT DO NOTHING` gives
  // back only the rows actually inserted — duplicates come back absent.
  const inserted = await db
    .insert(metaEvents)
    .values(rows)
    .onConflictDoNothing({ target: metaEvents.eventId })
    .returning({ eventId: metaEvents.eventId });

  const insertedIds = new Set(inserted.map((r) => r.eventId));
  const accepted: string[] = [];
  const duplicates: string[] = [];
  for (const row of rows) {
    if (insertedIds.has(row.eventId)) {
      accepted.push(row.eventId);
    } else {
      duplicates.push(row.eventId);
    }
  }
  return { acceptedEventIds: accepted, duplicateEventIds: duplicates };
}

function toRow(batchId: string, event: ValidatedMetaEvent): NewMetaEventRow {
  return {
    eventId: event.eventId,
    batchId,
    schemaVersion: event.schemaVersion,
    eventName: event.name,
    detectedAt: new Date(event.detectedAt),
    windowStartedAt: new Date(event.window.startedAt),
    windowEndedAt: new Date(event.window.endedAt),
    windowDurationMs: event.window.durationMs,
    sessionId: event.identity.sessionId,
    pageViewId: event.identity.pageViewId,
    journeyId: event.identity.journeyId ?? null,
    pageType: event.page.type,
    previousPageType: event.page.previousPageType ?? null,
    routeTemplate:
      event.page.routeTemplate ?? event.page.pathname ?? null,
    subjectType: event.subject?.type ?? null,
    subjectId: event.subject?.id ?? null,
    categoryId: event.subject?.categoryId ?? null,
    brandId: event.subject?.brandId ?? null,
    ecommerceContext: event.ecommerce,
    metrics: capMetrics(event.metrics),
    strength: event.quality.strength,
    evidenceCount: event.quality.evidenceCount,
    algorithmVersion: event.quality.algorithmVersion,
    partialData: event.quality.partialData,
    consentVersion: event.privacy.consentVersion ?? null,
  };
}

/** Defensive cap on metrics size; Zod already enforces key allowlist. */
function capMetrics(
  metrics: Readonly<Record<string, string | number | boolean>>,
): Record<string, string | number | boolean> {
  const keys = Object.keys(metrics);
  if (keys.length <= MAX_METRICS_KEYS) {
    return { ...metrics };
  }
  const out: Record<string, string | number | boolean> = {};
  for (const key of keys.slice(0, MAX_METRICS_KEYS)) {
    out[key] = metrics[key];
  }
  return out;
}

/** Health-check helper used by tests and by the route before save. */
export async function assertDatabaseReady(db: Database): Promise<void> {
  await db.execute(sql`select 1`);
}
