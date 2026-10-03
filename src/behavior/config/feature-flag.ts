/**
 * Feature flag for the entire client-side behavior pipeline.
 *
 * Returns `true` only when explicitly enabled via env var AND we are in a
 * browser context. Defaults to OFF — the mechanism is opt-in.
 */
export function isBehaviorTrackingEnabled(): boolean {
  if (typeof window === "undefined") {
    return false;
  }
  return process.env.NEXT_PUBLIC_BEHAVIOR_TRACKING === "true";
}
