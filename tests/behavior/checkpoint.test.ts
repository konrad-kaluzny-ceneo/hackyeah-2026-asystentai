import { beforeEach, describe, expect, it } from "vitest";

import { Checkpoint } from "@/behavior/buffer/checkpoint";
import {
  RAW_EVENT_BUFFER_SCHEMA_VERSION,
  type RawEvent,
} from "@/behavior/types";
import { makeRawEvent, resetFixtureSeed } from "./fixtures";

const KEY = "behavior.test.checkpoint";

describe("Checkpoint", () => {
  beforeEach(() => {
    resetFixtureSeed();
    window.sessionStorage.clear();
  });

  it("round-trips events through sessionStorage", () => {
    const checkpoint = new Checkpoint(KEY);
    const events: RawEvent[] = [
      makeRawEvent({ timestamp: 1 }),
      makeRawEvent({ timestamp: 2 }),
    ];
    expect(checkpoint.save("session-test-1", events)).toBe(true);
    const restored = checkpoint.restore("session-test-1");
    expect(restored).toBeDefined();
    expect(restored?.events.map((e) => e.timestamp)).toEqual([1, 2]);
  });

  it("returns undefined when schema version mismatches", () => {
    window.sessionStorage.setItem(
      KEY,
      JSON.stringify({
        schemaVersion: RAW_EVENT_BUFFER_SCHEMA_VERSION + 1,
        savedAt: 0,
        sessionId: "session-test-1",
        events: [],
      }),
    );
    const checkpoint = new Checkpoint(KEY);
    expect(checkpoint.restore("session-test-1")).toBeUndefined();
    // Schema drift should also clear the entry.
    expect(window.sessionStorage.getItem(KEY)).toBeNull();
  });

  it("returns undefined when sessionId differs (cross-tab isolation)", () => {
    const checkpoint = new Checkpoint(KEY);
    checkpoint.save("session-A", [makeRawEvent()]);
    expect(checkpoint.restore("session-B")).toBeUndefined();
  });

  it("refuses to save payloads above the size cap", () => {
    const checkpoint = new Checkpoint(KEY, /* maxBytes */ 100);
    const big = Array.from({ length: 50 }, () => makeRawEvent());
    expect(checkpoint.save("session-test-1", big)).toBe(false);
    expect(window.sessionStorage.getItem(KEY)).toBeNull();
  });

  it("returns undefined on malformed JSON instead of throwing", () => {
    window.sessionStorage.setItem(KEY, "{not-json");
    const checkpoint = new Checkpoint(KEY);
    expect(checkpoint.restore("session-test-1")).toBeUndefined();
  });
});
