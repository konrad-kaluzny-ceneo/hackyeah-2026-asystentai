import { describe, expect, it } from "vitest";

import type { Database } from "@/lib/db/client";
import { saveIntentSnapshot } from "@/server/intent-inference/service";
import { IntentSnapshotInputSchema } from "@/server/intent-inference/validation";

const snapshot = IntentSnapshotInputSchema.parse({
  snapshotId: "snapshot-000001",
  sessionId: "session-000001",
  computedAt: "2026-10-03T12:00:00.000Z",
  model: "jev-latest",
  intents: {
    exploring: 0.8,
    researching: 0.6,
    comparing: 0.4,
    deciding: 0.2,
    ready_to_buy: 0.1,
    price_sensitive: 0.3,
    overloaded: 0.5,
    hesitant: 0.7,
  },
  inputEventWindow: {
    windowStartedAt: "2026-10-03T11:59:00.000Z",
    windowEndedAt: "2026-10-03T12:00:00.000Z",
    eventCount: 10,
  },
  algorithmVersion: "intent-v1",
});

function makeDbStub(inserted: boolean, captured: Array<unknown>): Database {
  return {
    insert() {
      return {
        values(row: unknown) {
          captured.push(row);
          return {
            onConflictDoNothing() {
              return {
                async returning() {
                  return inserted ? [{ snapshotId: snapshot.snapshotId }] : [];
                },
              };
            },
          };
        },
      };
    },
  } as unknown as Database;
}

describe("saveIntentSnapshot", () => {
  it("maps and accepts a fresh snapshot", async () => {
    const captured: Array<unknown> = [];
    const result = await saveIntentSnapshot(snapshot, {
      db: makeDbStub(true, captured),
    });

    expect(result).toEqual({
      acceptedSnapshotId: "snapshot-000001",
      duplicate: false,
    });
    expect(captured).toEqual([
      expect.objectContaining({
        snapshotId: "snapshot-000001",
        sessionId: "session-000001",
        computedAt: new Date("2026-10-03T12:00:00.000Z"),
        intents: snapshot.intents,
      }),
    ]);
  });

  it("reports an idempotent duplicate", async () => {
    const result = await saveIntentSnapshot(snapshot, {
      db: makeDbStub(false, []),
    });

    expect(result).toEqual({ acceptedSnapshotId: null, duplicate: true });
  });
});
