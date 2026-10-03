import type { JevAssistantOutput } from "./schema";

export type RouteDecision =
  | { decision: "shortcut"; message: string }
  | { decision: "needs_openai" };

/** Use Jev's draft only when confidence is high and no hedging is required. */
export function routeJevOutput(output: JevAssistantOutput): RouteDecision {
  const messageDraft = output.proposal.message_draft?.trim() ?? "";

  if (
    output.situation === "DECISION_FATIGUE" &&
    output.proposal.confidence >= 0.75 &&
    output.proposal.hedging_required === false &&
    messageDraft.length > 0
  ) {
    return { decision: "shortcut", message: messageDraft };
  }

  return { decision: "needs_openai" };
}
