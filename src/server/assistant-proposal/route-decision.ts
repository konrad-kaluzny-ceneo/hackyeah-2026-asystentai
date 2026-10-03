import type { JevAssistantResponse } from "@/server/assistant-proposal/schema";

export const JEV_SHORTCUT_CONFIDENCE = 0.75;

export type JevRouteDecision =
  | { readonly kind: "shortcut"; readonly filterKey: string }
  | { readonly kind: "needs_openai" }
  | { readonly kind: "hide" };

export function routeJevOutput(
  output: JevAssistantResponse,
  availableFilterKeys: readonly string[],
): JevRouteDecision {
  const { situation, recommended_filter: recommendedFilter } = output.answers;

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
