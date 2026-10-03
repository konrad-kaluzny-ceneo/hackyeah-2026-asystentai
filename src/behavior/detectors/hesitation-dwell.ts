import { THRESHOLDS } from "../config/thresholds";
import type { AnalysisContext, MetaEvent, MetaEventDetector } from "../types";

import { buildMetaEvent, type MetaEventIdGenerator } from "./base";

const T = THRESHOLDS.detectors.hesitation_dwell;
export class HesitationDwellDetector implements MetaEventDetector {
  readonly name = "hesitation_dwell" as const;

  constructor(private readonly generateEventId: MetaEventIdGenerator) {}

  analyze(ctx: AnalysisContext): readonly MetaEvent[] {
    if (ctx.pageType !== "catalog" && ctx.pageType !== "product") return [];
    const idleEvents = ctx.events.filter(
      (event) =>
        event.name === "idle_started" &&
        event.timestamp >= ctx.window.endedAt - T.windowMs &&
        event.timestamp <= ctx.window.endedAt,
    );
    const idleEvent = idleEvents[idleEvents.length - 1];
    if (idleEvent === undefined) return [];
    const idleMs =
      typeof idleEvent.data?.idleMs === "number"
        ? idleEvent.data.idleMs
        : T.minIdleMs;
    if (idleMs < T.minIdleMs) return [];

    return [
      buildMetaEvent({
        name: this.name,
        ctx,
        evidence: [idleEvent],
        strength: Math.min(1, idleMs / (T.minIdleMs * 2)),
        metrics: { idleMs, pageType: ctx.pageType },
        detectedAtMs: idleEvent.timestamp,
        eventId: this.generateEventId(),
      }),
    ];
  }
}
