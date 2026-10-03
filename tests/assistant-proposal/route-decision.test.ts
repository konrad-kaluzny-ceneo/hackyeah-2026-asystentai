import { describe, expect, it } from "vitest";

import { routeJevOutput } from "@/server/assistant-proposal/route-decision";
import type { JevAssistantOutput } from "@/server/assistant-proposal/schema";

describe("routeJevOutput", () => {
  it("routes to shortcut when situation is DECISION_FATIGUE, confidence >= 0.75, no hedging, and draft exists", () => {
    const output: JevAssistantOutput = {
      situation: "DECISION_FATIGUE",
      proposal: {
        confidence: 0.85,
        hedging_required: false,
        message_draft: "Zawęź wyniki według pojemności — oglądałeś trzy podobne modele.",
      },
    };

    const decision = routeJevOutput(output);
    expect(decision).toEqual({
      decision: "shortcut",
      message: "Zawęź wyniki według pojemności — oglądałeś trzy podobne modele.",
    });
  });

  it("routes to shortcut at exact confidence threshold 0.75", () => {
    const output: JevAssistantOutput = {
      situation: "DECISION_FATIGUE",
      proposal: {
        confidence: 0.75,
        hedging_required: false,
        message_draft: "Pomóż zawęzić wybór.",
      },
    };

    const decision = routeJevOutput(output);
    expect(decision).toEqual({
      decision: "shortcut",
      message: "Pomóż zawęzić wybór.",
    });
  });

  it("routes to needs_openai when confidence is below 0.75", () => {
    const output: JevAssistantOutput = {
      situation: "DECISION_FATIGUE",
      proposal: {
        confidence: 0.74,
        hedging_required: false,
        message_draft: "Zawęź wyniki.",
      },
    };

    const decision = routeJevOutput(output);
    expect(decision).toEqual({ decision: "needs_openai" });
  });

  it("routes to needs_openai when hedging_required is true", () => {
    const output: JevAssistantOutput = {
      situation: "DECISION_FATIGUE",
      proposal: {
        confidence: 0.9,
        hedging_required: true,
        message_draft: "Być może warto zawęzić filtry.",
      },
    };

    const decision = routeJevOutput(output);
    expect(decision).toEqual({ decision: "needs_openai" });
  });

  it("routes to needs_openai for situations other than DECISION_FATIGUE", () => {
    const output: JevAssistantOutput = {
      situation: "PRODUCT_HESITATION",
      proposal: {
        confidence: 0.95,
        hedging_required: false,
        message_draft: "Wróć do poprzedniego modelu.",
      },
    };

    const decision = routeJevOutput(output);
    expect(decision).toEqual({ decision: "needs_openai" });
  });

  it("routes to needs_openai when message_draft is empty or whitespace", () => {
    const output: JevAssistantOutput = {
      situation: "DECISION_FATIGUE",
      proposal: {
        confidence: 0.95,
        hedging_required: false,
        message_draft: "   ",
      },
    };

    const decision = routeJevOutput(output);
    expect(decision).toEqual({ decision: "needs_openai" });
  });
});
