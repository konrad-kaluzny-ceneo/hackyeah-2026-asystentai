import { describe, expect, it } from "vitest";

import { THRESHOLDS } from "@/behavior/config/thresholds";
import { RapidFilterChurnDetector } from "@/behavior/detectors/rapid-filter-churn";
import type { RawEvent } from "@/behavior/types";

import {
  makeAnalysisContext,
  makeIdGenerator,
  makeRawEvent,
  resetFixtureSeed,
} from "../fixtures";

function filterEvents(
  name: "filter_added" | "filter_removed",
  filterId: string,
  timestamp: number,
): RawEvent {
  return makeRawEvent({ name, timestamp, data: { filterId } });
}

describe("RapidFilterChurnDetector", () => {
  it("emits when many filter changes occur with undo, without progress", () => {
    resetFixtureSeed();
    const detector = new RapidFilterChurnDetector(makeIdGenerator("evt"));
    const windowMs = THRESHOLDS.detectors.rapid_filter_churn.windowMs;
    const clock = 100_000;
    // 6 changes; "color" is added then removed (undone); "brand" added then removed;
    // others added once.
    const events: RawEvent[] = [
      filterEvents("filter_added", "color", clock - 5_000),
      filterEvents("filter_added", "brand", clock - 4_500),
      filterEvents("filter_removed", "color", clock - 4_000),
      filterEvents("filter_added", "size", clock - 3_500),
      filterEvents("filter_removed", "brand", clock - 3_000),
      filterEvents("filter_added", "energy", clock - 2_500),
    ];
    const out = detector.analyze(
      makeAnalysisContext({
        events,
        windowStart: clock - windowMs,
        windowEnd: clock,
      }),
    );
    expect(out).toHaveLength(1);
    expect(out[0].name).toBe("rapid_filter_churn");
    expect(out[0].metrics["filterChanges"]).toBe(6);
    expect(out[0].metrics["undoneCount"]).toBe(2);
  });

  it("does not emit below the changes threshold", () => {
    resetFixtureSeed();
    const detector = new RapidFilterChurnDetector(makeIdGenerator("evt"));
    const windowMs = THRESHOLDS.detectors.rapid_filter_churn.windowMs;
    const clock = 100_000;
    const events: RawEvent[] = [
      filterEvents("filter_added", "color", clock - 5_000),
      filterEvents("filter_removed", "color", clock - 4_000),
      filterEvents("filter_added", "brand", clock - 3_000),
      filterEvents("filter_removed", "brand", clock - 2_000),
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

  it("does not emit when no filter was undone", () => {
    resetFixtureSeed();
    const detector = new RapidFilterChurnDetector(makeIdGenerator("evt"));
    const windowMs = THRESHOLDS.detectors.rapid_filter_churn.windowMs;
    const clock = 100_000;
    const events: RawEvent[] = [
      filterEvents("filter_added", "a", clock - 5_000),
      filterEvents("filter_added", "b", clock - 4_500),
      filterEvents("filter_added", "c", clock - 4_000),
      filterEvents("filter_added", "d", clock - 3_500),
      filterEvents("filter_added", "e", clock - 3_000),
      filterEvents("filter_added", "f", clock - 2_500),
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

  it("does not emit when progress occurred within the window", () => {
    resetFixtureSeed();
    const detector = new RapidFilterChurnDetector(makeIdGenerator("evt"));
    const windowMs = THRESHOLDS.detectors.rapid_filter_churn.windowMs;
    const clock = 100_000;
    const events: RawEvent[] = [
      filterEvents("filter_added", "a", clock - 5_000),
      filterEvents("filter_added", "b", clock - 4_500),
      filterEvents("filter_removed", "a", clock - 4_000),
      filterEvents("filter_removed", "b", clock - 3_500),
      filterEvents("filter_added", "c", clock - 3_000),
      filterEvents("filter_added", "d", clock - 2_500),
      makeRawEvent({
        name: "product_viewed",
        timestamp: clock - 1_000,
        subject: { productId: "p-1" },
      }),
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
