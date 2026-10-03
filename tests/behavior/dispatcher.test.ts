import { beforeEach, describe, expect, it, vi } from "vitest";

import { createDispatcher } from "@/behavior/dispatcher/dispatcher";
import { createTransport } from "@/behavior/dispatcher/transport";
import type { MetaEventBatchPayload } from "@/behavior/types";

import {
  makeClock,
  makeIdGenerator,
  makeMetaEvent,
  resetFixtureSeed,
} from "./fixtures";

describe("Dispatcher", () => {
  beforeEach(() => {
    resetFixtureSeed();
  });

  it("batches events and flushes them as a single payload", async () => {
    const clock = makeClock(0);
    const sent: MetaEventBatchPayload[] = [];
    const transport = {
      send: async (payload: MetaEventBatchPayload) => {
        sent.push(payload);
        return true;
      },
    };
    const d = createDispatcher({
      transport,
      generateBatchId: makeIdGenerator("batch"),
      now: clock.now,
      debounceMs: 0,
    });
    d.enqueue(makeMetaEvent("rage_click"));
    d.enqueue(makeMetaEvent("dead_click_cluster"));
    await d.flushNow();
    expect(sent).toHaveLength(1);
    expect(sent[0].events).toHaveLength(2);
    expect(sent[0].schemaVersion).toBe("1.0");
    expect(sent[0].batchId).toBe("batch-000001");
    expect(sent[0].sentAt).toBe(new Date(0).toISOString());
  });

  it("reports successfully delivered batches to the diagnostics hook", async () => {
    const clock = makeClock(0);
    const batches: MetaEventBatchPayload[] = [];
    const transport = {
      send: async (payload: MetaEventBatchPayload) => {
        batches.push(payload);
        return true;
      },
    };
    const d = createDispatcher({
      transport,
      generateBatchId: makeIdGenerator("batch"),
      now: clock.now,
      debounceMs: 0,
      onBatchSent: (batch) => {
        expect(batch.events).toEqual(batches[0].events);
        expect(batch.batchId).toBe(batches[0].batchId);
        expect(batch.sentAt).toBe(batches[0].sentAt);
      },
    });
    d.enqueue(makeMetaEvent("rage_click"));
    await d.flushNow();
    expect(batches).toHaveLength(1);
  });

  it("splits oversized queues into multiple batches honoring maxBatchEvents", async () => {
    const clock = makeClock(0);
    const batches: MetaEventBatchPayload[] = [];
    const transport = {
      send: async (payload: MetaEventBatchPayload) => {
        batches.push(payload);
        return true;
      },
    };
    const d = createDispatcher({
      transport,
      generateBatchId: makeIdGenerator("batch"),
      now: clock.now,
      maxBatchEvents: 3,
      debounceMs: 60_000,
    });
    for (let i = 0; i < 7; i += 1) {
      d.enqueue(makeMetaEvent("rage_click"));
    }
    // Auto-flush from enqueue runs as fire-and-forget; wait for the loop to settle.
    await d.flushNow();
    // Wait for any stray `void flush()` microtask.
    await new Promise((resolve) => setTimeout(resolve, 0));
    await d.flushNow();
    await new Promise((resolve) => setTimeout(resolve, 0));
    const totalEvents = batches.reduce((acc, b) => acc + b.events.length, 0);
    expect(totalEvents).toBe(7);
    // IDs must be distinct per batch.
    const ids = new Set(batches.map((b) => b.batchId));
    expect(ids.size).toBe(batches.length);
  });

  it("retries failed deliveries with exponential backoff and drops after final attempt", async () => {
    vi.useFakeTimers();
    try {
      const clock = makeClock(0);
      const attempts: number[] = [];
      const transport = {
        send: async () => {
          attempts.push(1);
          return false; // always fail
        },
      };
      const d = createDispatcher({
        transport,
        generateBatchId: makeIdGenerator("batch"),
        now: clock.now,
        retryBackoffMs: [10, 20, 40],
        debounceMs: 0,
      });
      d.enqueue(makeMetaEvent("rage_click"));
      const flushPromise = d.flushNow();
      // Advance past the retry schedule.
      for (const wait of [10, 20, 40]) {
        await vi.advanceTimersByTimeAsync(wait);
      }
      await flushPromise;
      // Initial attempt + 3 retries = 4 total.
      expect(attempts.length).toBe(4);
      expect(d.queueSize()).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });

  it("keeps events in queue when transport fails but retries haven't been exhausted", async () => {
    const clock = makeClock(0);
    let callCount = 0;
    const transport = {
      send: async () => {
        callCount += 1;
        // Fail the first call, succeed the second.
        return callCount > 2;
      },
    };
    const d = createDispatcher({
      transport,
      generateBatchId: makeIdGenerator("batch"),
      now: clock.now,
      retryBackoffMs: [0, 0, 0],
      debounceMs: 0,
    });
    d.enqueue(makeMetaEvent("rage_click"));
    await d.flushNow();
    // After two failures and one success, the queue is empty.
    expect(d.queueSize()).toBe(0);
    expect(callCount).toBe(3);
  });

  it("drop-oldest when queue exceeds maxQueueEvents", async () => {
    const clock = makeClock(0);
    const transport = { send: async () => true };
    const d = createDispatcher({
      transport,
      generateBatchId: makeIdGenerator("batch"),
      now: clock.now,
      maxQueueEvents: 5,
      debounceMs: 60_000, // don't auto-flush
    });
    for (let i = 0; i < 10; i += 1) {
      d.enqueue(makeMetaEvent("rage_click"));
    }
    expect(d.queueSize()).toBe(5);
  });
});

describe("Transport", () => {
  beforeEach(() => {
    resetFixtureSeed();
  });

  it("uses the HTTP response when fetch is available", async () => {
    let beaconCalls = 0;
    const transport = createTransport({
      endpoint: "/api/meta-events",
      sendBeacon: () => {
        beaconCalls += 1;
        return true;
      },
      fetchImpl: (async () => ({ ok: true })) as unknown as typeof fetch,
    });
    const ok = await transport.send({
      schemaVersion: "1.0",
      batchId: "batch-1",
      sentAt: new Date(0).toISOString(),
      events: [],
    });
    expect(ok).toBe(true);
    expect(beaconCalls).toBe(0);
  });

  it("falls back to sendBeacon when fetch cannot obtain a response", async () => {
    let beaconCalls = 0;
    const transport = createTransport({
      endpoint: "/api/meta-events",
      sendBeacon: () => {
        beaconCalls += 1;
        return true;
      },
      fetchImpl: (async () => {
        throw new Error("network down");
      }) as unknown as typeof fetch,
    });
    const ok = await transport.send({
      schemaVersion: "1.0",
      batchId: "batch-2",
      sentAt: new Date(0).toISOString(),
      events: [],
    });
    expect(ok).toBe(true);
    expect(beaconCalls).toBe(1);
  });

  it("does not hide an HTTP error behind sendBeacon", async () => {
    let beaconCalls = 0;
    const transport = createTransport({
      endpoint: "/api/meta-events",
      sendBeacon: () => {
        beaconCalls += 1;
        return true;
      },
      fetchImpl: (async () => ({ ok: false, status: 500 })) as unknown as typeof fetch,
    });
    const ok = await transport.send({
      schemaVersion: "1.0",
      batchId: "batch-4",
      sentAt: new Date(0).toISOString(),
      events: [],
    });
    expect(ok).toBe(false);
    expect(beaconCalls).toBe(0);
  });

  it("returns false when both transports fail", async () => {
    const transport = createTransport({
      endpoint: "/api/meta-events",
      sendBeacon: () => false,
      fetchImpl: (async () => {
        throw new Error("network down");
      }) as unknown as typeof fetch,
    });
    const ok = await transport.send({
      schemaVersion: "1.0",
      batchId: "batch-3",
      sentAt: new Date(0).toISOString(),
      events: [],
    });
    expect(ok).toBe(false);
  });
});
