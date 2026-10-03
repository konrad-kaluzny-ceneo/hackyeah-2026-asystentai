import type { JevAssistantOutput } from "./schema";

export type RouteDecision =
  | { decision: "shortcut"; message: string }
  | { decision: "needs_openai" };

export const SHORTCUT_CONFIDENCE_THRESHOLD = 0.5;

/** Keep a confident, unhedged decision-fatigue draft; route other valid outputs to OpenAI. */
export function routeJevOutput(output: JevAssistantOutput): RouteDecision {
  const message = output.proposal.message_draft?.trim() ?? "";

  if (
    output.situation === "DECISION_FATIGUE" &&
    output.proposal.confidence >= SHORTCUT_CONFIDENCE_THRESHOLD &&
    output.proposal.hedging_required === false &&
    message.length > 0
  ) {
    return { decision: "shortcut", message };
  }

  return { decision: "needs_openai" };
}
