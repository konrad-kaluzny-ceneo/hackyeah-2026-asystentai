import { describe, expect, it } from "vitest";

import { createAnalyzer } from "@/behavior/analyzer/analyzer";
import { RawEventBuffer } from "@/behavior/buffer/buffer";
import { CategoryInterestDetector } from "@/behavior/detectors/category-interest";
import { buildDetectorRegistry } from "@/behavior/detectors";
import { FilterEngagementDetector } from "@/behavior/detectors/filter-engagement";
import { HesitationDwellDetector } from "@/behavior/detectors/hesitation-dwell";
import { NavigationLoopDetector } from "@/behavior/detectors/navigation-loop";
import { RapidScrollBurstDetector } from "@/behavior/detectors/rapid-scroll-burst";
import { SustainedProductInterestDetector } from "@/behavior/detectors/sustained-product-interest";
import { makeEcommerceContext } from "../fixtures";
import { MetaEventSchema } from "@/server/meta-events/validation";
import type { MetaEvent, RawEvent } from "@/behavior/types";

import {
  makeAnalysisContext,
  makeIdGenerator,
  makeRawEvent,
  resetFixtureSeed,
} from "../fixtures";

function exposure(
  name: "element_exposure_started" | "element_exposure_ended",
  timestamp: number,
): RawEvent {
  return makeRawEvent({
    name,
    timestamp,
    elementId: "product-card",
    subject: {
      productId: "product-1",
      categoryId: "fridges",
      brandId: "brand-1",
    },
  });
}

describe("new behavior meta-event detectors", () => {
  it("registers all six new detectors in the analyzer registry", () => {
    const names = buildDetectorRegistry(makeIdGenerator("evt")).map(
      (detector) => detector.name,
    );
    expect(names).toEqual(
      expect.arrayContaining([
        "sustained_product_interest",
        "category_interest",
        "filter_engagement",
        "hesitation_dwell",
        "rapid_scroll_burst",
        "navigation_loop",
      ]),
    );
  });

  it("forwards raw exposure through analyzer as a server-valid meta event", () => {
    resetFixtureSeed();
    const now = 10_000;
    const buffer = new RawEventBuffer({ maxEvents: 100, ttlMs: 60_000, now: () => now });
    buffer.push(exposure("element_exposure_started", 0));
    buffer.push(exposure("element_exposure_ended", now));
    const emitted: MetaEvent[] = [];
    const analyzer = createAnalyzer({
      buffer,
      detectors: buildDetectorRegistry(makeIdGenerator("evt")),
      contextProvider: { getContext: () => makeEcommerceContext({ categoryId: "fridges" }) },
      getPageInfo: () => ({ pageType: "catalog", pathname: "/katalog", pageViewId: "pv-test-1" }),
      sessionId: "session-test-1",
      now: () => now,
      onEmit: (event) => emitted.push(event),
    });
    analyzer.start();
    const results = analyzer.runOnce(60_000);
    analyzer.stop();

    const interest = results.find((event) => event.name === "sustained_product_interest");
    expect(interest).toBeDefined();
    expect(emitted).toContain(interest);
    expect(MetaEventSchema.safeParse(interest).success).toBe(true);
  });

  it("emits sustained product interest from exposure dwell", () => {
    resetFixtureSeed();
    const detector = new SustainedProductInterestDetector(makeIdGenerator("evt"));
    const out = detector.analyze(
      makeAnalysisContext({
        events: [exposure("element_exposure_started", 0), exposure("element_exposure_ended", 10_000)],
        windowStart: 0,
        windowEnd: 10_000,
      }),
    );
    expect(out).toHaveLength(1);
    expect(out[0].name).toBe("sustained_product_interest");
    expect(out[0].subject).toEqual({
      type: "product",
      id: "product-1",
      categoryId: "fridges",
      brandId: "brand-1",
    });
    expect(out[0].metrics["dwellMs"]).toBe(10_000);
  });

  it("emits category interest from product exposure", () => {
    resetFixtureSeed();
    const detector = new CategoryInterestDetector(makeIdGenerator("evt"));
    const out = detector.analyze(
      makeAnalysisContext({
        events: [exposure("element_exposure_started", 0), exposure("element_exposure_ended", 6_000)],
        windowStart: 0,
        windowEnd: 6_000,
      }),
    );
    expect(out).toHaveLength(1);
    expect(out[0].name).toBe("category_interest");
    expect(out[0].subject).toEqual({ type: "category", id: "fridges" });
    expect(out[0].metrics["uniqueProducts"]).toBe(1);
  });

  it("emits filter engagement for retained filter changes", () => {
    resetFixtureSeed();
    const detector = new FilterEngagementDetector(makeIdGenerator("evt"));
    const out = detector.analyze(
      makeAnalysisContext({
        windowEnd: 10_000,
        events: [
          makeRawEvent({ name: "filter_added", timestamp: 8_000, data: { filterId: "brand" } }),
          makeRawEvent({ name: "filter_added", timestamp: 9_000, data: { filterId: "width" } }),
        ],
      }),
    );
    expect(out).toHaveLength(1);
    expect(out[0].name).toBe("filter_engagement");
    expect(out[0].metrics["retainedCount"]).toBe(2);
    expect(out[0].metrics["filterIds"]).toBe("brand,width");
  });

  it("emits hesitation dwell from idle_started on catalog pages", () => {
    resetFixtureSeed();
    const detector = new HesitationDwellDetector(makeIdGenerator("evt"));
    const out = detector.analyze(
      makeAnalysisContext({
        pageType: "catalog",
        windowEnd: 5_000,
        events: [makeRawEvent({ name: "idle_started", timestamp: 5_000, data: { idleMs: 4_000 } })],
      }),
    );
    expect(out).toHaveLength(1);
    expect(out[0].name).toBe("hesitation_dwell");
    expect(out[0].metrics).toEqual({ idleMs: 4_000, pageType: "catalog" });
  });

  it("emits rapid scroll burst from scroll_burst", () => {
    resetFixtureSeed();
    const detector = new RapidScrollBurstDetector(makeIdGenerator("evt"));
    const out = detector.analyze(
      makeAnalysisContext({
        windowEnd: 10_000,
        events: [
          makeRawEvent({
            name: "scroll_burst",
            timestamp: 9_500,
            data: { distanceRatioBucket: "high", reversalCount: 2, scrollCount: 3 },
          }),
        ],
      }),
    );
    expect(out).toHaveLength(1);
    expect(out[0].name).toBe("rapid_scroll_burst");
    expect(out[0].metrics).toEqual({
      burstCount: 1,
      distanceRatioBucket: "high",
      reversalCount: 2,
    });
  });

  it("emits navigation loop from repeated page-enter sequence", () => {
    resetFixtureSeed();
    const detector = new NavigationLoopDetector(makeIdGenerator("evt"));
    const out = detector.analyze(
      makeAnalysisContext({
        windowEnd: 10_000,
        events: [
          makeRawEvent({ name: "page_enter", timestamp: 1_000, pageType: "catalog" }),
          makeRawEvent({ name: "page_enter", timestamp: 3_000, pageType: "product" }),
          makeRawEvent({ name: "page_enter", timestamp: 5_000, pageType: "catalog" }),
          makeRawEvent({ name: "page_enter", timestamp: 7_000, pageType: "product" }),
        ],
      }),
    );
    expect(out).toHaveLength(1);
    expect(out[0].name).toBe("navigation_loop");
    expect(out[0].metrics).toEqual({
      cycleLength: 2,
      repeatCount: 2,
      pageTypes: "catalog>product",
    });
  });
});
