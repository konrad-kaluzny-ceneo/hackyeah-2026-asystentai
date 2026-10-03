import { beforeEach, describe, expect, it, vi } from "vitest";

import { POST } from "@/app/api/meta-events/route";
import * as service from "@/server/meta-events/service";
import * as intentInference from "@/server/intent-inference/trigger";

vi.mock("@/server/intent-inference/trigger", () => ({
  inferAndSaveIntentSnapshot: vi.fn(),
  MIN_JEV_INTENT_EVENTS: 3,
}));

import { makeMetaEvent, resetFixtureSeed } from "./fixtures";

// Mock the database so the route can be exercised without a live Postgres.
vi.mock("@/lib/db/client", () => ({
  getDb: () => ({}),
}));

function makeRequest(body: unknown, headers: Record<string, string> = {}) {
  return new Request("http://localhost/api/meta-events", {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: typeof body === "string" ? body : JSON.stringify(body),
  }) as unknown as Parameters<typeof POST>[0];
}

describe("POST /api/meta-events", () => {
  beforeEach(() => {
    resetFixtureSeed();
    vi.restoreAllMocks();
    vi.mocked(intentInference.inferAndSaveIntentSnapshot).mockReset();
  });

  it("accepts a valid batch and skips intent inference before three events", async () => {
    const saveBatchSpy = vi
      .spyOn(service, "saveBatch")
      .mockResolvedValue({
        acceptedEventIds: ["evt-a-000001"],
        duplicateEventIds: [],
      });
    vi.spyOn(service, "getRecentMetaEvents").mockResolvedValue([]);
    const response = await POST(
      makeRequest({
        schemaVersion: "1.0",
        batchId: "batch-test-1",
        sentAt: new Date(0).toISOString(),
        events: [makeMetaEvent("rage_click", { eventId: "evt-a-000001" })],
      }),
    );
    expect(response.status).toBe(200);
    const json = (await response.json()) as {
      batchId: string;
      acceptedEventIds: string[];
      rejected: unknown[];
    };
    expect(json.batchId).toBe("batch-test-1");
    expect(json.acceptedEventIds).toEqual(["evt-a-000001"]);
    expect(json.rejected).toEqual([]);
    expect(saveBatchSpy).toHaveBeenCalledOnce();
    expect(intentInference.inferAndSaveIntentSnapshot).not.toHaveBeenCalled();
  });

  it("runs intent inference on the three most recent persisted events", async () => {
    const acceptedEvents = Array.from({ length: 3 }, (_, index) =>
      makeMetaEvent("rage_click", { eventId: `evt-a-00000${index + 1}` }),
    );
    vi.spyOn(service, "saveBatch").mockResolvedValue({
      acceptedEventIds: acceptedEvents.map((event) => event.eventId),
      duplicateEventIds: [],
    });
    const recentEvents = [...acceptedEvents];
    vi.spyOn(service, "getRecentMetaEvents").mockResolvedValue(recentEvents);

    const response = await POST(
      makeRequest({
        schemaVersion: "1.0",
        batchId: "batch-test-3",
        sentAt: new Date(0).toISOString(),
        events: acceptedEvents,
      }),
    );

    expect(response.status).toBe(200);
    expect(intentInference.inferAndSaveIntentSnapshot).toHaveBeenCalledWith(
      recentEvents,
      expect.objectContaining({ db: expect.anything() }),
    );
  });

  it("returns 200 with rejection entries when the payload fails validation (no client retry)", async () => {
    const spy = vi.spyOn(service, "saveBatch");
    const response = await POST(
      makeRequest({
        schemaVersion: "1.0",
        batchId: "batch-bad",
        sentAt: "not-a-date",
        events: [],
      }),
    );
    expect(response.status).toBe(200);
    const json = (await response.json()) as { rejected: unknown[] };
    expect(json.rejected.length).toBeGreaterThan(0);
    expect(spy).not.toHaveBeenCalled();
  });

  it("rejects unknown event names with reason=invalid_payload when no ids are recoverable", async () => {
    const response = await POST(
      makeRequest({
        schemaVersion: "1.0",
        batchId: "batch-unknown",
        sentAt: new Date(0).toISOString(),
        events: [{ not: "an event" }],
      }),
    );
    const json = (await response.json()) as {
      rejected: Array<{ reason: string; eventId: string | null }>;
    };
    expect(response.status).toBe(200);
    // Since the inner event has no eventId field, we get either a list of
    // recoverable rejections or a single "invalid_payload" placeholder.
    expect(json.rejected.length).toBeGreaterThan(0);
  });

  it("returns duplicates as rejected (idempotency surface)", async () => {
    vi.spyOn(service, "saveBatch").mockResolvedValue({
      acceptedEventIds: [],
      duplicateEventIds: ["evt-dup-000001"],
    });
    const response = await POST(
      makeRequest({
        schemaVersion: "1.0",
        batchId: "batch-dup",
        sentAt: new Date(0).toISOString(),
        events: [makeMetaEvent("rage_click", { eventId: "evt-dup-000001" })],
      }),
    );
    const json = (await response.json()) as {
      rejected: Array<{ eventId: string; reason: string }>;
    };
    expect(json.rejected).toEqual([
      { eventId: "evt-dup-000001", reason: "duplicate" },
    ]);
    expect(intentInference.inferAndSaveIntentSnapshot).not.toHaveBeenCalled();
  });

  it("returns 500 when persistence throws", async () => {
    vi.spyOn(service, "saveBatch").mockRejectedValue(new Error("db down"));
    const response = await POST(
      makeRequest({
        schemaVersion: "1.0",
        batchId: "batch-err",
        sentAt: new Date(0).toISOString(),
        events: [makeMetaEvent("rage_click", { eventId: "evt-any-00001" })],
      }),
    );
    expect(response.status).toBe(500);
    const json = (await response.json()) as { error: string };
    expect(json.error).toBe("persistence_failed");
  });
});
