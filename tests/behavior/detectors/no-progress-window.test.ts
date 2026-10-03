import { describe, expect, it } from "vitest";

import { THRESHOLDS } from "@/behavior/config/thresholds";
import { NoProgressWindowDetector } from "@/behavior/detectors/no-progress-window";
import type { RawEvent } from "@/behavior/types";

import {
  makeAnalysisContext,
  makeIdGenerator,
  makeRawEvent,
  resetFixtureSeed,
} from "../fixtures";

describe("NoProgressWindowDetector", () => {
  it("emits when the user is active for the window but produces no progress event", () => {
    resetFixtureSeed();
    const detector = new NoProgressWindowDetector(makeIdGenerator("evt"));
    const windowMs = THRESHOLDS.detectors.no_progress_window.windowMs;
    const clock = 200_000;
    const events: RawEvent[] = [
      makeRawEvent({ name: "element_click", elementId: "a", timestamp: clock - windowMs + 5_000 }),
      makeRawEvent({ name: "scroll_summary", timestamp: clock - windowMs + 30_000 }),
      makeRawEvent({ name: "filter_added", timestamp: clock - windowMs + 60_000, data: { filterId: "x" } }),
      makeRawEvent({ name: "element_click", elementId: "b", timestamp: clock - 10_000 }),
    ];
    const out = detector.analyze(
      makeAnalysisContext({
        events,
        windowStart: clock - windowMs,
        windowEnd: clock,
      }),
    );
    expect(out).toHaveLength(1);
    expect(out[0].name).toBe("no_progress_window");
    expect(out[0].metrics["clickCount"]).toBe(2);
    expect(out[0].metrics["scrollCount"]).toBe(1);
    expect(out[0].metrics["filterChanges"]).toBe(1);
  });

  it("does not emit when a progress event is present", () => {
    resetFixtureSeed();
    const detector = new NoProgressWindowDetector(makeIdGenerator("evt"));
    const windowMs = THRESHOLDS.detectors.no_progress_window.windowMs;
    const clock = 200_000;
    const events: RawEvent[] = [
      makeRawEvent({ name: "element_click", elementId: "a", timestamp: clock - windowMs + 5_000 }),
      makeRawEvent({ name: "element_click", elementId: "b", timestamp: clock - windowMs + 30_000 }),
      makeRawEvent({
        name: "product_viewed",
        timestamp: clock - windowMs + 45_000,
        subject: { productId: "p-1" },
      }),
      makeRawEvent({ name: "element_click", elementId: "c", timestamp: clock - 5_000 }),
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

  it("does not emit when activity is too sparse to span the window", () => {
    resetFixtureSeed();
    const detector = new NoProgressWindowDetector(makeIdGenerator("evt"));
    const windowMs = THRESHOLDS.detectors.no_progress_window.windowMs;
    const clock = 200_000;
    // Two clicks tightly clustered at the start; nothing for the rest.
    const events: RawEvent[] = [
      makeRawEvent({ name: "element_click", elementId: "a", timestamp: clock - windowMs + 1_000 }),
      makeRawEvent({ name: "element_click", elementId: "a", timestamp: clock - windowMs + 2_000 }),
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
