import type { MetaEvent, MetaEventName } from "../types";

export interface DeduplicatorOptions {
  readonly ttlMs: number;
  readonly maxEntries: number;
  readonly cooldowns: Readonly<Record<MetaEventName, number>>;
  readonly now?: () => number;
}

/**
 * Two-layer gate that runs BEFORE meta events are enqueued for dispatch:
 *  1. Dedupe: the same `(name, subject?, window)` key can't be emitted twice
 *     within `ttlMs`.
 *  2. Cooldown: per detector, after emission the detector is silent for
 *     `cooldowns[name]` milliseconds regardless of keys.
 *
 * In-memory only — a fresh page view resets the gate (acceptable for the
 * demo; meta events are cheap and the backend dedupes by eventId anyway).
 */
export class Deduplicator {
  private readonly seen = new Map<string, number>();
  private readonly cooldownUntil = new Map<MetaEventName, number>();
  private readonly ttlMs: number;
  private readonly maxEntries: number;
  private readonly cooldowns: Readonly<Record<MetaEventName, number>>;
  private readonly now: () => number;

  constructor(options: DeduplicatorOptions) {
    this.ttlMs = options.ttlMs;
    this.maxEntries = options.maxEntries;
    this.cooldowns = options.cooldowns;
    this.now = options.now ?? Date.now;
  }

  /** Dedupe key — semantic, based on detector + subject + detection time. */
  static dedupeKeyFor(event: MetaEvent): string {
    const subjectPart =
      event.subject === undefined
        ? ""
        : `:${event.subject.type}:${event.subject.id ?? ""}`;
    return `${event.name}${subjectPart}@${event.detectedAt}`;
  }

  /**
   * Returns `true` if the event should be emitted (and marks it as seen).
   * Returns `false` when the event is a duplicate or in cooldown.
   *
   * Cooldown takes priority over dedupe: while a detector is in cooldown, ANY
   * emission from it is suppressed — even with a new dedupe key. After the
   * cooldown expires, only an exact duplicate (same dedupe key, within TTL)
   * is blocked.
   */
  shouldEmit(event: MetaEvent): boolean {
    const now = this.now();
    const cooldownEnd = this.cooldownUntil.get(event.name);
    if (cooldownEnd !== undefined && now < cooldownEnd) {
      return false;
    }
    // Once cooldown has expired, clear it so future emissions re-arm it.
    if (cooldownEnd !== undefined) {
      this.cooldownUntil.delete(event.name);
    }
    this.evictExpired(now);
    const key = Deduplicator.dedupeKeyFor(event);
    const seenAt = this.seen.get(key);
    if (seenAt !== undefined && now - seenAt < this.ttlMs) {
      return false;
    }
    this.seen.set(key, now);
    if (this.cooldowns[event.name] > 0) {
      this.cooldownUntil.set(event.name, now + this.cooldowns[event.name]);
    }
    this.evictOverflow();
    return true;
  }

  /** Test-only hook. */
  reset(): void {
    this.seen.clear();
    this.cooldownUntil.clear();
  }

  private evictExpired(now: number): void {
    // Oldest-first expiration sweep; bounded by maxEntries so it's cheap.
    if (this.seen.size === 0) return;
    for (const [key, seenAt] of this.seen) {
      if (now - seenAt >= this.ttlMs) {
        this.seen.delete(key);
      }
    }
  }

  private evictOverflow(): void {
    while (this.seen.size > this.maxEntries) {
      // Map iteration order == insertion order; remove the oldest.
      const oldestKey = this.seen.keys().next().value;
      if (oldestKey === undefined) return;
      this.seen.delete(oldestKey);
    }
  }
}
