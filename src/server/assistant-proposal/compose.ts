import type { AssistantProposalResponse } from "@/lib/assistant-proposal-api";
import type { AssistantAction } from "@/lib/catalog-types";
import type { AssistantProposalIllustration } from "@/lib/assistant-proposal-api";
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

  const effectiveJev = normalizeNoOpProposal(parsedJev.data);
  const mapped = await mapJevActionToProposalAction(
    effectiveJev.proposal,
    metaEvents,
  );
  if (!mapped) {
    return HIDE_RESPONSE;
  }

  const defaultIllustration = illustrationForAction(mapped.action);

  if (decision.decision === "shortcut") {
    return {
      status: "show",
      title: SHORTCUT_TITLE,
      message: decision.message,
      action: mapped.action,
      actionLabel: mapped.actionLabel,
      data: { ...mapped.data, illustration: defaultIllustration },
    };
  }

  if (openAIRequestInFlight) {
    return HIDE_RESPONSE;
  }

  openAIRequestInFlight = true;
  try {
    const reply = await requestStrongerReply(effectiveJev, requestSignal);
    if (reply.action !== mapped.action || reply.action === "none") {
      return fallbackProposal(mapped);
    }
    return {
      status: "show",
      ...reply,
      action: mapped.action,
      actionLabel: mapped.actionLabel,
      data: {
        ...mapped.data,
        illustration: reply.data.illustration ?? defaultIllustration,
      },
    };
  } catch (error) {
    if (isAbortError(error)) {
      return fallbackProposal(mapped);
    }
    logFailure("openai_request", error);
    rethrowInDevelopment(error);
    return fallbackProposal(mapped);
  } finally {
    openAIRequestInFlight = false;
  }
}

function normalizeNoOpProposal(
  jevOutput: Awaited<ReturnType<typeof JevAssistantOutputSchema.parse>>,
): Awaited<ReturnType<typeof JevAssistantOutputSchema.parse>> {
  if (jevOutput.proposal.action_type !== "DO_NOTHING") return jevOutput;

  return {
    ...jevOutput,
    proposal: {
      ...jevOutput.proposal,
      action_type: "EXPLAIN_CHOICE",
      hedging_required: true,
      message_draft: null,
    },
  };
}

function fallbackProposal(
  mapped: NonNullable<Awaited<ReturnType<typeof mapJevActionToProposalAction>>>,
): AssistantProposalResponse {
  return {
    status: "show",
    title: "Mam dla Ciebie podpowiedź",
    message: fallbackMessageForAction(mapped.action),
    action: mapped.action,
    actionLabel: mapped.actionLabel,
    data: {
      ...mapped.data,
      illustration: illustrationForAction(mapped.action),
    },
  };
}

function fallbackMessageForAction(action: AssistantAction): string {
  switch (action) {
    case "set-budget":
      return "Określ przedział ceny, aby skupić się na urządzeniach w swoim budżecie.";
    case "choose-brand":
      return "Jeśli masz preferowanego producenta, wybierz go w filtrze i zawęź listę modeli.";
    case "browse-category":
      return "Wróć do listy modeli w tej kategorii, aby znaleźć inne dostępne opcje.";
    case "narrow-choice":
      return "Warto zawęzić wyniki według jednego ważnego parametru, żeby łatwiej wybrać.";
    case "clear-search-and-filters":
      return "Wyczyszczenie obecnych filtrów może odblokować listę produktów.";
    case "go-to-product":
      return "Ten produkt wygląda jak dobry następny krok do dokładniejszego sprawdzenia.";
    case "sort-by-price":
      return "Sortowanie po cenie pomoże szybciej uporządkować dostępne opcje.";
    case "explain-choice":
      return "Wybierz jeden najważniejszy parametr, a łatwiej rozstrzygniesz między podobnymi modelami.";
    case "none":
      return "Zatrzymajmy się przy najważniejszym kryterium wyboru.";
  }
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && /aborted|timeout/i.test(error.message);
}

function illustrationForAction(action: AssistantAction): AssistantProposalIllustration {
  switch (action) {
    case "set-budget":
    case "choose-brand":
    case "browse-category":
    case "narrow-choice":
    case "clear-search-and-filters":
    case "go-to-product":
    case "sort-by-price":
      return "fox-guiding";
    case "explain-choice":
      return "fox-thinking";
    case "none":
      return "fox-thinking";
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

