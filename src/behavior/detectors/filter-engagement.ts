import { THRESHOLDS } from "../config/thresholds";
import type { AnalysisContext, MetaEvent, MetaEventDetector } from "../types";

import { buildMetaEvent, type MetaEventIdGenerator } from "./base";

const T = THRESHOLDS.detectors.filter_engagement;

export class FilterEngagementDetector implements MetaEventDetector {
  readonly name = "filter_engagement" as const;

  constructor(private readonly generateEventId: MetaEventIdGenerator) {}

  analyze(ctx: AnalysisContext): readonly MetaEvent[] {
    const windowStart = ctx.window.endedAt - T.windowMs;
    const changes = ctx.events.filter(
      (event) =>
        (event.name === "filter_added" || event.name === "filter_removed") &&
        event.timestamp >= windowStart &&
        event.timestamp <= ctx.window.endedAt &&
        typeof event.data?.filterId === "string",
    );
    if (changes.length < T.minChanges) return [];

    const active = new Set<string>();
    const filterIds = new Set<string>();
    for (const event of changes) {
      const filterId = event.data?.filterId;
      if (typeof filterId !== "string") continue;
      filterIds.add(filterId);
      if (event.name === "filter_added") active.add(filterId);
      else active.delete(filterId);
    }
    if (active.size < T.minRetainedCount) return [];

    return [
      buildMetaEvent({
        name: this.name,
        ctx,
        evidence: changes,
        strength: Math.min(
          1,
          changes.length / (T.minChanges * 2) +
            active.size / (T.minRetainedCount * 4),
        ),
        metrics: {
          filterCount: changes.length,
          filterIds: [...filterIds].sort().join(","),
          windowMs: T.windowMs,
          retainedCount: active.size,
        },
        detectedAtMs: ctx.window.endedAt,
        eventId: this.generateEventId(),
      }),
    ];
  }
}
