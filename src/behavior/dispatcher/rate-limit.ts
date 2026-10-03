/**
 * Client-side rate limiter: lightweight token bucket per sender. The SERVER
 * owns authoritative rate limiting (see src/server/meta-events/rate-limit.ts);
 * this one only protects the browser from accidentally flooding the network
 * (e.g. a detector regression in a loop).
 */
export class ClientRateLimiter {
  private tokens: number;
  private lastRefill: number;

  constructor(
    private readonly capacity: number,
    private readonly refillPerSecond: number,
    private readonly now: () => number = Date.now,
  ) {
    this.tokens = capacity;
    this.lastRefill = this.now();
  }

  tryConsume(cost = 1): boolean {
    const now = this.now();
    const elapsedSec = (now - this.lastRefill) / 1000;
    if (elapsedSec > 0) {
      this.tokens = Math.min(
        this.capacity,
        this.tokens + elapsedSec * this.refillPerSecond,
      );
      this.lastRefill = now;
    }
    if (this.tokens < cost) {
      return false;
    }
    this.tokens -= cost;
    return true;
  }
}
