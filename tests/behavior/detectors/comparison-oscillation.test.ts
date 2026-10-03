import { describe, expect, it } from "vitest";

import { THRESHOLDS } from "@/behavior/config/thresholds";
import { ComparisonOscillationDetector } from "@/behavior/detectors/comparison-oscillation";
import type { RawEvent } from "@/behavior/types";

import {
  makeAnalysisContext,
  makeIdGenerator,
  makeRawEvent,
  resetFixtureSeed,
} from "../fixtures";

function view(productId: string, timestamp: number): RawEvent {
  return makeRawEvent({
    name: "product_viewed",
    timestamp,
    subject: { productId },
  });
}

describe("ComparisonOscillationDetector", () => {
  it("emits when the user shuttles between 2-4 products without narrowing", () => {
    resetFixtureSeed();
    const detector = new ComparisonOscillationDetector(makeIdGenerator("evt"));
    const windowMs = THRESHOLDS.detectors.comparison_oscillation.windowMs;
    const clock = 300_000;
    // Sequence: A B A B A B (5 transitions, 2 candidates, no narrowing).
    const events: RawEvent[] = [
      view("p-a", clock - 50_000),
      view("p-b", clock - 40_000),
      view("p-a", clock - 30_000),
      view("p-b", clock - 20_000),
      view("p-a", clock - 10_000),
      view("p-b", clock - 5_000),
    ];
    const out = detector.analyze(
      makeAnalysisContext({
        events,
        windowStart: clock - windowMs,
        windowEnd: clock,
      }),
    );
    expect(out).toHaveLength(1);
    expect(out[0].metrics["candidateCount"]).toBe(2);
    expect(out[0].metrics["transitionCount"]).toBe(5);
  });

  it("does not emit below the transitions threshold", () => {
    resetFixtureSeed();
    const detector = new ComparisonOscillationDetector(makeIdGenerator("evt"));
    const windowMs = THRESHOLDS.detectors.comparison_oscillation.windowMs;
    const clock = 300_000;
    // Only A B A (2 transitions, below min).
    const events: RawEvent[] = [
      view("p-a", clock - 30_000),
      view("p-b", clock - 20_000),
      view("p-a", clock - 10_000),
    ];
    expect(
      detector.analyze(
        makeAnalysisContext({
          events,
          windowStart: clock - windowMs,
          windowEnd: clock,
        }),
      ),
    ).toEqual([]);
  });

  it("does not emit when the candidate set narrows in the second half", () => {
    resetFixtureSeed();
    const detector = new ComparisonOscillationDetector(makeIdGenerator("evt"));
    const windowMs = THRESHOLDS.detectors.comparison_oscillation.windowMs;
    const clock = 300_000;
    // First half: A B C. Second half: A only. Narrowing -> no oscillation.
    const events: RawEvent[] = [
      view("p-a", clock - 100_000),
      view("p-b", clock - 90_000),
      view("p-c", clock - 80_000),
      view("p-a", clock - 70_000),
      view("p-a", clock - 60_000),
      view("p-a", clock - 50_000),
      view("p-a", clock - 40_000),
      view("p-a", clock - 30_000),
    ];
    expect(
      detector.analyze(
        makeAnalysisContext({
          events,
          windowStart: clock - windowMs,
          windowEnd: clock,
        }),
      ),
    ).toEqual([]);
  });

  it("does not emit when more than maxCandidates are present", () => {
    resetFixtureSeed();
    const detector = new ComparisonOscillationDetector(makeIdGenerator("evt"));
    const windowMs = THRESHOLDS.detectors.comparison_oscillation.windowMs;
    const clock = 300_000;
    const events: RawEvent[] = [
      view("p-a", clock - 60_000),
      view("p-b", clock - 55_000),
      view("p-c", clock - 50_000),
      view("p-d", clock - 45_000),
      view("p-e", clock - 40_000),
      view("p-a", clock - 35_000),
    ];
    expect(
      detector.analyze(
        makeAnalysisContext({
          events,
          windowStart: clock - windowMs,
          windowEnd: clock,
        }),
      ),
    ).toEqual([]);
  });
});
