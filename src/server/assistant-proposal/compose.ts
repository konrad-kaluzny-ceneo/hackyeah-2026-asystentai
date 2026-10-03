import type { AssistantProposalResponse } from "@/lib/assistant-proposal-api";
import type { CategoryFilter } from "@/lib/catalog-types";

import { requestJev } from "./jev-client";
import {
  requestStrongerReply,
  type StrongerReply,
} from "./openai-client";
import { routeJevOutput } from "./route-decision";
import { JevAssistantOutputSchema } from "./schema";

const HIDE_RESPONSE: AssistantProposalResponse = { status: "hide" };

export async function composeProposal(
  prompt: string,
  jevSignal: AbortSignal,
  availableFilters: readonly CategoryFilter[] = [],
  requestSignal?: AbortSignal,
): Promise<AssistantProposalResponse> {
  let rawJevOutput: unknown;
  try {
    rawJevOutput = await requestJev(prompt, jevSignal);
  } catch (error) {
    logFailure("jev_request", error);
    rethrowInDevelopment(error);
    return HIDE_RESPONSE;
  }

  const parsedJev = JevAssistantOutputSchema.safeParse(rawJevOutput);
  if (!parsedJev.success) {
    logFailure("jev_schema", parsedJev.error);
    rethrowInDevelopment(parsedJev.error);
    return HIDE_RESPONSE;
  }

  const decision = routeJevOutput(parsedJev.data);
  if (decision.decision === "shortcut") {
    return {
      status: "show",
      action: "narrow-choice",
      data: { target: "filters", filterKeys: [] },
    };
  }

  try {
    const reply = await requestStrongerReply(
      parsedJev.data,
      availableFilters,
      requestSignal,
    );
    return toProposalResponse(reply, availableFilters);
  } catch (error) {
    logFailure("openai_request", error);
    rethrowInDevelopment(error);
    return HIDE_RESPONSE;
  }
}

function rethrowInDevelopment(error: unknown): void {
  if (process.env.NODE_ENV === "development") {
    throw error;
  }
}

function logFailure(stage: string, error: unknown): void {
  console.warn(
    JSON.stringify({
      component: "assistant-proposal",
      action: "fallback_hide",
      stage,
      error: error instanceof Error ? error.message : "unknown",
    }),
  );
}

function toProposalResponse(
  reply: StrongerReply,
  availableFilters: readonly CategoryFilter[],
): AssistantProposalResponse {
  const allowedFilterKeys = new Set(
    availableFilters.map((filter) => filter.key),
  );
  const filterKeys = reply.data.filterKeys.filter((key) =>
    allowedFilterKeys.has(key),
  );

  return {
    status: "show",
    action: reply.action,
    data: { ...reply.data, filterKeys },
  };
}