import { describe, expect, it } from "vitest";

import { THRESHOLDS } from "@/behavior/config/thresholds";
import { DeadClickClusterDetector } from "@/behavior/detectors/dead-click-cluster";
import type { RawEvent } from "@/behavior/types";

import {
  makeAnalysisContext,
  makeIdGenerator,
  makeRawEvent,
  resetFixtureSeed,
} from "../fixtures";

describe("DeadClickClusterDetector", () => {
  it("emits when 2 clicks have no following effect within silence window", () => {
    resetFixtureSeed();
    const detector = new DeadClickClusterDetector(makeIdGenerator("evt"));
    const { windowMs, silenceMs } = THRESHOLDS.detectors.dead_click_cluster;
    const clock = 10_000;

    const events: RawEvent[] = [
      makeRawEvent({
        name: "element_click",
        elementId: "btn:buy",
        timestamp: clock - silenceMs - 200,
      }),
      makeRawEvent({
        name: "element_click",
        elementId: "btn:buy",
        timestamp: clock - silenceMs - 100,
      }),
    ];
    const ctx = makeAnalysisContext({
      events,
      windowStart: clock - windowMs,
      windowEnd: clock,
    });
    const out = detector.analyze(ctx);
    expect(out).toHaveLength(1);
    expect(out[0].name).toBe("dead_click_cluster");
    expect(out[0].metrics["clickCount"]).toBe(2);
  });

  it("does not emit when only one click occurred", () => {
    resetFixtureSeed();
    const detector = new DeadClickClusterDetector(makeIdGenerator("evt"));
    const { windowMs, silenceMs } = THRESHOLDS.detectors.dead_click_cluster;
    const clock = 10_000;
    const events: RawEvent[] = [
      makeRawEvent({
        name: "element_click",
        elementId: "btn:buy",
        timestamp: clock - silenceMs - 100,
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

  it("does not emit when a UI change followed the clicks (not dead)", () => {
    resetFixtureSeed();
    const detector = new DeadClickClusterDetector(makeIdGenerator("evt"));
    const { windowMs, silenceMs } = THRESHOLDS.detectors.dead_click_cluster;
    const clock = 10_000;
    const events: RawEvent[] = [
      makeRawEvent({
        name: "element_click",
        elementId: "btn:buy",
        timestamp: clock - silenceMs - 200,
      }),
      makeRawEvent({
        name: "element_click",
        elementId: "btn:buy",
        timestamp: clock - silenceMs - 100,
      }),
      makeRawEvent({
        name: "ui_state_changed",
        timestamp: clock - silenceMs - 50,
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

  it("does not emit while the user is still clicking (no silence yet)", () => {
    resetFixtureSeed();
    const detector = new DeadClickClusterDetector(makeIdGenerator("evt"));
    const { windowMs, silenceMs } = THRESHOLDS.detectors.dead_click_cluster;
    const clock = 10_000;
    // Last click was just now — silence window hasn't elapsed.
    const events: RawEvent[] = [
      makeRawEvent({
        name: "element_click",
        elementId: "btn:buy",
        timestamp: clock - 200,
      }),
      makeRawEvent({
        name: "element_click",
        elementId: "btn:buy",
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
    void silenceMs;
  });
});
