import { THRESHOLDS } from "../config/thresholds";
import type { AnalysisContext, MetaEvent, MetaEventDetector } from "../types";

import { buildMetaEvent, type MetaEventIdGenerator } from "./base";
import { collectProductExposureDwell } from "./exposure-dwell";

const T = THRESHOLDS.detectors.sustained_product_interest;

export class SustainedProductInterestDetector implements MetaEventDetector {
  readonly name = "sustained_product_interest" as const;

  constructor(private readonly generateEventId: MetaEventIdGenerator) {}

  analyze(ctx: AnalysisContext): readonly MetaEvent[] {
    const summaries = collectProductExposureDwell(ctx, T.windowMs);
    const results: MetaEvent[] = [];
    for (const summary of summaries) {
      if (summary.dwellMs < T.minDwellMs) continue;
      results.push(
        buildMetaEvent({
          name: this.name,
          ctx,
          evidence: summary.evidence,
          windowStartedAtMs: summary.startedAtMs,
          strength: Math.min(
            1,
            summary.dwellMs / (T.minDwellMs * 2) +
              summary.exposureCount / 6,
          ),
          metrics: {
            productId: summary.productId,
            dwellMs: summary.dwellMs,
            exposureCount: summary.exposureCount,
          },
          subject: {
            type: "product",
            id: summary.productId,
            ...(summary.categoryId !== undefined && {
              categoryId: summary.categoryId,
            }),
            ...(summary.brandId !== undefined && { brandId: summary.brandId }),
          },
          detectedAtMs: ctx.window.endedAt,
          eventId: this.generateEventId(),
        }),
      );
    }
    return results;
  }
}
