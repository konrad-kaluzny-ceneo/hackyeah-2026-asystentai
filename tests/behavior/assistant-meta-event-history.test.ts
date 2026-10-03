import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  clearAssistantMetaEventHistory,
  clearAssistantProposalTriggers,
  getAssistantMetaEventHistory,
  MAX_ASSISTANT_META_EVENTS,
  recordAssistantMetaEventBatch,
  takeAssistantProposalTrigger,
  subscribeAssistantMetaEventHistory,
} from "@/behavior/assistant-meta-event-history";

import { makeMetaEvent, resetFixtureSeed } from "./fixtures";

function event(eventId: string, detectedAtMs: number) {
  return makeMetaEvent("rage_click", {
    eventId,
    detectedAt: new Date(detectedAtMs).toISOString(),
  });
}

describe("assistant MetaEvent history", () => {
  beforeEach(() => {
    clearAssistantMetaEventHistory();
    resetFixtureSeed();
  });

  it("deduplicates events, keeps chronological order, and caps history at 10", () => {
    recordAssistantMetaEventBatch([
      event("event-0003", 3_000),
      event("event-0001", 1_000),
      event("event-0002", 2_000),
    ]);
    recordAssistantMetaEventBatch([
      event("event-0002", 2_500),
      ...Array.from({ length: 10 }, (_, index) =>
        event(`event-${String(index + 4).padStart(4, "0")}`, (index + 4) * 1_000),
      ),
    ]);

    const history = getAssistantMetaEventHistory();
    expect(history).toHaveLength(MAX_ASSISTANT_META_EVENTS);
    expect(history.map((item) => item.eventId)).toEqual([
      "event-0004",
      "event-0005",
      "event-0006",
      "event-0007",
      "event-0008",
      "event-0009",
      "event-0010",
      "event-0011",
      "event-0012",
      "event-0013",
    ]);
  });

  it("notifies subscribers when the history changes and supports unsubscribe", () => {
    const listener = vi.fn();
    const unsubscribe = subscribeAssistantMetaEventHistory(listener);
    const first = event("event-0001", 1_000);

    recordAssistantMetaEventBatch([first]);
    recordAssistantMetaEventBatch([first]);
    expect(listener).toHaveBeenCalledTimes(1);

    unsubscribe();
    recordAssistantMetaEventBatch([event("event-0002", 2_000)]);
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("clears its bounded history and notifies subscribers", () => {
    recordAssistantMetaEventBatch([event("event-0001", 1_000)]);
    const listener = vi.fn();
    subscribeAssistantMetaEventHistory(listener);

    clearAssistantMetaEventHistory();
    expect(getAssistantMetaEventHistory()).toEqual([]);
    expect(listener).toHaveBeenCalledOnce();

    clearAssistantMetaEventHistory();
    expect(listener).toHaveBeenCalledOnce();
  });

  it("queues one chronological snapshot at the first event and every later unique event", () => {
    recordAssistantMetaEventBatch(
      Array.from({ length: 4 }, (_, index) =>
        event(`event-${String(index + 1).padStart(4, "0")}`, (index + 1) * 1_000),
      ),
    );
    expect(takeAssistantProposalTrigger()).toEqual({
      eventId: "event-0001",
      metaEvents: [event("event-0001", 1_000)],
    });
    expect(takeAssistantProposalTrigger()).toEqual({
      eventId: "event-0002",
      metaEvents: Array.from({ length: 2 }, (_, index) =>
        event(`event-${String(index + 1).padStart(4, "0")}`, (index + 1) * 1_000),
      ),
    });
    expect(takeAssistantProposalTrigger()).toEqual({
      eventId: "event-0003",
      metaEvents: Array.from({ length: 3 }, (_, index) =>
        event(`event-${String(index + 1).padStart(4, "0")}`, (index + 1) * 1_000),
      ),
    });
    expect(takeAssistantProposalTrigger()).toEqual({
      eventId: "event-0004",
      metaEvents: Array.from({ length: 4 }, (_, index) =>
        event(`event-${String(index + 1).padStart(4, "0")}`, (index + 1) * 1_000),
      ),
    });
    expect(takeAssistantProposalTrigger()).toBeNull();
  });

  it("ignores retried event IDs and can clear queued proposal triggers", () => {
    recordAssistantMetaEventBatch(
      Array.from({ length: 5 }, (_, index) =>
        event(`event-${String(index + 1).padStart(4, "0")}`, (index + 1) * 1_000),
      ),
    );
    clearAssistantProposalTriggers();
    recordAssistantMetaEventBatch([event("event-0005", 5_000)]);
    expect(takeAssistantProposalTrigger()).toBeNull();

    recordAssistantMetaEventBatch([event("event-0006", 6_000)]);
    expect(takeAssistantProposalTrigger()?.eventId).toBe("event-0006");
    clearAssistantProposalTriggers();
    expect(takeAssistantProposalTrigger()).toBeNull();
  });
});
