import { NextResponse, type NextRequest } from "next/server";

import { getDb } from "@/lib/db/client";

import {
  DEFAULT_RATE_LIMIT,
  InMemoryRateLimiter,
} from "@/server/meta-events/rate-limit";
import {
  getRecentMetaEvents,
  saveBatch,
} from "@/server/meta-events/service";
import {
  inferAndSaveIntentSnapshot,
  MIN_JEV_INTENT_EVENTS,
} from "@/server/intent-inference/trigger";
import {
  BATCH_LIMITS,
  BatchPayloadSchema,
} from "@/server/meta-events/validation";

/**
 * POST /api/meta-events
 *
 * Receives batches of privacy-safe meta events from the client behavior
 * pipeline. Raw events are NEVER accepted here — the contract enforces this
 * via the Zod schema (strict, literal privacy flags).
 */

// Module-scope limiter instance. Reset per serverless cold start (documented
// in rate-limit.ts).
const rateLimiter = new InMemoryRateLimiter(
  DEFAULT_RATE_LIMIT.limit,
  DEFAULT_RATE_LIMIT.windowMs,
);

interface Rejection {
  readonly eventId: string | null;
  readonly reason:
    | "invalid_payload"
    | "validation_failed"
    | "unknown_event_name"
    | "duplicate";
}

export async function POST(request: NextRequest): Promise<Response> {
  const receivedAt = new Date().toISOString();

  // -- Rate limit ---------------------------------------------------------------
  const clientKey = extractClientKey(request);
  const rate = rateLimiter.check(clientKey);
  if (!rate.allowed) {
    logLine({
      level: "warn",
      action: "rate_limited",
      clientKeyHash: hashKey(clientKey),
      receivedAt,
    });
    return NextResponse.json(
      { error: "rate_limited" },
      {
        status: 429,
        headers: {
          "Retry-After": String(
            Math.max(1, Math.ceil((rate.resetAtMs - Date.now()) / 1000)),
          ),
        },
      },
    );
  }

  // -- Size ceiling (defense in depth; Next also has its own body limit) -------
  const contentLength = request.headers.get("content-length");
  if (
    contentLength !== null &&
    Number.parseInt(contentLength, 10) > BATCH_LIMITS.maxBatchBytes
  ) {
    return NextResponse.json({ error: "payload_too_large" }, { status: 413 });
  }

  // -- Parse --------------------------------------------------------------------
  let bodyUnknown: unknown;
  try {
    bodyUnknown = await request.json();
  } catch {
    return NextResponse.json(
      { error: "invalid_json", batchId: null },
      { status: 400 },
    );
  }

  const parseResult = BatchPayloadSchema.safeParse(bodyUnknown);
  if (!parseResult.success) {
    const rejected: Rejection[] = extractRejectedEventIds(bodyUnknown).map(
      (eventId) => ({ eventId, reason: "validation_failed" as const }),
    );
    logLine({
      level: "info",
      action: "validation_failed",
      batchId: extractBatchId(bodyUnknown),
      rejectedCount: rejected.length,
      receivedAt,
      issues: parseResult.error.issues.length,
    });
    return NextResponse.json(
      {
        batchId: extractBatchId(bodyUnknown),
        acceptedEventIds: [],
        rejected:
          rejected.length > 0
            ? rejected
            : [{ eventId: null, reason: "invalid_payload" satisfies "invalid_payload" }],
      },
      // 200 not 4xx: the contract acknowledges server-side rejection in the
      // payload. 4xx would trigger client retries on a malformed payload.
      { status: 200 },
    );
  }

  const batch = parseResult.data;

  // -- Persist ------------------------------------------------------------------
  let result;
  const db = getDb();
  try {
    result = await saveBatch(batch, { db });
  } catch (error) {
    logLine({
      level: "error",
      action: "persistence_failed",
      batchId: batch.batchId,
      receivedAt,
      error: error instanceof Error ? error.message : "unknown",
    });
    return NextResponse.json(
      { error: "persistence_failed", batchId: batch.batchId },
      { status: 500 },
    );
  }

  const rejected: Rejection[] = result.duplicateEventIds.map((eventId) => ({
    eventId,
    reason: "duplicate" as const,
  }));

  logLine({
    level: "info",
    action: "accepted",
    batchId: batch.batchId,
    acceptedCount: result.acceptedEventIds.length,
    duplicateCount: result.duplicateEventIds.length,
    clientKeyHash: hashKey(clientKey),
    receivedAt,
  });

  const acceptedEvents = batch.events.filter((event) =>
    result.acceptedEventIds.includes(event.eventId),
  );
  if (acceptedEvents.length > 0) {
    try {
      const sessionId = acceptedEvents[0]?.identity.sessionId;
      if (sessionId === undefined) {
        throw new Error("Accepted MetaEvents have no session ID");
      }
      const recentEvents = await getRecentMetaEvents(sessionId, {
        db,
        limit: MIN_JEV_INTENT_EVENTS,
      });
      if (recentEvents.length < MIN_JEV_INTENT_EVENTS) {
        logLine({
          level: "info",
          action: "intent_inference_skipped",
          sessionId,
          eventCount: recentEvents.length,
          minimumEventCount: MIN_JEV_INTENT_EVENTS,
        });
      } else {
        await inferAndSaveIntentSnapshot(recentEvents, { db });
      }
    } catch (error) {
      // Intent inference is best-effort; a JEV outage must not make a
      // successfully persisted MetaEvent batch retry.
      console.error("Failed to persist JEV intent snapshot", error);
    }
  }

  return NextResponse.json(
    {
      batchId: batch.batchId,
      acceptedEventIds: result.acceptedEventIds,
      rejected,
    },
    { status: 200 },
  );
}

/**
 * Client key for rate limiting. Uses x-forwarded-for / x-real-ip when present
 * (Vercel/proxy), else falls back to a static bucket. We do NOT hash user
 * identifiers — rate limiting by key is enough.
 */
function extractClientKey(request: NextRequest): string {
  const fwd = request.headers.get("x-forwarded-for");
  if (fwd !== null && fwd.length > 0) {
    const first = fwd.split(",", 1)[0].trim();
    if (first.length > 0) return first;
  }
  const real = request.headers.get("x-real-ip");
  if (real !== null && real.length > 0) {
    return real;
  }
  return "anonymous";
}

/** Hash the key so we never log raw IPs. */
function hashKey(value: string): string {
  let h = 5381;
  for (let i = 0; i < value.length; i += 1) {
    h = ((h << 5) + h + value.charCodeAt(i)) | 0;
  }
  return (h >>> 0).toString(36);
}

function extractBatchId(value: unknown): string | null {
  if (typeof value !== "object" || value === null) return null;
  const candidate = (value as { batchId?: unknown }).batchId;
  return typeof candidate === "string" ? candidate : null;
}

function extractRejectedEventIds(value: unknown): string[] {
  if (typeof value !== "object" || value === null) return [];
  const events = (value as { events?: unknown }).events;
  if (!Array.isArray(events)) return [];
  const out: string[] = [];
  for (const event of events) {
    if (typeof event !== "object" || event === null) continue;
    const id = (event as { eventId?: unknown }).eventId;
    if (typeof id === "string") out.push(id);
  }
  return out;
}

function logLine(fields: Record<string, unknown>): void {
  // Structured one-liner; in production ship via your log pipeline.
  console.log(JSON.stringify({ component: "meta-events", ...fields }));
}
