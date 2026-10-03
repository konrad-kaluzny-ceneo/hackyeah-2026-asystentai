import { describe, expect, it } from "vitest";

import { routeJevOutput } from "@/server/assistant-proposal/route-decision";
import type { JevAssistantOutput } from "@/server/assistant-proposal/schema";

function output(
  situation: string,
  confidence: number,
  hedgingRequired = false,
  messageDraft: string | null = "Zawęź wybór według ważnego parametru.",
): JevAssistantOutput {
  return {
    situation,
    proposal: {
      confidence,
      hedging_required: hedgingRequired,
      message_draft: messageDraft,
    },
  };
}

describe("routeJevOutput", () => {
  it("uses a confident, unhedged decision-fatigue draft as a shortcut", () => {
    expect(routeJevOutput(output("DECISION_FATIGUE", 0.9))).toEqual({
      decision: "shortcut",
      message: "Zawęź wybór według ważnego parametru.",
    });
  });

  it("uses OpenAI when confidence is below the shortcut threshold", () => {
    expect(routeJevOutput(output("DECISION_FATIGUE", 0.7))).toEqual({
      decision: "needs_openai",
    });
  });

  it("uses OpenAI when Jev requires hedging or has no draft", () => {
    expect(
      routeJevOutput(output("DECISION_FATIGUE", 0.9, true)),
    ).toEqual({ decision: "needs_openai" });
    expect(
      routeJevOutput(output("DECISION_FATIGUE", 0.9, false, null)),
    ).toEqual({ decision: "needs_openai" });
  });

  it("uses OpenAI for other valid situations", () => {
    expect(routeJevOutput(output("PRODUCT_HESITATION", 0.95))).toEqual({
      decision: "needs_openai",
    });
  });
});
