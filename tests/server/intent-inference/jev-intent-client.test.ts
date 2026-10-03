import { describe, expect, it } from "vitest";

import { SHOPPING_INTENT_KINDS } from "@/domain/shopping-intent";
import {
  buildJevIntentRequest,
  parseJevIntentResponse,
} from "@/server/intent-inference/jev-intent-client";
import { makeMetaEvent } from "../../behavior/fixtures";

describe("JEV intent client", () => {
  it("sends only the five most recent meta events and all intent criteria", () => {
    const events = Array.from({ length: 12 }, (_, index) =>
      makeMetaEvent("category_interest", {
        eventId: `event-${String(index).padStart(2, "0")}`,
      }),
    );
    const request = buildJevIntentRequest("session-000001", events);

    expect(request.model).toBe("jev-latest");
    expect(request.state.sessionId).toBe("session-000001");
    expect(request.state.recentMetaEvents).toHaveLength(5);
    expect(request.state.recentMetaEvents[0].eventId).toBe("event-07");
    expect(request.state.recentMetaEvents.at(-1)?.eventId).toBe("event-11");
    expect(Object.keys(request.questions.intents.criteria)).toEqual(
      SHOPPING_INTENT_KINDS,
    );
  });

  it("accepts exactly eight bounded probabilities", () => {
    const response = parseJevIntentResponse({
      model: "jev-latest",
      answers: {
        intents: {
          type: "choice",
          choice: "researching",
          confidence: 0.84,
          probabilities: Object.fromEntries(
            SHOPPING_INTENT_KINDS.map((kind, index) => [kind, index / 10]),
          ),
        },
      },
      usage: { input_tokens: 100, output_tokens: 40 },
    });

    expect(response.answers.intents.probabilities.overloaded).toBe(0.6);
    expect(response.answers.intents.choice).toBe("researching");
  });

  it("rejects an incomplete probability response", () => {
    expect(() =>
      parseJevIntentResponse({
        model: "jev-latest",
        answers: {
          intents: {
            type: "choice",
            confidence: 0.5,
            probabilities: { exploring: 0.5 },
          },
        },
        usage: { input_tokens: 1, output_tokens: 1 },
      }),
    ).toThrow();
  });
});
