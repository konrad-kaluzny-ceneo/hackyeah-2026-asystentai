import { THRESHOLDS } from "../config/thresholds";
import type { AnalysisContext, MetaEvent, MetaEventDetector, RawEvent } from "../types";

import { buildMetaEvent, type MetaEventIdGenerator } from "./base";
import { collectProductExposureDwell } from "./exposure-dwell";

const T = THRESHOLDS.detectors.category_interest;

type CategorySummary = {
  categoryId: string;
  dwellMs: number;
  products: Set<string>;
  startedAtMs: number;
  evidence: RawEvent[];
};

export class CategoryInterestDetector implements MetaEventDetector {
  readonly name = "category_interest" as const;

  constructor(private readonly generateEventId: MetaEventIdGenerator) {}

  analyze(ctx: AnalysisContext): readonly MetaEvent[] {
    const byCategory = new Map<string, CategorySummary>();
    for (const product of collectProductExposureDwell(ctx, T.windowMs)) {
      if (product.categoryId === undefined) continue;
      const current = byCategory.get(product.categoryId) ?? {
        categoryId: product.categoryId,
        dwellMs: 0,
        products: new Set<string>(),
        startedAtMs: product.startedAtMs,
        evidence: [],
      };
      current.dwellMs += product.dwellMs;
      current.products.add(product.productId);
      current.startedAtMs = Math.min(current.startedAtMs, product.startedAtMs);
      current.evidence.push(...product.evidence);
      byCategory.set(product.categoryId, current);
    }

    const results: MetaEvent[] = [];
    for (const summary of byCategory.values()) {
      if (summary.dwellMs < T.minDwellMs) continue;
      results.push(
        buildMetaEvent({
          name: this.name,
          ctx,
          evidence: summary.evidence,
          windowStartedAtMs: summary.startedAtMs,
          strength: Math.min(1, summary.dwellMs / (T.minDwellMs * 2)),
          metrics: {
            categoryId: summary.categoryId,
            dwellMs: summary.dwellMs,
            uniqueProducts: summary.products.size,
          },
          subject: { type: "category", id: summary.categoryId },
          detectedAtMs: ctx.window.endedAt,
          eventId: this.generateEventId(),
        }),
      );
    }
    return results;
  }
}
