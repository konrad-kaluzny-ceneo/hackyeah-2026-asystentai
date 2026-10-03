import { THRESHOLDS } from "../config/thresholds";
import type {
  AnalysisContext,
  MetaEvent,
  MetaEventDetector,
  RawEvent,
} from "../types";

import { buildMetaEvent, type MetaEventIdGenerator } from "./base";

const T = THRESHOLDS.detectors.rapid_filter_churn;

// For rapid_filter_churn, "progress" means *leaving* the filter loop:
// opening a product/offer/search results. Filter changes themselves are
// the symptom, not progress — so they're deliberately NOT in this set.
const PROGRESS_EVENTS: ReadonlySet<RawEvent["name"]> = new Set([
  "product_viewed",
  "offer_viewed",
  "search_submitted",
]);

/**
 * rapid_filter_churn — many filter add/remove operations in a short window,
 * including undoing the same filter (added then removed, or removed then
 * re-added) and WITHOUT producing progress (no product_viewed / search).
 */
export class RapidFilterChurnDetector implements MetaEventDetector {
  readonly name = "rapid_filter_churn" as const;

  constructor(private readonly generateEventId: MetaEventIdGenerator) {}

  analyze(ctx: AnalysisContext): readonly MetaEvent[] {
    const windowStart = ctx.window.endedAt - T.windowMs;
    const changes = ctx.events.filter(
      (e) =>
        (e.name === "filter_added" || e.name === "filter_removed") &&
        e.timestamp >= windowStart &&
        e.timestamp <= ctx.window.endedAt,
    );
    if (changes.length < T.minChanges) {
      return [];
    }

    // Undone count: filterId X appears as both filter_added and filter_removed
    // within the same window.
    const addedBy = new Map<string, number>();
    const removedBy = new Map<string, number>();
    for (const c of changes) {
      const id = c.data?.["filterId"];
      if (typeof id !== "string") continue;
      if (c.name === "filter_added") {
        addedBy.set(id, (addedBy.get(id) ?? 0) + 1);
      } else {
        removedBy.set(id, (removedBy.get(id) ?? 0) + 1);
      }
    }
    let undoneCount = 0;
    for (const [id, addedCount] of addedBy) {
      const removedCount = removedBy.get(id) ?? 0;
      undoneCount += Math.min(addedCount, removedCount);
    }
    if (undoneCount < T.minUndoneCount) {
      return [];
    }

    // No progress inside the window.
    const progressed = ctx.events.some(
      (e) =>
        PROGRESS_EVENTS.has(e.name) &&
        e.timestamp >= windowStart &&
        e.timestamp <= ctx.window.endedAt,
    );
    if (progressed) {
      return [];
    }

    return [
      buildMetaEvent({
        name: this.name,
        ctx,
        evidence: changes,
        strength: Math.min(
          1,
          (changes.length / (T.minChanges * 2)) * 0.6 +
            (undoneCount / (T.minUndoneCount * 2)) * 0.4,
        ),
        metrics: {
          filterChanges: changes.length,
          windowMs: T.windowMs,
          undoneCount,
        },
        eventId: this.generateEventId(),
        detectedAtMs: ctx.window.endedAt,
      }),
    ];
  }
}
