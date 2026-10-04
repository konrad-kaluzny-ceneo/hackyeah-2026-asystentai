import type { AssistantProposalResponse } from "@/lib/assistant-proposal-api";
import type { AssistantAction } from "@/lib/catalog-types";
import type { AssistantProposalIllustration } from "@/lib/assistant-proposal-api";
import type { MetaEvent } from "@/behavior/types";

import { mapJevActionToProposalAction } from "./actions";
import { requestJev } from "./jev-client";
import { requestStrongerReply } from "./openai-client";
import { routeJevOutput } from "./route-decision";
import { JevAssistantOutputSchema } from "./schema";
import { getLatestIntentSnapshot } from "@/server/intent-inference/read-service";

const HIDE_RESPONSE: AssistantProposalResponse = { status: "hide" };
const SHORTCUT_TITLE = "Pomóc zawęzić wybór?";
let openAIRequestInFlight = false;

const CATEGORY_RESEARCH_TIPS: Record<string, { title: string; message: string }> = {
  lodowki: {
    title: "Warto wiedzieć o lodówkach",
    message: "Klasa energetyczna to nie wszystko: porównaj też roczne zużycie prądu w kWh. Większa lodówka może zużywać więcej energii mimo tej samej klasy.",
  },
  pralki: {
    title: "Warto wiedzieć o pralkach",
    message: "Wsad w kilogramach oznacza masę suchego prania. Maksymalny wsad zależy też od programu: do wełny i tkanin delikatnych zwykle trzeba załadować mniej.",
  },
  zmywarki: {
    title: "Warto wiedzieć o zmywarkach",
    message: "Dłuższy program Eco nie musi zużywać więcej energii. Oszczędza ją dzięki niższej temperaturze, a dłuższy czas pomaga domyć naczynia.",
  },
};

export async function composeProposal(
  prompt: string,
  jevSignal: AbortSignal,
  requestSignal?: AbortSignal,
  metaEvents: readonly MetaEvent[] = [],
): Promise<AssistantProposalResponse> {
  if (requestSignal?.aborted) return HIDE_RESPONSE;
  const researchProposal = await categoryResearchProposal(metaEvents);
  if (requestSignal?.aborted) return HIDE_RESPONSE;
  if (researchProposal) return researchProposal;

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
    return fallbackProposal(mapped);
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
    if (requestSignal?.aborted) return HIDE_RESPONSE;
    logFailure("openai_request", error, "fallback_show");
    return fallbackProposal(mapped);
  } finally {
    openAIRequestInFlight = false;
  }
}

async function categoryResearchProposal(
  metaEvents: readonly MetaEvent[],
): Promise<AssistantProposalResponse | null> {
  const latestCategoryEvent = [...metaEvents]
    .sort((first, second) => second.detectedAt.localeCompare(first.detectedAt))
    .find((event) => event.subject?.categoryId);
  const categorySlug = latestCategoryEvent?.subject?.categoryId;
  if (!categorySlug || !Object.hasOwn(CATEGORY_RESEARCH_TIPS, categorySlug)) return null;
  const sessionId = latestCategoryEvent.identity.sessionId;
  if (metaEvents.some((event) => event.identity.sessionId !== sessionId)) return null;

  try {
    const snapshot = await getLatestIntentSnapshot(sessionId);
    if (!snapshot || snapshot.intents.researching < 0.5) return null;
    if (Object.entries(snapshot.intents).some(([intent, probability]) =>
      intent !== "researching" && probability >= snapshot.intents.researching,
    )) return null;

    const mapped = await mapJevActionToProposalAction({
      action_type: "EXPLAIN_CHOICE", confidence: snapshot.intents.researching,
      hedging_required: false,
    }, [latestCategoryEvent]);
    if (!mapped) return null;
    return {
      status: "show",
      ...CATEGORY_RESEARCH_TIPS[categorySlug],
      ...mapped,
      data: { ...mapped.data, illustration: "fox-thinking" },
    };
  } catch (error) {
    logFailure("research_intent", error, "continue_normal_flow");
    return null;
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

function logFailure(stage: string, error: unknown, action = "fallback_hide"): void {
  console.warn(
    JSON.stringify({
      component: "assistant-proposal",
      action,
      stage,
      error: error instanceof Error ? error.message : "unknown",
    }),
  );
}

