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

export async function requestJev(
  request: JevSystemOneRequest,
  signal: AbortSignal,
): Promise<JevAssistantResponse> {
  const apiKey = process.env.TYPESAFE_API_KEY;
  if (apiKey === undefined || apiKey.trim().length === 0) {
    throw new Error("TYPESAFE_API_KEY is not configured");
  }

  const response = await fetch(TYPESAFE_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(request),
    signal,
  });
  if (!response.ok) {
    throw new Error(`TypeSafe returned HTTP ${response.status}`);
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new Error("TypeSafe returned invalid JSON");
  }

  return parseJevAssistantResponse(payload);
}
