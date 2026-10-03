import type { CategoryFilter, Product } from "@/lib/catalog-types";
import type { AssistantProposalContext } from "@/server/assistant-proposal/context";
import {
  parseJevAssistantResponse,
  type JevAssistantResponse,
} from "@/server/assistant-proposal/schema";

const TYPESAFE_API_URL = "https://api.typesafe.ai/v1/systemone";
const JEV_MODEL = "jev-latest";

export type JevChoiceQuestion = {
  readonly type: "choice";
  readonly instructions: string;
  readonly criteria: Readonly<Record<string, string>>;
};

export type JevSystemOneRequest = {
  readonly model: string;
  readonly state: {
    readonly currentCatalog: {
      readonly categorySlug: string;
      readonly categoryName: string;
      readonly resultCount: number;
      readonly page: number;
      readonly activeFilterKeys: readonly string[];
      readonly hasSearchQuery: boolean;
    };
    readonly recentCatalogEvents: readonly Record<string, unknown>[];
    readonly viewedProducts: readonly {
      readonly slug: string;
      readonly brand: string;
      readonly model: string;
      readonly price: number;
      readonly relevantSpecifications: Readonly<Record<string, string | number | boolean | null>>;
    }[];
  };
  readonly questions: {
    readonly situation: JevChoiceQuestion;
    readonly recommended_filter: JevChoiceQuestion;
  };
};

function describeFilter(filter: CategoryFilter): string {
  const unit = filter.unit ? ` ${filter.unit}` : "";
  if (filter.kind === "range") {
    return `${filter.label}${unit} (${filter.min}–${filter.max}${unit})`;
  }
  return `${filter.label}${unit} (możliwe wartości: ${filter.options?.join(", ") ?? ""})`;
}

function safeEventSummary(
  event: AssistantProposalContext["request"]["events"][number],
): Record<string, unknown> {
  switch (event.type) {
    case "product_view":
      return { type: event.type, categorySlug: event.categorySlug, productSlug: event.productSlug };
    case "listing_view":
    case "return_to_listing":
      return { type: event.type, categorySlug: event.categorySlug };
    case "search_changed":
      return { type: event.type, categorySlug: event.categorySlug, hasQuery: event.query.trim().length > 0 };
    case "filters_changed":
      return { type: event.type, categorySlug: event.categorySlug, filterKeys: Object.keys(event.filters) };
  }
}

function relevantSpecifications(
  product: Product,
  filters: readonly CategoryFilter[],
): Record<string, string | number | boolean | null> {
  return Object.fromEntries(
    filters.map(({ key }) => [key, product.specifications[key] ?? null]),
  );
}

export function buildJevRequest(context: AssistantProposalContext): JevSystemOneRequest | null {
  const { request, category, viewedProducts } = context;
  if (category === null || category.specFilters.length === 0) return null;

  const criteria = Object.fromEntries(
    category.specFilters.map((filter) => [filter.key, describeFilter(filter)]),
  );

  return {
    model: JEV_MODEL,
    state: {
      currentCatalog: {
        categorySlug: category.slug,
        categoryName: category.name,
        resultCount: request.state.resultCount,
        page: request.state.page,
        activeFilterKeys: Object.keys(request.state.filters),
        hasSearchQuery: request.state.query.trim().length > 0,
      },
      recentCatalogEvents: request.events.slice(-20).map(safeEventSummary),
      viewedProducts: viewedProducts.map((product) => ({
        slug: product.slug,
        brand: product.brand,
        model: product.model,
        price: product.price,
        relevantSpecifications: relevantSpecifications(product, category.specFilters),
      })),
    },
    questions: {
      situation: {
        type: "choice",
        instructions:
          "Classify whether this catalog session clearly shows decision fatigue: the shopper viewed several distinct similar products in one category and returned to the listing. Choose DECISION_FATIGUE only when the supplied events and product specifications support it.",
        criteria: {
          DECISION_FATIGUE: "Clear decision fatigue supported by several similar viewed products and a return to the category listing.",
          OTHER: "The events do not clearly support decision fatigue, or the shopper is browsing smoothly.",
        },
      },
      recommended_filter: {
        type: "choice",
        instructions:
          "Choose the single listed product specification that is most useful for narrowing this shopper's choice. Select one of the supplied keys only.",
        criteria,
      },
    },
  };
}

