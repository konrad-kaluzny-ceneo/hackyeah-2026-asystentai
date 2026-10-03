import { describe, expect, it } from "vitest";

import { ProductRevisitDetector } from "@/behavior/detectors/product-revisit";
import type { RawEvent } from "@/behavior/types";

import {
  makeAnalysisContext,
  makeIdGenerator,
  makeRawEvent,
  resetFixtureSeed,
} from "../fixtures";

function view(productId: string, timestamp: number, elementId?: string): RawEvent {
  return makeRawEvent({
    name: "product_viewed",
    timestamp,
    subject: { productId },
    ...(elementId !== undefined && { elementId }),
    pathname: `/katalog/${productId}`,
  });
}

describe("ProductRevisitDetector", () => {
  it("emits when a product is revisited after viewing a different product", () => {
    resetFixtureSeed();
    const detector = new ProductRevisitDetector(makeIdGenerator("evt"));
    const events: RawEvent[] = [
      view("p-1", 1_000, "card:fridge-a"),
      view("p-2", 5_000, "card:fridge-b"),
      view("p-1", 10_000, "card:fridge-a"),
    ];
    const out = detector.analyze(makeAnalysisContext({ events }));
    expect(out).toHaveLength(1);
    expect(out[0].metrics["productId"]).toBe("p-1");
    expect(out[0].metrics["distinctIntermediates"]).toBe(1);
    expect(out[0].subject).toEqual({ type: "product", id: "p-1" });
  });

  it("does not emit on consecutive same-product views without intermediates (re-render)", () => {
    resetFixtureSeed();
    const detector = new ProductRevisitDetector(makeIdGenerator("evt"));
    const events: RawEvent[] = [
      view("p-1", 1_000, "card:fridge-a"),
      view("p-1", 1_500, "card:fridge-a"), // re-render, same elementId, same path
    ];
    expect(detector.analyze(makeAnalysisContext({ events }))).toEqual([]);
  });

  it("does not emit when only one view happened", () => {
    resetFixtureSeed();
    const detector = new ProductRevisitDetector(makeIdGenerator("evt"));
    const events: RawEvent[] = [view("p-1", 1_000)];
    expect(detector.analyze(makeAnalysisContext({ events }))).toEqual([]);
  });

  it("does not emit for distinct products without revisit", () => {
    resetFixtureSeed();
    const detector = new ProductRevisitDetector(makeIdGenerator("evt"));
    const events: RawEvent[] = [view("p-1", 1_000), view("p-2", 5_000)];
    expect(detector.analyze(makeAnalysisContext({ events }))).toEqual([]);
  });
});
