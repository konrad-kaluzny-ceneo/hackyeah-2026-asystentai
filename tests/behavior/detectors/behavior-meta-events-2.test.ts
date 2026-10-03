import { describe, expect, it } from "vitest";

import { AssistantProposalDismissedDetector } from "@/behavior/detectors/assistant-proposal-dismissed";
import { PriceFocusDetector } from "@/behavior/detectors/price-focus";
import { SearchRefinementLoopDetector } from "@/behavior/detectors/search-refinement-loop";
import { buildDetectorRegistry } from "@/behavior/detectors";
import { MetaEventSchema } from "@/server/meta-events/validation";
import type { RawEvent } from "@/behavior/types";

import {
  makeAnalysisContext,
  makeEcommerceContext,
  makeIdGenerator,
  makeRawEvent,
  resetFixtureSeed,
} from "../fixtures";

describe("S-06 meta-event detectors", () => {
  it("emits price_focus when dwell on the price box meets the threshold", () => {
    resetFixtureSeed();
    const detector = new PriceFocusDetector(makeIdGenerator("evt"));
    const events: RawEvent[] = [
      makeRawEvent({ name: "element_exposure_started", elementId: "product-price", timestamp: 10_000, pageType: "product" }),
      makeRawEvent({ name: "element_exposure_ended", elementId: "product-price", timestamp: 14_000, pageType: "product" }),
    ];
    const out = detector.analyze(
      makeAnalysisContext({
        events,
        windowStart: 0,
        windowEnd: 15_000,
        pageType: "product",
        pathname: "/produkt/lodowka-x",
        ecommerce: makeEcommerceContext({
          pageType: "product",
          pathname: "/produkt/lodowka-x",
          productId: "p-1",
          brandId: "b-1",
          categoryId: "fridges",
        }),
      }),
    );
    expect(out).toHaveLength(1);
    const event = out[0];
    expect(event.name).toBe("price_focus");
    expect(event.metrics["dwellMs"]).toBe(4_000);
    expect(event.metrics["exposureCount"]).toBe(1);
    expect(event.subject?.id).toBe("p-1");
    expect(MetaEventSchema.safeParse(event).success).toBe(true);
  });

  it("does not emit price_focus on non-product pages or below threshold", () => {
    resetFixtureSeed();
    const detector = new PriceFocusDetector(makeIdGenerator("evt"));
    const short: RawEvent[] = [
      makeRawEvent({ name: "element_exposure_started", elementId: "product-price", timestamp: 0, pageType: "product" }),
      makeRawEvent({ name: "element_exposure_ended", elementId: "product-price", timestamp: 1_000, pageType: "product" }),
    ];
    expect(
      detector.analyze(makeAnalysisContext({ events: short, windowEnd: 5_000, pageType: "product" })),
    ).toEqual([]);
    const productPageEvents: RawEvent[] = [
      makeRawEvent({ name: "element_exposure_started", elementId: "product-price", timestamp: 0, pageType: "catalog" }),
      makeRawEvent({ name: "element_exposure_ended", elementId: "product-price", timestamp: 10_000, pageType: "catalog" }),
    ];
    expect(
      detector.analyze(makeAnalysisContext({ events: productPageEvents, windowEnd: 12_000, pageType: "catalog" })),
    ).toEqual([]);
  });

  it("emits search_refinement_loop for ≥3 searches without progress", () => {
    resetFixtureSeed();
    const detector = new SearchRefinementLoopDetector(makeIdGenerator("evt"));
    const events: RawEvent[] = [
      makeRawEvent({ name: "search_submitted", timestamp: 10_000, elementId: "catalog-search" }),
      makeRawEvent({ name: "search_submitted", timestamp: 20_000, elementId: "catalog-search" }),
      makeRawEvent({ name: "search_submitted", timestamp: 30_000, elementId: "catalog-search" }),
    ];
    const out = detector.analyze(makeAnalysisContext({ events, windowStart: 0, windowEnd: 40_000 }));
    expect(out).toHaveLength(1);
    expect(out[0].metrics["searchCount"]).toBe(3);
  });

  it("does not emit search_refinement_loop when a product was viewed", () => {
    resetFixtureSeed();
    const detector = new SearchRefinementLoopDetector(makeIdGenerator("evt"));
    const events: RawEvent[] = [
      makeRawEvent({ name: "search_submitted", timestamp: 10_000 }),
      makeRawEvent({ name: "search_submitted", timestamp: 20_000 }),
      makeRawEvent({ name: "search_submitted", timestamp: 30_000 }),
      makeRawEvent({ name: "product_viewed", timestamp: 35_000, subject: { productId: "p-1" } }),
    ];
    expect(
      detector.analyze(makeAnalysisContext({ events, windowStart: 0, windowEnd: 40_000 })),
    ).toEqual([]);
  });

  it("emits assistant_proposal_dismissed on dismiss click", () => {
    resetFixtureSeed();
    const detector = new AssistantProposalDismissedDetector(makeIdGenerator("evt"));
    const events: RawEvent[] = [
      makeRawEvent({ name: "element_click", elementId: "assistant-dismiss", timestamp: 5_000 }),
    ];
    const out = detector.analyze(makeAnalysisContext({ events, windowEnd: 10_000 }));
    expect(out).toHaveLength(1);
    expect(out[0].name).toBe("assistant_proposal_dismissed");
    expect(out[0].metrics["pageType"]).toBe("catalog");
  });

  it("ignores dismiss clicks outside the window", () => {
    resetFixtureSeed();
    const detector = new AssistantProposalDismissedDetector(makeIdGenerator("evt"));
    const events: RawEvent[] = [
      makeRawEvent({ name: "element_click", elementId: "assistant-dismiss", timestamp: 0 }),
    ];
    expect(detector.analyze(makeAnalysisContext({ events, windowStart: 90_000, windowEnd: 120_000 }))).toEqual([]);
  });

  it("registry returns 15 detectors including the new three", () => {
    const names = buildDetectorRegistry(makeIdGenerator("evt")).map((d) => d.name);
    expect(names).toContain("price_focus");
    expect(names).toContain("search_refinement_loop");
    expect(names).toContain("assistant_proposal_dismissed");
    expect(names).toHaveLength(15);
  });
});
