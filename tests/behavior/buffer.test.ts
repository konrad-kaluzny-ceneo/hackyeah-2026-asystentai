import { describe, expect, it } from "vitest";

import { RawEventBuffer } from "@/behavior/buffer/buffer";
import {
  makeClock,
  makeRawEvent,
  resetFixtureSeed,
} from "./fixtures";

describe("RawEventBuffer", () => {
  it("appends events and reads them back in order", () => {
    resetFixtureSeed();
    const clock = makeClock(0);
    const buffer = new RawEventBuffer({
      maxEvents: 10,
      ttlMs: 60_000,
      now: clock.now,
    });
    buffer.push(makeRawEvent({ timestamp: 10 }));
    buffer.push(makeRawEvent({ timestamp: 20 }));
    expect(buffer.size()).toBe(2);
    expect(buffer.readSince(0).map((e) => e.timestamp)).toEqual([10, 20]);
  });

  it("evicts events older than TTL", () => {
    resetFixtureSeed();
    const clock = makeClock(0);
    const buffer = new RawEventBuffer({
      maxEvents: 10,
      ttlMs: 1_000,
      now: clock.now,
    });
    buffer.push(makeRawEvent({ timestamp: 0 }));
    buffer.push(makeRawEvent({ timestamp: 500 }));
    clock.advance(2_000);
    // Both are older than 1s relative to current time.
    expect(buffer.size()).toBe(0);
  });

  it("enforces maxEvents by dropping oldest", () => {
    resetFixtureSeed();
    const clock = makeClock(0);
    const buffer = new RawEventBuffer({
      maxEvents: 3,
      ttlMs: 60_000,
      now: clock.now,
    });
    for (let i = 0; i < 5; i += 1) {
      buffer.push(makeRawEvent({ timestamp: i * 10 }));
    }
    expect(buffer.size()).toBe(3);
    const ts = buffer.readSince(0).map((e) => e.timestamp);
    expect(ts).toEqual([20, 30, 40]);
    expect(buffer.wasPrunedSinceLastSnapshot()).toBe(true);
  });

  it("clearBefore removes events before the cutoff", () => {
    resetFixtureSeed();
    const clock = makeClock(0);
    const buffer = new RawEventBuffer({
      maxEvents: 10,
      ttlMs: 60_000,
      now: clock.now,
    });
    buffer.push(makeRawEvent({ timestamp: 10 }));
    buffer.push(makeRawEvent({ timestamp: 20 }));
    buffer.push(makeRawEvent({ timestamp: 30 }));
    buffer.clearBefore(20);
    expect(buffer.readSince(0).map((e) => e.timestamp)).toEqual([20, 30]);
  });

  it("snapshot round-trip preserves events up to maxEvents", () => {
    resetFixtureSeed();
    const clock = makeClock(0);
    const buffer = new RawEventBuffer({
      maxEvents: 2,
      ttlMs: 60_000,
      now: clock.now,
    });
    buffer.push(makeRawEvent({ timestamp: 1 }));
    buffer.push(makeRawEvent({ timestamp: 2 }));
    buffer.push(makeRawEvent({ timestamp: 3 }));
    const snapshot = buffer.toJSON();
    expect(snapshot).toHaveLength(2);

    const restored = new RawEventBuffer({
      maxEvents: 5,
      ttlMs: 60_000,
      now: clock.now,
    });
    restored.loadSnapshot(snapshot);
    expect(restored.size()).toBe(2);
  });
});
