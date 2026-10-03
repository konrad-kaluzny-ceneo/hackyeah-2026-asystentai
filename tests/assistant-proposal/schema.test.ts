import { describe, expect, it } from "vitest";

import {
  JevAssistantOutputSchema,
  JevProposalSchema,
} from "@/server/assistant-proposal/schema";

describe("JevAssistantOutputSchema", () => {
  it("validates correct Jev output format", () => {
    const raw = {
      situation: "DECISION_FATIGUE",
      primary_meta_event: "comparison_oscillation",
      signal_strength: 0.88,
      key_evidence: ["3 powroty do lodówki Samsung"],
      user_context_summary: "Przegląda 3 zbliżone lodówki",
      proposal: {
        action_type: "NARROW_BY_SPEC",
        confidence: 0.85,
        hedging_required: false,
        message_draft: "Zawęź według pojemności.",
        reasoning: "Wysoka oscylacja",
      },
    };

    const parsed = JevAssistantOutputSchema.safeParse(raw);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.situation).toBe("DECISION_FATIGUE");
      expect(parsed.data.proposal.confidence).toBe(0.85);
      expect(parsed.data.proposal.hedging_required).toBe(false);
    }
  });

  it("rejects confidence outside [0, 1]", () => {
    const tooHigh = {
      action_type: "NARROW_BY_SPEC",
      confidence: 1.5,
      hedging_required: false,
    };
    expect(JevProposalSchema.safeParse(tooHigh).success).toBe(false);

    const negative = {
      action_type: "NARROW_BY_SPEC",
      confidence: -0.1,
      hedging_required: false,
    };
    expect(JevProposalSchema.safeParse(negative).success).toBe(false);
  });

  it("rejects when proposal or situation is missing", () => {
    expect(JevAssistantOutputSchema.safeParse({ situation: "DECISION_FATIGUE" }).success).toBe(false);
    expect(
      JevAssistantOutputSchema.safeParse({
        proposal: { confidence: 0.8, hedging_required: false },
      }).success,
    ).toBe(false);
  });

  it("rejects a Jev situation outside the prompt allowlist", () => {
    expect(
      JevAssistantOutputSchema.safeParse({
        situation: "UNRECOGNIZED_STATE",
        proposal: { confidence: 0.95, hedging_required: false },
      }).success,
    ).toBe(false);
  });
});
