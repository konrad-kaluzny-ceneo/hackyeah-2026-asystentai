import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";

import { RawEventBuffer } from "@/behavior/buffer/buffer";
import { createCollector } from "@/behavior/collector/collector";
import { resetSessionStateForTests } from "@/behavior/collector/session";
import { PAGE_TYPE_RULES } from "@/behavior/config/page-types";
import { THRESHOLDS } from "@/behavior/config/thresholds";

import { makeClock, makeIdGenerator } from "./fixtures";

describe("Collector DOM trackers", () => {
  beforeEach(() => {
    resetSessionStateForTests();
    window.sessionStorage.clear();
    window.history.replaceState(null, "", "/katalog");
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  function setup() {
    const clock = makeClock(0);
    const buffer = new RawEventBuffer({
      maxEvents: 200,
      ttlMs: 60_000,
      now: clock.now,
    });
    const collector = createCollector({
      buffer,
      rules: PAGE_TYPE_RULES,
      now: clock.now,
      generateId: makeIdGenerator("raw"),
    });
    return { collector, buffer, clock };
  }

  it("emits filter changes with a stable id but without the form value", () => {
    const { collector, buffer } = setup();
    const input = document.createElement("input");
    input.dataset.elementId = "filter-price-min";
    input.dataset.filterId = "price";
    document.body.append(input);

    input.value = "2000";
    input.dispatchEvent(new Event("change", { bubbles: true }));
    input.value = "";
    input.dispatchEvent(new Event("change", { bubbles: true }));

    const filterEvents = buffer
      .readSince(0)
      .filter((event) => event.name === "filter_added" || event.name === "filter_removed");
    expect(filterEvents.map((event) => event.name)).toEqual([
      "filter_added",
      "filter_removed",
    ]);
    expect(filterEvents[0].elementId).toBe("filter-price-min");
    expect(filterEvents[0].data).toEqual({ filterId: "price" });
    expect(JSON.stringify(filterEvents)).not.toContain("2000");

    collector.destroy();
    input.remove();
  });

  it("emits idle_started and idle_ended around a pause", () => {
    vi.useFakeTimers();
    const { collector, buffer } = setup();

    vi.advanceTimersByTime(THRESHOLDS.idle.idleMs);
    document.dispatchEvent(new Event("keydown", { bubbles: true }));

    expect(buffer.readSince(0).map((event) => event.name)).toContain("idle_started");
    expect(buffer.readSince(0).map((event) => event.name)).toContain("idle_ended");
    expect(
      buffer.readSince(0).filter((event) => event.name === "idle_started"),
    ).toHaveLength(1);
    expect(
      buffer.readSince(0).filter((event) => event.name === "idle_ended"),
    ).toHaveLength(1);

    collector.destroy();
  });

  it("emits a scroll_burst for fast movement with direction reversals", () => {
    vi.useFakeTimers();
    const { collector, buffer, clock } = setup();
    let scrollY = 0;
    Object.defineProperty(window, "scrollY", {
      configurable: true,
      get: () => scrollY,
    });

    for (const nextY of [400, 0, 400]) {
      scrollY = nextY;
      clock.advance(100);
      window.dispatchEvent(new Event("scroll"));
    }

    const burst = buffer.readSince(0).find((event) => event.name === "scroll_burst");
    expect(burst?.data).toEqual({
      scrollCount: 3,
      distanceRatioBucket: "high",
      reversalCount: 2,
    });

    collector.destroy();
  });
});
