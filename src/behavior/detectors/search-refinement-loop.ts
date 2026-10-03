import { THRESHOLDS } from "../config/thresholds";
import type { AnalysisContext, MetaEvent, MetaEventDetector } from "../types";

import { buildMetaEvent, type MetaEventIdGenerator } from "./base";

const T = THRESHOLDS.detectors.search_refinement_loop;

/**
 * search_refinement_loop — repeated search submissions within the window
 * without a product view, indicating the user keeps rephrasing queries.
 */
export class SearchRefinementLoopDetector implements MetaEventDetector {
  readonly name = "search_refinement_loop" as const;

  constructor(private readonly generateEventId: MetaEventIdGenerator) {}

  analyze(ctx: AnalysisContext): readonly MetaEvent[] {
    const windowStart = ctx.window.endedAt - T.windowMs;
    const searches = ctx.events.filter(
      (event) =>
        event.name === "search_submitted" &&
        event.timestamp >= windowStart &&
        event.timestamp <= ctx.window.endedAt,
    );
    if (searches.length < T.minSearches) return [];

    const progressed = ctx.events.some(
      (event) =>
        (event.name === "product_viewed" || event.name === "offer_viewed") &&
        event.timestamp >= windowStart &&
        event.timestamp <= ctx.window.endedAt,
    );
    if (progressed) return [];

    return [
      buildMetaEvent({
        name: this.name,
        ctx,
        evidence: searches,
        strength: Math.min(1, searches.length / (T.minSearches * 2)),
        metrics: {
          searchCount: searches.length,
          windowMs: T.windowMs,
        },
        detectedAtMs: searches[searches.length - 1].timestamp,
        eventId: this.generateEventId(),
      }),
    ];
  }
}
