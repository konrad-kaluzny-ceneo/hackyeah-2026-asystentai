import type { JevAssistantOutput } from "./schema";

export type RouteDecision =
  | {
      decision: "shortcut";
      message: string;
    }
  | {
      decision: "needs_openai";
    };

/**
 * Pure decision function:
 * Shortcut only when situation is DECISION_FATIGUE, confidence >= 0.75,
 * hedging_required is false, and message_draft is non-empty.
 * All other valid outputs require the stronger model (OpenAI).
 */
export function routeJevOutput(output: JevAssistantOutput): RouteDecision {
  const messageDraft = output.proposal.message_draft?.trim() ?? "";

  if (
    output.situation === "DECISION_FATIGUE" &&
    output.proposal.confidence >= 0.75 &&
    output.proposal.hedging_required === false &&
    messageDraft.length > 0
  ) {
    return {
      decision: "shortcut",
      message: messageDraft,
    };
  }

  return {
    decision: "needs_openai",
  };
}
