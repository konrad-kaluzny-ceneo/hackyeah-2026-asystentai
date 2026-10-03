import { describe, expect, it } from "vitest";

import { THRESHOLDS } from "@/behavior/config/thresholds";
import { RageClickDetector } from "@/behavior/detectors/rage-click";
import type { RawEvent } from "@/behavior/types";

import {
  makeAnalysisContext,
  makeIdGenerator,
  makeRawEvent,
  resetFixtureSeed,
} from "../fixtures";

describe("RageClickDetector", () => {
  it("emits when 3 clicks on the same element occur within the window with no UI change", () => {
    resetFixtureSeed();
    const detector = new RageClickDetector(makeIdGenerator("evt"));
    const windowMs = THRESHOLDS.detectors.rage_click.windowMs;
    const clock = 10_000;

    const events: RawEvent[] = [
      makeRawEvent({
        name: "element_click",
        elementId: "btn:filter",
        timestamp: clock - windowMs + 100,
      }),
      makeRawEvent({
        name: "element_click",
        elementId: "btn:filter",
        timestamp: clock - windowMs + 300,
      }),
      makeRawEvent({
        name: "element_click",
        elementId: "btn:filter",
        timestamp: clock - windowMs + 500,
      }),
    ];

    const ctx = makeAnalysisContext({
      events,
      windowEnd: clock,
      windowStart: clock - windowMs,
    });
    const out = detector.analyze(ctx);
    expect(out).toHaveLength(1);
    expect(out[0].name).toBe("rage_click");
    expect(out[0].metrics["clickCount"]).toBe(3);
    expect(out[0].metrics["elementId"]).toBe("btn:filter");
  });

  it("does not emit below the click threshold", () => {
    resetFixtureSeed();
    const detector = new RageClickDetector(makeIdGenerator("evt"));
    const windowMs = THRESHOLDS.detectors.rage_click.windowMs;
    const clock = 10_000;

    const events: RawEvent[] = [
      makeRawEvent({
        name: "element_click",
        elementId: "btn:filter",
        timestamp: clock - 500,
      }),
      makeRawEvent({
        name: "element_click",
        elementId: "btn:filter",
        timestamp: clock - 200,
      }),
    ];
    const ctx = makeAnalysisContext({
      events,
      windowStart: clock - windowMs,
      windowEnd: clock,
    });
    expect(detector.analyze(ctx)).toEqual([]);
  });

  it("does not emit when clicks are spread beyond the window", () => {
    resetFixtureSeed();
    const detector = new RageClickDetector(makeIdGenerator("evt"));
    const windowMs = THRESHOLDS.detectors.rage_click.windowMs;
    const clock = 10_000;

    const events: RawEvent[] = [
      makeRawEvent({
        name: "element_click",
        elementId: "btn:filter",
        timestamp: clock - windowMs - 5_000,
      }),
      makeRawEvent({
        name: "element_click",
        elementId: "btn:filter",
        timestamp: clock - 1_000,
      }),
      makeRawEvent({
        name: "element_click",
        elementId: "btn:filter",
        timestamp: clock - 100,
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

  it("does not emit when UI changed after the first click", () => {
    resetFixtureSeed();
    const detector = new RageClickDetector(makeIdGenerator("evt"));
    const windowMs = THRESHOLDS.detectors.rage_click.windowMs;
    const clock = 10_000;

    const events: RawEvent[] = [
      makeRawEvent({
        name: "element_click",
        elementId: "btn:filter",
        timestamp: clock - windowMs + 100,
      }),
      makeRawEvent({
        name: "ui_state_changed",
        timestamp: clock - windowMs + 200,
      }),
      makeRawEvent({
        name: "element_click",
        elementId: "btn:filter",
        timestamp: clock - windowMs + 300,
      }),
      makeRawEvent({
        name: "element_click",
        elementId: "btn:filter",
        timestamp: clock - windowMs + 400,
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
