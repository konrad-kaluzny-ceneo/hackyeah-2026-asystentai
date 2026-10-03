import { describe, expect, it, vi } from "vitest";

import type { Database } from "@/lib/db/client";
import { inferAndSaveIntentSnapshot } from "@/server/intent-inference/trigger";
import { makeMetaEvent } from "../../behavior/fixtures";

const jevResponse = {
  model: "jev-latest",
  answers: {
    intents: {
      type: "choice" as const,
      confidence: 0.91,
      probabilities: {
        exploring: 0.8,
        researching: 0.7,
        comparing: 0.6,
        deciding: 0.5,
        ready_to_buy: 0.4,
        price_sensitive: 0.3,
        overloaded: 0.2,
        hesitant: 0.1,
      },
    },
  },
  usage: { input_tokens: 100, output_tokens: 50 },
};

function makeDbStub(captured: Array<unknown>): Database {
  return {
    insert() {
      return {
        values(row: unknown) {
          captured.push(row);
          return {
            onConflictDoNothing() {
              return {
                async returning() {
                  return [{ snapshotId: "snapshot-000001" }];
                },
              };
            },
          };
        },
      };
    },
  } as unknown as Database;
}

describe("inferAndSaveIntentSnapshot", () => {
  it("sends bounded events to JEV and persists all eight returned probabilities", async () => {
    const event = makeMetaEvent("rage_click", {
      eventId: "event-000001",
      detectedAt: "2026-10-03T12:00:00.000Z",
    });
    const requestJev = vi.fn().mockResolvedValue(jevResponse);
    const captured: Array<unknown> = [];

    const result = await inferAndSaveIntentSnapshot([event], {
      db: makeDbStub(captured),
      requestJev,
      now: () => new Date("2026-10-03T12:00:02.000Z"),
      createSnapshotId: () => "snapshot-000001",
    });

    expect(result).toEqual({
      acceptedSnapshotId: "snapshot-000001",
      duplicate: false,
    });
    expect(requestJev).toHaveBeenCalledOnce();
    expect(requestJev.mock.calls[0]?.[0]).toMatchObject({
      model: "jev-latest",
      state: {
        sessionId: "session-test-1",
        recentMetaEvents: [expect.objectContaining({ eventId: "event-000001" })],
      },
    });
    expect(captured).toEqual([
      expect.objectContaining({
        snapshotId: "snapshot-000001",
        sessionId: "session-test-1",
        computedAt: new Date("2026-10-03T12:00:02.000Z"),
        model: "jev-latest",
        intents: jevResponse.answers.intents.probabilities,
        inputEventWindow: {
          windowStartedAt: event.window.startedAt,
          windowEndedAt: event.window.endedAt,
          eventCount: 1,
        },
      }),
    ]);
  });

  it("rejects mixed-session batches before calling JEV", async () => {
    const requestJev = vi.fn();
    const first = makeMetaEvent("rage_click", { eventId: "event-000001" });
    const second = makeMetaEvent("rage_click", {
      eventId: "event-000002",
      identity: { sessionId: "session-test-2", pageViewId: "pv-test-2" },
    });

    await expect(
      inferAndSaveIntentSnapshot([first, second], { requestJev }),
    ).rejects.toThrow("one session");
    expect(requestJev).not.toHaveBeenCalled();
  });
});
