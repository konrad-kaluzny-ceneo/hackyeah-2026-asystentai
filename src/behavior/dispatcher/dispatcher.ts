import { THRESHOLDS } from "../config/thresholds";
import {
  META_EVENT_SCHEMA_VERSION,
  type MetaEvent,
  type MetaEventBatchPayload,
} from "../types";

import type { Transport } from "./transport";

export interface DispatcherOptions {
  readonly transport: Transport;
  readonly generateBatchId: () => string;
  readonly now?: () => number;
  /** Limits are configurable; defaults come from THRESHOLDS. */
  readonly maxBatchEvents?: number;
  readonly maxBatchBytes?: number;
  readonly flushIntervalMs?: number;
  readonly debounceMs?: number;
  readonly retryBackoffMs?: readonly number[];
  readonly maxQueueEvents?: number;
  readonly onBatchSent?: (batch: SentBatch) => void;
}

export interface SentBatch {
  readonly batchId: string;
  readonly sentAt: string;
  readonly events: readonly MetaEvent[];
}

export interface DispatcherHandle {
  /** Adds a meta event to the queue. Will schedule a debounced flush. */
  enqueue(event: MetaEvent): void;
  /** Flushes the queue immediately. Used on pagehide/visibilitychange. */
  flushNow(): Promise<void>;
  /** Starts the periodic flush interval. Idempotent. */
  start(): void;
  /** Stops the interval. Does not flush; call flushNow() before destroy. */
  stop(): void;
  /** Total events currently queued (unsent). */
  queueSize(): number;
}

/**
 * Batches meta events and POSTs them to the backend. Guarantees:
 *  - At most maxBatchEvents per request.
 *  - Events leave the queue ONLY when the transport confirms delivery (else
 *    they are retried with exponential backoff, then dropped after the
 *    final attempt to bound memory).
 *  - Batch envelope carries schemaVersion + batchId + sentAt for
 *    idempotent server-side handling.
 */
export function createDispatcher(options: DispatcherOptions): DispatcherHandle {
  const now = options.now ?? Date.now;
  const maxBatchEvents = options.maxBatchEvents ?? THRESHOLDS.dispatcher.maxBatchEvents;
  const maxBatchBytes = options.maxBatchBytes ?? THRESHOLDS.dispatcher.maxBatchBytes;
  const flushIntervalMs = options.flushIntervalMs ?? THRESHOLDS.dispatcher.flushIntervalMs;
  const debounceMs = options.debounceMs ?? THRESHOLDS.dispatcher.debounceMs;
  const retryBackoffMs = options.retryBackoffMs ?? THRESHOLDS.dispatcher.retryBackoffMs;
  const maxQueueEvents = options.maxQueueEvents ?? THRESHOLDS.dispatcher.maxQueueEvents;

  let queue: MetaEvent[] = [];
  let intervalId: number | null = null;
  let debounceId: number | null = null;
  let inFlight = false;

  const buildBatch = (events: readonly MetaEvent[]): MetaEventBatchPayload => ({
    schemaVersion: META_EVENT_SCHEMA_VERSION,
    batchId: options.generateBatchId(),
    sentAt: new Date(now()).toISOString(),
    events,
  });

  const takeNextBatch = (): MetaEvent[] => {
    if (queue.length === 0) return [];
    const batch: MetaEvent[] = [];
    let bytes = 2; // open/close brackets
    for (const event of queue) {
      if (batch.length >= maxBatchEvents) break;
      const size = sizeOf(event);
      if (batch.length > 0 && bytes + size > maxBatchBytes) break;
      batch.push(event);
      bytes += size + 1;
    }
    return batch;
  };

  const deliverBatch = async (
    batch: MetaEvent[],
    attempt: number,
  ): Promise<void> => {
    const payload = buildBatch(batch);
    const ok = await options.transport.send(payload);
    if (ok) {
      // Remove only what we sent — anything enqueued during the request stays.
      const sent = new Set(batch.map((e) => e.eventId));
      queue = queue.filter((e) => !sent.has(e.eventId));
      options.onBatchSent?.({
        batchId: payload.batchId,
        sentAt: payload.sentAt,
        events: payload.events,
      });
      return;
    }
    if (attempt >= retryBackoffMs.length) {
      // Give up: drop the batch to bound memory. Server-side idempotency
      // means a previously-accepted event still isn't duplicated if a
      // concurrent retry succeeded elsewhere.
      const sent = new Set(batch.map((e) => e.eventId));
      queue = queue.filter((e) => !sent.has(e.eventId));
      return;
    }
    const waitMs = retryBackoffMs[attempt];
    await new Promise<void>((resolve) => {
      setTimeout(resolve, waitMs);
    });
    return deliverBatch(batch, attempt + 1);
  };

  const flush = async (): Promise<void> => {
    if (inFlight) return;
    if (queue.length === 0) return;
    inFlight = true;
    try {
      while (queue.length > 0) {
        const batch = takeNextBatch();
        if (batch.length === 0) return;
        await deliverBatch(batch, 0);
      }
    } finally {
      inFlight = false;
    }
  };

  const scheduleDebounce = (): void => {
    if (typeof window === "undefined") return;
    if (debounceId !== null) return;
    debounceId = window.setTimeout(() => {
      debounceId = null;
      void flush();
    }, debounceMs);
  };

  return {
    enqueue(event: MetaEvent): void {
      queue.push(event);
      if (queue.length > maxQueueEvents) {
        queue = queue.slice(queue.length - maxQueueEvents);
      }
      if (queue.length >= maxBatchEvents) {
        void flush();
        return;
      }
      scheduleDebounce();
    },
    flushNow: async () => {
      if (debounceId !== null && typeof window !== "undefined") {
        window.clearTimeout(debounceId);
        debounceId = null;
      }
      await flush();
    },
    start(): void {
      if (intervalId !== null || typeof window === "undefined") {
        return;
      }
      intervalId = window.setInterval(() => {
        void flush();
      }, flushIntervalMs);
    },
    stop(): void {
      if (intervalId !== null && typeof window !== "undefined") {
        window.clearInterval(intervalId);
        intervalId = null;
      }
      if (debounceId !== null && typeof window !== "undefined") {
        window.clearTimeout(debounceId);
        debounceId = null;
      }
    },
    queueSize(): number {
      return queue.length;
    },
  };
}

/** Conservative size estimate for a serialized event. */
function sizeOf(event: MetaEvent): number {
  try {
    return JSON.stringify(event).length;
  } catch {
    return 1024;
  }
}
