/**
 * Server-side rate limiter for the /api/meta-events route.
 *
 * Hackathon-grade: in-memory sliding-window counter keyed by IP. Resets on
 * cold starts (acceptable for MVP). A production deployment should swap this
 * for a shared store (Upstash / Redis).
 */
export interface RateLimitResult {
  readonly allowed: boolean;
  readonly remaining: number;
  readonly resetAtMs: number;
}

interface BucketEntry {
  windowStartMs: number;
  count: number;
}

export class InMemoryRateLimiter {
  private readonly buckets = new Map<string, BucketEntry>();

  constructor(
    private readonly limit: number,
    private readonly windowMs: number,
    private readonly now: () => number = Date.now,
  ) {}

  check(key: string): RateLimitResult {
    const now = this.now();
    const existing = this.buckets.get(key);
    if (
      existing === undefined ||
      now - existing.windowStartMs >= this.windowMs
    ) {
      this.buckets.set(key, { windowStartMs: now, count: 1 });
      this.evictStale(now);
      return {
        allowed: true,
        remaining: this.limit - 1,
        resetAtMs: now + this.windowMs,
      };
    }
    if (existing.count >= this.limit) {
      return {
        allowed: false,
        remaining: 0,
        resetAtMs: existing.windowStartMs + this.windowMs,
      };
    }
    existing.count += 1;
    return {
      allowed: true,
      remaining: Math.max(0, this.limit - existing.count),
      resetAtMs: existing.windowStartMs + this.windowMs,
    };
  }

  private evictStale(now: number): void {
    // Cap map size during long-lived processes.
    if (this.buckets.size < 1024) {
      return;
    }
    for (const [k, v] of this.buckets) {
      if (now - v.windowStartMs >= this.windowMs) {
        this.buckets.delete(k);
      }
    }
  }
}

/** Default per-IP budget: 30 batches per minute (well above client flush rates). */
export const DEFAULT_RATE_LIMIT = { limit: 30, windowMs: 60_000 } as const;
