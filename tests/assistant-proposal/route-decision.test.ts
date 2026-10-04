import { describe, expect, it } from "vitest";

import { routeJevOutput } from "@/server/assistant-proposal/route-decision";
import type { JevAssistantOutput } from "@/server/assistant-proposal/schema";

function output(
  situation: string,
  confidence: number,
  hedgingRequired = false,
  messageDraft: string | null = "Zawęź wybór według ważnego parametru.",
  actionType: string = "NARROW_BY_SPEC",
): JevAssistantOutput {
  return {
    situation,
    intent_probabilities: {
      DECISION_FATIGUE: confidence,
      PRODUCT_HESITATION: 1 - confidence,
    },
    proposal: {
      action_type: actionType as JevAssistantOutput["proposal"]["action_type"],
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

  it("hides when no single intent clears the trigger threshold", () => {
    expect(routeJevOutput(output("DECISION_FATIGUE", 0.5))).toEqual({
      decision: "hide",
    });
  });

  it("does not trigger from a sum when every individual intent is below threshold", () => {
    expect(
      routeJevOutput({
        ...output("DECISION_FATIGUE", 0.4),
        intent_probabilities: {
          DECISION_FATIGUE: 0.4,
          PRODUCT_HESITATION: 0.35,
          NO_PROGRESS_STALL: 0.25,
        },
      }),
    ).toEqual({ decision: "hide" });
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

  it("hides when Jev picks DO_NOTHING even with a strong intent", () => {
    expect(
      routeJevOutput(
        output("SMOOTH_EXPLORATION", 0.9, false, null, "DO_NOTHING"),
      ),
    ).toEqual({ decision: "hide" });
  });

  it("keeps a strong non-smooth signal eligible when Jev picks DO_NOTHING", () => {
    expect(
      routeJevOutput(
        output("DECISION_FATIGUE", 0.9, false, null, "DO_NOTHING"),
      ),
    ).toEqual({ decision: "needs_openai" });
  });

  it("shortcuts UI_FRICTION + RESET_FILTERS to the reset action", () => {
    expect(
      routeJevOutput(
        output(
          "UI_FRICTION",
          0.9,
          false,
          "Wyczyść obecne filtry.",
          "RESET_FILTERS",
        ),
      ),
    ).toEqual({
      decision: "shortcut",
      message: "Wyczyść obecne filtry.",
    });
  });
});
