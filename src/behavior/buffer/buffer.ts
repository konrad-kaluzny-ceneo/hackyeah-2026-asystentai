import type { RawEvent } from "../types";

export interface RawEventBufferOptions {
  readonly maxEvents: number;
  readonly ttlMs: number;
  readonly now?: () => number;
}

/**
 * In-memory bounded buffer with TTL. Raw events NEVER leave the browser —
 * they only live here (plus an optional sessionStorage checkpoint, see
 * checkpoint.ts) and are POSTed as privacy-safe META events after analysis.
 *
 * Not a ring buffer: on overflow we evict the OLDEST events because for
 * behavior analysis the freshest events carry the most signal.
 */
export class RawEventBuffer {
  private events: RawEvent[] = [];
  private readonly maxEvents: number;
  private readonly ttlMs: number;
  private readonly now: () => number;
  private prunedSinceLastSnapshot = false;

  constructor(options: RawEventBufferOptions) {
    if (options.maxEvents <= 0) {
      throw new Error("RawEventBuffer: maxEvents must be > 0");
    }
    if (options.ttlMs <= 0) {
      throw new Error("RawEventBuffer: ttlMs must be > 0");
    }
    this.maxEvents = options.maxEvents;
    this.ttlMs = options.ttlMs;
    this.now = options.now ?? Date.now;
  }

  push(event: RawEvent): void {
    this.events.push(event);
    this.evictOverflowing();
  }

  /** Number of events currently retained (after implicit TTL eviction). */
  size(): number {
    this.evictExpired();
    return this.events.length;
  }

  /**
   * Returns all events with `timestamp >= sinceMs`, in ascending timestamp
   * order. Does not mutate the buffer.
   */
  readSince(sinceMs: number): readonly RawEvent[] {
    this.evictExpired();
    return this.events.filter((event) => event.timestamp >= sinceMs);
  }

  /** Drops every event with `timestamp < untilExclusiveMs`. Idempotent. */
  clearBefore(untilExclusiveMs: number): void {
    this.events = this.events.filter(
      (event) => event.timestamp >= untilExclusiveMs,
    );
    this.prunedSinceLastSnapshot = false;
  }

  /** Marks whether pruning happened since the last snapshot (for partialData). */
  wasPrunedSinceLastSnapshot(): boolean {
    return this.prunedSinceLastSnapshot;
  }

  /** Serializes the current contents — used by checkpoint.ts. */
  toJSON(): readonly RawEvent[] {
    return this.events;
  }

  /** Replaces the contents — used by checkpoint restore. */
  loadSnapshot(events: readonly RawEvent[]): void {
    this.events = events.slice(-this.maxEvents);
    this.prunedSinceLastSnapshot = false;
  }

  private evictOverflowing(): void {
    if (this.events.length <= this.maxEvents) {
      return;
    }
    const overflow = this.events.length - this.maxEvents;
    this.events.splice(0, overflow);
    this.prunedSinceLastSnapshot = true;
  }

  private evictExpired(): void {
    const cutoff = this.now() - this.ttlMs;
    const before = this.events.length;
    if (before === 0) {
      return;
    }
    // Events are appended in push order which equals timestamp ascending for
    // well-behaved producers; cheap scan from the front is enough.
    let drop = 0;
    while (drop < before && this.events[drop].timestamp < cutoff) {
      drop += 1;
    }
    if (drop > 0) {
      this.events.splice(0, drop);
      this.prunedSinceLastSnapshot = true;
    }
  }
}
