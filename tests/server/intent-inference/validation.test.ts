import { describe, expect, it } from "vitest";

import { SHOPPING_INTENT_KINDS } from "@/domain/shopping-intent";
import { IntentSnapshotInputSchema } from "@/server/intent-inference/validation";

const validSnapshot = {
  snapshotId: "snapshot-000001",
  sessionId: "session-000001",
  computedAt: "2026-10-03T12:00:00.000Z",
  model: "jev-latest",
  intents: Object.fromEntries(SHOPPING_INTENT_KINDS.map((kind) => [kind, 0.5])),
  inputEventWindow: {
    windowStartedAt: "2026-10-03T11:59:00.000Z",
    windowEndedAt: "2026-10-03T12:00:00.000Z",
    eventCount: 10,
  },
  algorithmVersion: "intent-v1",
};

describe("IntentSnapshotInputSchema", () => {
  it("accepts a complete set of eight probabilities", () => {
    const result = IntentSnapshotInputSchema.safeParse(validSnapshot);
    expect(result.success).toBe(true);
  });

  it("rejects probabilities outside 0..1", () => {
    const result = IntentSnapshotInputSchema.safeParse({
      ...validSnapshot,
      intents: { ...validSnapshot.intents, overloaded: 1.01 },
    });
    expect(result.success).toBe(false);
  });

  it("rejects missing intent keys and reversed event windows", () => {
    const missingKey = { ...validSnapshot, intents: { exploring: 0.5 } };
    const reversedWindow = {
      ...validSnapshot,
      inputEventWindow: {
        ...validSnapshot.inputEventWindow,
        windowStartedAt: "2026-10-03T12:01:00.000Z",
      },
    };

    expect(IntentSnapshotInputSchema.safeParse(missingKey).success).toBe(false);
    expect(IntentSnapshotInputSchema.safeParse(reversedWindow).success).toBe(false);
  });
});
