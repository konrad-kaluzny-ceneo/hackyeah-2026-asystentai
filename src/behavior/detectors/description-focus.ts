import { THRESHOLDS } from "../config/thresholds";
import type { AnalysisContext, MetaEvent, MetaEventDetector, RawEvent } from "../types";

import { buildMetaEvent, type MetaEventIdGenerator } from "./base";

const T = THRESHOLDS.detectors.description_focus;

/**
 * description_focus - dwell on the product description section within the
 * current product page. The description text itself never leaves the client.
 */
export class DescriptionFocusDetector implements MetaEventDetector {
  readonly name = "description_focus" as const;

  constructor(private readonly generateEventId: MetaEventIdGenerator) {}

  analyze(ctx: AnalysisContext): readonly MetaEvent[] {
    if (ctx.pageType !== "product") return [];

    const windowStart = ctx.window.endedAt - T.windowMs;
    const events = [...ctx.events]
      .filter(
        (event) =>
          event.elementId === "product-description" &&
          event.timestamp >= windowStart &&
          event.timestamp <= ctx.window.endedAt,
      )
      .sort((left, right) => left.timestamp - right.timestamp);

    let dwellMs = 0;
    let exposureCount = 0;
    let openStarted: RawEvent | undefined;
    const evidence: RawEvent[] = [];

    for (const event of events) {
      if (event.name === "element_exposure_started") {
        openStarted = event;
        continue;
      }
      if (event.name !== "element_exposure_ended" || openStarted === undefined) {
        continue;
      }
      dwellMs += Math.max(0, event.timestamp - openStarted.timestamp);
      exposureCount += 1;
      evidence.push(openStarted, event);
      openStarted = undefined;
    }

    if (openStarted !== undefined) {
      dwellMs += Math.max(0, ctx.window.endedAt - openStarted.timestamp);
      exposureCount += 1;
      evidence.push(openStarted);
    }

    if (dwellMs < T.minDwellMs || exposureCount === 0) return [];

    const productId = ctx.ecommerce.productId;
    return [
      buildMetaEvent({
        name: this.name,
        ctx,
        evidence,
        windowStartedAtMs: windowStart,
        strength: Math.min(1, dwellMs / (T.minDwellMs * 2)),
        metrics: {
          dwellMs,
          exposureCount,
          ...(productId !== undefined ? { productId } : {}),
        },
        ...(productId !== undefined
          ? { subject: { type: "product", id: productId } }
          : {}),
        detectedAtMs: ctx.window.endedAt,
        eventId: this.generateEventId(),
      }),
    ];
  }
}