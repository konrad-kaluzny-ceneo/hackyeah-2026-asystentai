import type { JevAssistantOutput } from "./schema";

export type RouteDecision =
  | { decision: "shortcut"; message: string }
  | { decision: "needs_openai" }
  | { decision: "hide" };

export const INTENT_TRIGGER_THRESHOLD = 0.9;
const CALM_INTENTS = new Set(["exploring", "SMOOTH_EXPLORATION"]);

/** Combined non-calm JEV intent probability activates the assistant response flow. */
export function routeJevOutput(output: JevAssistantOutput): RouteDecision {
  const message = output.proposal.message_draft?.trim() ?? "";
  const nonCalmIntentProbability = Object.entries(
    output.intent_probabilities,
  ).reduce(
    (total, [intent, probability]) =>
      CALM_INTENTS.has(intent) ? total : total + probability,
    0,
  );
  const hasStrongIntent =
    nonCalmIntentProbability > INTENT_TRIGGER_THRESHOLD;

  if (
    !hasStrongIntent ||
    (output.proposal.action_type === "DO_NOTHING" &&
      output.situation === "SMOOTH_EXPLORATION")
  ) {
    return { decision: "hide" };
  }

  if (
    output.situation === "DECISION_FATIGUE" &&
    output.proposal.action_type === "NARROW_BY_SPEC" &&
    output.proposal.hedging_required === false &&
    message.length > 0
  ) {
    return { decision: "shortcut", message };
  }

  if (
    output.situation === "UI_FRICTION" &&
    output.proposal.action_type === "RESET_FILTERS" &&
    output.proposal.hedging_required === false &&
    message.length > 0
  ) {
    return { decision: "shortcut", message };
  }

  return { decision: "needs_openai" };
}
