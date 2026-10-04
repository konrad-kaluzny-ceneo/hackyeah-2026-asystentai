import { beforeEach, describe, expect, it } from "vitest";

import {
  getDebugState,
  MAX_LAST_SENT_META_EVENTS,
  recordBatchSent,
  resetDebugStateForTests,
  setBehaviorDebugOverlayOpen,
  setDebugState,
  subscribeDebug,
  toggleBehaviorDebugOverlay,
} from "@/behavior/ui/debug-store";

import { makeIdGenerator, makeMetaEvent, resetFixtureSeed } from "./fixtures";

const defaultOverlayOpen =
  process.env.NEXT_PUBLIC_BEHAVIOR_TRACKING === "true";

describe("debug-store", () => {
  beforeEach(() => {
    resetFixtureSeed();
    resetDebugStateForTests();
  });

  it("starts in a clean state (tracker disabled)", () => {
    const s = getDebugState();
    expect(s.trackerEnabled).toBe(false);
    expect(s.overlayOpen).toBe(defaultOverlayOpen);
    expect(s.totalMetaSentThisSession).toBe(0);
    expect(s.lastSentMetaEvents).toEqual([]);
  });

  it("toggles the demo overlay flag", () => {
    expect(getDebugState().overlayOpen).toBe(defaultOverlayOpen);
    toggleBehaviorDebugOverlay();
    expect(getDebugState().overlayOpen).toBe(!defaultOverlayOpen);
    toggleBehaviorDebugOverlay();
    expect(getDebugState().overlayOpen).toBe(defaultOverlayOpen);
    setBehaviorDebugOverlayOpen(true);
    expect(getDebugState().overlayOpen).toBe(true);
  });

  it("setDebugState merges and notifies subscribers", () => {
    const seen: string[] = [];
    const unsubscribe = subscribeDebug(() => seen.push("tick"));
    setDebugState({ trackerEnabled: true });
    expect(getDebugState().trackerEnabled).toBe(true);
    expect(seen).toEqual(["tick"]);
    unsubscribe();
    setDebugState({ trackerEnabled: false });
    // No further notifications after unsubscribe.
    expect(seen).toEqual(["tick"]);
  });

  it("setDebugState skips notification when nothing changed", () => {
    setDebugState({ trackerEnabled: true });
    const seen: string[] = [];
    const unsubscribe = subscribeDebug(() => seen.push("tick"));
    setDebugState({ trackerEnabled: true }); // no-op
    expect(seen).toEqual([]);
    unsubscribe();
  });

  it("recordBatchSent prepends events and bumps the cumulative counter", () => {
    const genA = makeIdGenerator("evt");
    const genB = makeIdGenerator("evt");
    recordBatchSent({
      batchId: "batch-1",
      sentAt: new Date(0).toISOString(),
      events: [
        makeMetaEvent("rage_click", { eventId: genA() }),
        makeMetaEvent("rage_click", { eventId: genA() }),
      ],
    });
    recordBatchSent({
      batchId: "batch-2",
      sentAt: new Date(1_000).toISOString(),
      events: [makeMetaEvent("dead_click_cluster", { eventId: genB() })],
    });
    const s = getDebugState();
    expect(s.totalMetaSentThisSession).toBe(3);
    expect(s.lastSentMetaEvents).toHaveLength(3);
    // Most recent batch first:
    expect(s.lastSentMetaEvents[0].name).toBe("dead_click_cluster");
    expect(s.lastSentMetaEvents[0].batchId).toBe("batch-2");
    expect(s.lastSentMetaEvents[1].batchId).toBe("batch-1");
  });

  it("keeps the sliding window at MAX_LAST_SENT_META_EVENTS", () => {
    const many = Array.from({ length: MAX_LAST_SENT_META_EVENTS + 5 }, () =>
      makeMetaEvent("rage_click"),
    );
    recordBatchSent({
      batchId: "batch-big",
      sentAt: new Date(0).toISOString(),
      events: many,
    });
    const retained = getDebugState().lastSentMetaEvents;
    expect(retained).toHaveLength(MAX_LAST_SENT_META_EVENTS);
    expect(retained[0].eventId).toBe(many[many.length - 1].eventId);
    expect(retained[retained.length - 1].eventId).toBe(
      many[many.length - MAX_LAST_SENT_META_EVENTS].eventId,
    );
    expect(getDebugState().totalMetaSentThisSession).toBe(many.length);
  });

  it("ignores empty batches", () => {
    recordBatchSent({
      batchId: "batch-empty",
      sentAt: new Date(0).toISOString(),
      events: [],
    });
    expect(getDebugState().totalMetaSentThisSession).toBe(0);
    expect(getDebugState().lastSentMetaEvents).toEqual([]);
  });
});
