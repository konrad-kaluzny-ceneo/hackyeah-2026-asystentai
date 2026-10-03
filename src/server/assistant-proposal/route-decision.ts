import type {
  JevAssistantOutput,
  JevAssistantResponse,
} from "@/server/assistant-proposal/schema";

export const JEV_SHORTCUT_CONFIDENCE = 0.75;

export type JevRouteDecision =
  | { readonly kind: "shortcut"; readonly filterKey: string }
  | { readonly kind: "needs_openai" }
  | { readonly kind: "hide" };

export type RouteDecision =
  | { readonly decision: "generate_proposal" }
  | { readonly decision: "hide" };

export function routeJevOutput(output: JevAssistantOutput): RouteDecision;
export function routeJevOutput(
  output: JevAssistantResponse,
  availableFilterKeys: readonly string[],
): JevRouteDecision;

export function routeJevOutput(
  output: JevAssistantResponse | JevAssistantOutput,
  availableFilterKeys?: readonly string[],
): JevRouteDecision | RouteDecision {
  if (availableFilterKeys === undefined) {
    const metaEventOutput = output as JevAssistantOutput;
    return metaEventOutput.situation === "DECISION_FATIGUE" &&
      metaEventOutput.proposal.confidence > JEV_SHORTCUT_CONFIDENCE
      ? { decision: "generate_proposal" }
      : { decision: "hide" };
  }

  const systemOneOutput = output as JevAssistantResponse;
  const { situation, recommended_filter: recommendedFilter } = systemOneOutput.answers;

  if (situation.choice !== "DECISION_FATIGUE") {
    return { kind: "hide" };
  }

  if (
    situation.confidence < JEV_SHORTCUT_CONFIDENCE ||
    recommendedFilter.confidence < JEV_SHORTCUT_CONFIDENCE
  ) {
    return { kind: "needs_openai" };
  }

  if (!availableFilterKeys.includes(recommendedFilter.choice)) {
    return { kind: "needs_openai" };
  }

  return { kind: "shortcut", filterKey: recommendedFilter.choice };
}
