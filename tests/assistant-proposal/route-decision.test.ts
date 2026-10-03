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
  it("uses a confident, unhedged fatigue draft as a shortcut", () => {
    expect(routeJevOutput(output("DECISION_FATIGUE", 0.9))).toEqual({
      decision: "shortcut",
      message: "Zawęź wybór według ważnego parametru.",
    });
  });

  it("uses OpenAI below the shortcut confidence threshold", () => {
    expect(routeJevOutput(output("DECISION_FATIGUE", 0.49))).toEqual({
      decision: "needs_openai",
    });
  });

  it("uses OpenAI for hedged, empty-draft, or non-fatigue output", () => {
    expect(routeJevOutput(output("DECISION_FATIGUE", 0.9, true))).toEqual({
      decision: "needs_openai",
    });
    expect(
      routeJevOutput(output("DECISION_FATIGUE", 0.9, false, "  ")),
    ).toEqual({ decision: "needs_openai" });
    expect(routeJevOutput(output("PRODUCT_HESITATION", 0.95))).toEqual({
      decision: "needs_openai",
    });
  });
});
