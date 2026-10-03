import type { JevAssistantOutput } from "./schema";

export type RouteDecision =
  | { decision: "generate_proposal" }
  | { decision: "hide" };

/** Only high-confidence decision fatigue reaches the local proposal stub. */
export function routeJevOutput(output: JevAssistantOutput): RouteDecision {
  if (
    output.situation === "DECISION_FATIGUE" &&
    output.proposal.confidence > 0.75
  ) {
    return { decision: "generate_proposal" };
  }

  return { decision: "hide" };
}
