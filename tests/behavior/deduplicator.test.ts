import { describe, expect, it } from "vitest";

import { Deduplicator } from "@/behavior/deduplicator/deduplicator";
import { THRESHOLDS } from "@/behavior/config/thresholds";
import { makeClock, makeMetaEvent } from "./fixtures";

describe("Deduplicator", () => {
  it("emits a fresh event once, then blocks duplicates within TTL", () => {
    const clock = makeClock(0);
    const d = new Deduplicator({
      ttlMs: 1_000,
      maxEntries: 100,
      cooldowns: { ...THRESHOLDS.deduplicator.cooldowns, rage_click: 0 },
      now: clock.now,
    });
    const event = makeMetaEvent("rage_click");
    expect(d.shouldEmit(event)).toBe(true);
    expect(d.shouldEmit(event)).toBe(false);
    clock.advance(2_000);
    // After TTL the same event can be emitted again.
    expect(d.shouldEmit(event)).toBe(true);
  });

  it("honours per-detector cooldown even when the key differs", () => {
    const clock = makeClock(0);
    const d = new Deduplicator({
      ttlMs: 60_000,
      maxEntries: 100,
      cooldowns: { ...THRESHOLDS.deduplicator.cooldowns, rage_click: 5_000 },
      now: clock.now,
    });
    const a = makeMetaEvent("rage_click", {
      eventId: "evt-a-000001",
      detectedAt: new Date(0).toISOString(),
    });
    expect(d.shouldEmit(a)).toBe(true);
    // Different dedupe key (different detectedAt) but SAME detector, still in
    // cooldown — must be blocked.
    const b = makeMetaEvent("rage_click", {
      eventId: "evt-b-000002",
      detectedAt: new Date(1_000).toISOString(),
    });
    expect(d.shouldEmit(b)).toBe(false);
    clock.advance(6_000);
    // Cooldown expired and dedupe key has not been seen — allow.
    expect(d.shouldEmit(b)).toBe(true);
  });

  it("separates detectors (cooldown is per-name, not global)", () => {
    const clock = makeClock(0);
    const d = new Deduplicator({
      ttlMs: 60_000,
      maxEntries: 100,
      cooldowns: { ...THRESHOLDS.deduplicator.cooldowns },
      now: clock.now,
    });
    expect(d.shouldEmit(makeMetaEvent("rage_click"))).toBe(true);
    expect(
      d.shouldEmit(
        makeMetaEvent("dead_click_cluster", {
          detectedAt: new Date(0).toISOString(),
        }),
      ),
    ).toBe(true);
  });

  it("evicts oldest entries when full", () => {
    const clock = makeClock(0);
    const d = new Deduplicator({
      ttlMs: 60_000,
      maxEntries: 2,
      cooldowns: { ...THRESHOLDS.deduplicator.cooldowns, rage_click: 0 },
      now: clock.now,
    });
    const e1 = makeMetaEvent("rage_click", {
      eventId: "evt-1-000001",
      detectedAt: new Date(1).toISOString(),
    });
    const e2 = makeMetaEvent("rage_click", {
      eventId: "evt-2-000002",
      detectedAt: new Date(2).toISOString(),
    });
    const e3 = makeMetaEvent("rage_click", {
      eventId: "evt-3-000003",
      detectedAt: new Date(3).toISOString(),
    });
    expect(d.shouldEmit(e1)).toBe(true);
    expect(d.shouldEmit(e2)).toBe(true);
    expect(d.shouldEmit(e3)).toBe(true);
    // e1 was evicted (oldest); re-emitting it now would be accepted again.
    expect(d.shouldEmit(e1)).toBe(true);
  });
});
