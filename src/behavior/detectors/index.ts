import type { MetaEventDetector } from "../types";

import type { MetaEventIdGenerator } from "./base";
import { AssistantProposalDismissedDetector } from "./assistant-proposal-dismissed";
import { ComparisonOscillationDetector } from "./comparison-oscillation";
import { CategoryInterestDetector } from "./category-interest";
import { DeadClickClusterDetector } from "./dead-click-cluster";
import { DescriptionFocusDetector } from "./description-focus";
import { FilterEngagementDetector } from "./filter-engagement";
import { HesitationDwellDetector } from "./hesitation-dwell";
import { NavigationLoopDetector } from "./navigation-loop";
import { NoProgressWindowDetector } from "./no-progress-window";
import { PriceFocusDetector } from "./price-focus";
import { ProductRevisitDetector } from "./product-revisit";
import { RapidScrollBurstDetector } from "./rapid-scroll-burst";
import { RageClickDetector } from "./rage-click";
import { RapidFilterChurnDetector } from "./rapid-filter-churn";
import { SearchRefinementLoopDetector } from "./search-refinement-loop";
import { SustainedProductInterestDetector } from "./sustained-product-interest";

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
    new SustainedProductInterestDetector(generateEventId),
    new CategoryInterestDetector(generateEventId),
    new FilterEngagementDetector(generateEventId),
    new HesitationDwellDetector(generateEventId),
    new RapidScrollBurstDetector(generateEventId),
    new NavigationLoopDetector(generateEventId),
    new PriceFocusDetector(generateEventId),
    new DescriptionFocusDetector(generateEventId),
    new SearchRefinementLoopDetector(generateEventId),
    new AssistantProposalDismissedDetector(generateEventId),
  ];
}
