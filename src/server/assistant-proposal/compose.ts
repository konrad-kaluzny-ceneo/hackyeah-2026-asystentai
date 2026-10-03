import type { AssistantProposalResponse } from "@/lib/assistant-proposal-api";
import type { MetaEvent } from "@/behavior/types";

import { mapJevActionToProposalAction } from "./actions";
import { requestJev } from "./jev-client";
import { requestStrongerReply } from "./openai-client";
import { routeJevOutput } from "./route-decision";
import { JevAssistantOutputSchema } from "./schema";

const HIDE_RESPONSE: AssistantProposalResponse = { status: "hide" };
const SHORTCUT_TITLE = "Pomóc zawęzić wybór?";
let openAIRequestInFlight = false;

export async function composeProposal(
  prompt: string,
  jevSignal: AbortSignal,
  requestSignal?: AbortSignal,
  metaEvents: readonly MetaEvent[] = [],
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
  if (decision.decision === "hide") {
    return HIDE_RESPONSE;
  }

  const mapped = await mapJevActionToProposalAction(
    parsedJev.data.proposal,
    metaEvents,
  );
  if (!mapped) {
    return HIDE_RESPONSE;
  }

  if (decision.decision === "shortcut") {
    return {
      status: "show",
      title: SHORTCUT_TITLE,
      message: decision.message,
      action: mapped.action,
      actionLabel:
        mapped.action === "narrow-choice"
          ? "Przejdź do filtrów"
          : mapped.action === "clear-search-and-filters"
            ? "Wyczyść wyszukiwanie i filtry"
            : mapped.action === "go-to-product"
              ? "Otwórz produkt"
              : mapped.action === "sort-by-price"
                ? "Posortuj po cenie"
                : "Pokaż wskazówkę",
      data: mapped.data,
    };
  }

  if (openAIRequestInFlight) {
    return HIDE_RESPONSE;
  }

  openAIRequestInFlight = true;
  try {
    const reply = await requestStrongerReply(parsedJev.data, requestSignal);
    return { status: "show", ...reply, data: mapped.data };
  } catch (error) {
    logFailure("openai_request", error);
    rethrowInDevelopment(error);
    return HIDE_RESPONSE;
  } finally {
    openAIRequestInFlight = false;
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

