import { THRESHOLDS } from "../config/thresholds";
import type {
  AnalysisContext,
  MetaEvent,
  MetaEventDetector,
  RawEvent,
} from "../types";

import { buildMetaEvent, type MetaEventIdGenerator } from "./base";

const T = THRESHOLDS.detectors.product_revisit;

/**
 * product_revisit — same product viewed again, with OTHER products viewed
 * in between. Multiple `product_viewed` emissions from a re-render (same
 * elementId, same pathname, no intermediates) do NOT count.
 */
export class ProductRevisitDetector implements MetaEventDetector {
  readonly name = "product_revisit" as const;

  constructor(private readonly generateEventId: MetaEventIdGenerator) {}

  analyze(ctx: AnalysisContext): readonly MetaEvent[] {
    const views = ctx.events.filter(
      (e) => e.name === "product_viewed" && e.subject?.productId !== undefined,
    );
    if (views.length < 2) {
      return [];
    }
    const byProduct = new Map<string, RawEvent[]>();
    for (const view of views) {
      const productId = view.subject?.productId as string;
      const list = byProduct.get(productId) ?? [];
      list.push(view);
      byProduct.set(productId, list);
    }

    const results: MetaEvent[] = [];
    for (const [productId, productViews] of byProduct) {
      const sorted = [...productViews].sort((a, b) => a.timestamp - b.timestamp);
      // Find a pair (a, b) of views of THIS product with at least one OTHER
      // product view strictly between them.
      let qualifying: RawEvent[] | null = null;
      let distinctIntermediates = 0;
      for (let i = 0; i < sorted.length; i += 1) {
        for (let j = i + 1; j < sorted.length; j += 1) {
          const a = sorted[i];
          const b = sorted[j];
          // Collapse same-render re-emissions: same elementId and same pathname
          // with time delta smaller than the meaningful dwell — treat as one.
          if (
            a.elementId !== undefined &&
            a.elementId === b.elementId &&
            a.pathname === b.pathname &&
            b.timestamp - a.timestamp < T.minDwellMs
          ) {
            continue;
          }
          const intermediates = new Set<string>();
          for (const v of views) {
            if (v.timestamp <= a.timestamp || v.timestamp >= b.timestamp) {
              continue;
            }
            const other = v.subject?.productId;
            if (typeof other === "string" && other !== productId) {
              intermediates.add(other);
            }
          }
          if (intermediates.size >= T.minDistinctIntermediates) {
            qualifying = [a, b];
            distinctIntermediates = intermediates.size;
            break;
          }
        }
        if (qualifying !== null) break;
      }
      if (qualifying === null) continue;
      results.push(
        buildMetaEvent({
          name: this.name,
          ctx,
          evidence: qualifying,
          strength: Math.min(
            1,
            0.5 + distinctIntermediates / (T.minDistinctIntermediates + 2),
          ),
          metrics: {
            revisitCount: sorted.length,
            distinctIntermediates,
            productId,
          },
          subject: {
            type: "product",
            id: productId,
            ...(qualifying[1].subject?.categoryId !== undefined && {
              categoryId: qualifying[1].subject.categoryId,
            }),
            ...(qualifying[1].subject?.brandId !== undefined && {
              brandId: qualifying[1].subject.brandId,
            }),
          },
          eventId: this.generateEventId(),
          detectedAtMs: qualifying[1].timestamp,
        }),
      );
    }
    return results;
  }
}
