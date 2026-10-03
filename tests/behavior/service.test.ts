import { describe, expect, it } from "vitest";

import { saveBatch } from "@/server/meta-events/service";
import type { Database } from "@/lib/db/client";
import type { ValidatedBatchPayload } from "@/server/meta-events/validation";

import { makeMetaEvent, resetFixtureSeed } from "./fixtures";

/**
 * Stubbed Drizzle client. We don't test SQL here — we test that service
 * translates the validated meta event into the row shape AND treats the
 * `onConflictDoNothing` returning projection correctly.
 */
function makeDbStub(options: {
  insertedIds: readonly string[];
  captured?: Array<unknown>;
}): Database {
  const captured = options.captured ?? [];
  return {
    insert() {
      return {
        values(rows: ReadonlyArray<{ eventId: string }>) {
          captured.push(rows.map((r) => r.eventId));
          return {
            onConflictDoNothing() {
              return {
                async returning() {
                  return options.insertedIds.map((eventId) => ({ eventId }));
                },
              };
            },
          };
        },
      };
    },
    execute() {
      return Promise.resolve([]);
    },
  } as unknown as Database;
}

describe("saveBatch", () => {
  it("returns accepted ids for fresh events", async () => {
    resetFixtureSeed();
    const db = makeDbStub({ insertedIds: ["evt-a-000001", "evt-b-000002"] });
    const batch: ValidatedBatchPayload = {
      schemaVersion: "1.0",
      batchId: "batch-1",
      sentAt: new Date(0).toISOString(),
      events: [
        makeMetaEvent("rage_click", { eventId: "evt-a-000001" }),
        makeMetaEvent("dead_click_cluster", { eventId: "evt-b-000002" }),
      ],
    };
    const result = await saveBatch(batch, { db });
    expect(result.acceptedEventIds).toEqual(["evt-a-000001", "evt-b-000002"]);
    expect(result.duplicateEventIds).toEqual([]);
  });

  it("flags duplicates (events the db skipped via ON CONFLICT DO NOTHING)", async () => {
    resetFixtureSeed();
    const db = makeDbStub({ insertedIds: ["evt-a-000001"] });
    const batch: ValidatedBatchPayload = {
      schemaVersion: "1.0",
      batchId: "batch-2",
      sentAt: new Date(0).toISOString(),
      events: [
        makeMetaEvent("rage_click", { eventId: "evt-a-000001" }),
        // Pretend this event was already persisted (server returns no row for it).
        makeMetaEvent("rage_click", { eventId: "evt-b-000002" }),
      ],
    };
    const result = await saveBatch(batch, { db });
    expect(result.acceptedEventIds).toEqual(["evt-a-000001"]);
    expect(result.duplicateEventIds).toEqual(["evt-b-000002"]);
  });

  it("short-circuits on empty batches", async () => {
    resetFixtureSeed();
    const captured: Array<unknown> = [];
    const db = makeDbStub({ insertedIds: [], captured });
    const batch: ValidatedBatchPayload = {
      schemaVersion: "1.0",
      batchId: "batch-3",
      sentAt: new Date(0).toISOString(),
      events: [],
    };
    const result = await saveBatch(batch, { db });
    expect(result.acceptedEventIds).toEqual([]);
    expect(result.duplicateEventIds).toEqual([]);
    expect(captured).toHaveLength(0);
  });
});
