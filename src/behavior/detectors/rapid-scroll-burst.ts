import { THRESHOLDS } from "../config/thresholds";
import type { AnalysisContext, MetaEvent, MetaEventDetector } from "../types";

import { buildMetaEvent, type MetaEventIdGenerator } from "./base";

const T = THRESHOLDS.detectors.rapid_scroll_burst;

export class RapidScrollBurstDetector implements MetaEventDetector {
  readonly name = "rapid_scroll_burst" as const;

  constructor(private readonly generateEventId: MetaEventIdGenerator) {}

  analyze(ctx: AnalysisContext): readonly MetaEvent[] {
    const bursts = ctx.events.filter(
      (event) =>
        event.name === "scroll_burst" &&
        event.timestamp >= ctx.window.endedAt - T.windowMs &&
        event.timestamp <= ctx.window.endedAt,
    );
    if (bursts.length < T.minBursts) return [];
    const latest = bursts[bursts.length - 1];
    const distanceRatioBucket =
      typeof latest.data?.distanceRatioBucket === "string"
        ? latest.data.distanceRatioBucket
        : "unknown";
    const reversalCount = bursts.reduce((max, event) => {
      const value = event.data?.reversalCount;
      return typeof value === "number" ? Math.max(max, value) : max;
    }, 0);

    return [
      buildMetaEvent({
        name: this.name,
        ctx,
        evidence: bursts,
        strength: Math.min(1, bursts.length / (T.minBursts * 2)),
        metrics: {
          burstCount: bursts.length,
          distanceRatioBucket,
          reversalCount,
        },
        detectedAtMs: latest.timestamp,
        eventId: this.generateEventId(),
      }),
    ];
  }
}
