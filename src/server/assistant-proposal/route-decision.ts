import type { JevAssistantOutput } from "./schema";
import { JevSituationSchema, type JevSituation } from "@/lib/assistant-proposal-api";

export type RouteDecision =
  | { decision: "generate_proposal"; situation: JevSituation }
  | { decision: "hide" };

/** Any known Jev situation above the confidence threshold reaches the stub. */
export function routeJevOutput(output: JevAssistantOutput): RouteDecision {
  const situation = JevSituationSchema.safeParse(output.situation);
  if (!situation.success || output.proposal.confidence <= 0.75) {
    return { decision: "hide" };
  }

  return { decision: "generate_proposal", situation: situation.data };
}