export function requestJev(
  request: JevSystemOneRequest,
  signal: AbortSignal,
): Promise<JevAssistantResponse>;
export function requestJev(
  prompt: string,
  signal?: AbortSignal,
): Promise<unknown>;
export async function requestJev(
  request: JevSystemOneRequest | string,
  signal?: AbortSignal,
): Promise<JevAssistantResponse | unknown> {
  const apiKey = process.env.TYPESAFE_API_KEY;
  if (apiKey === undefined || apiKey.trim().length === 0) {
    throw new Error("TYPESAFE_API_KEY is not configured");
  }

  if (typeof request === "string") {
    return requestJevPrompt(request, apiKey, signal);
  }

  logLine({
    action: "request_sent",
    model: request.model,
    catalogEventCount: request.state.recentCatalogEvents.length,
    viewedProductCount: request.state.viewedProducts.length,
    endpoint: TYPESAFE_API_URL,
  });

  let response: Response;
  try {
    response = await fetch(TYPESAFE_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(request),
      signal,
    });
  } catch (error) {
    logLine({ action: "request_failed", error: errorMessage(error) });
    throw error;
  }
  if (!response.ok) {
    logLine({
      action: "response_received",
      ok: false,
      status: response.status,
    });
    throw new Error(`TypeSafe returned HTTP ${response.status}`);
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch (error) {
    logLine({ action: "response_invalid", error: errorMessage(error) });
    throw new Error("TypeSafe returned invalid JSON");
  }

  try {
    const parsed = parseJevAssistantResponse(payload);
    logLine({
      action: "response_received",
      ok: true,
      status: response.status,
      model: parsed.model,
      situationChoice: parsed.answers.situation.choice,
      recommendedFilterChoice: parsed.answers.recommended_filter.choice,
      inputTokens: parsed.usage.input_tokens,
      outputTokens: parsed.usage.output_tokens,
    });
    return parsed;
  } catch (error) {
    logLine({ action: "response_invalid", error: errorMessage(error) });
    throw error;
  }
}

async function requestJevPrompt(
  prompt: string,
  apiKey: string,
  signal?: AbortSignal,
): Promise<unknown> {
  const response = await fetch(
    process.env.TYPESAFE_API_URL ?? "https://api.typesafe.ai/v1/chat/completions",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "x-api-key": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messages: [{ role: "user", content: prompt }],
        temperature: 0.1,
      }),
      signal,
    },
  );
  if (!response.ok) {
    throw new Error(`TypeSafe returned HTTP ${response.status}`);
  }

  const payload: unknown = await response.json();
  if (typeof payload !== "object" || payload === null) {
    throw new Error("Invalid response format from Jev API");
  }

  const candidate = payload as {
    choices?: Array<{ message?: { content?: unknown } }>;
    situation?: unknown;
    proposal?: unknown;
  };
  const content = candidate.choices?.[0]?.message?.content;
  if (typeof content === "string") {
    return JSON.parse(stripJsonFence(content));
  }
  if (typeof content === "object" && content !== null) {
    return content;
  }
  if ("situation" in candidate || "proposal" in candidate) {
    return payload;
  }
  throw new Error("Invalid response format from Jev API");
}

function stripJsonFence(value: string): string {
  const trimmed = value.trim();
  const match = /^```(?:json)?\s*([\s\S]*?)\s*```$/i.exec(trimmed);
  return match?.[1]?.trim() ?? trimmed;
}

function logLine(fields: Record<string, unknown>): void {
  console.log(JSON.stringify({ component: "jev-assistant", ...fields }));
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "unknown";
}
