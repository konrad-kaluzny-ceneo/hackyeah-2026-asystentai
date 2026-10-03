import type { MetaEventDetector } from "../types";

import type { MetaEventIdGenerator } from "./base";
import { ComparisonOscillationDetector } from "./comparison-oscillation";
import { DeadClickClusterDetector } from "./dead-click-cluster";
import { NoProgressWindowDetector } from "./no-progress-window";
import { ProductRevisitDetector } from "./product-revisit";
import { RageClickDetector } from "./rage-click";
import { RapidFilterChurnDetector } from "./rapid-filter-churn";

/**
 * Builds the detector registry. Detectors are isolated from one another —
 * each gets only the AnalysisContext. New detectors register here; nothing
 * else in the pipeline needs to change. See docs/adding-detector.md.
 */
export function buildDetectorRegistry(
  generateEventId: MetaEventIdGenerator,
): readonly MetaEventDetector[] {
  return [
    new RageClickDetector(generateEventId),
    new DeadClickClusterDetector(generateEventId),
    new RapidFilterChurnDetector(generateEventId),
    new NoProgressWindowDetector(generateEventId),
    new ProductRevisitDetector(generateEventId),
    new ComparisonOscillationDetector(generateEventId),
  ];
}
