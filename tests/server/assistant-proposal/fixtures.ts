import type { AssistantProposalRequest } from "@/lib/assistant-proposal-api";
import type { Category } from "@/lib/catalog-types";
import type { AssistantProposalContext } from "@/server/assistant-proposal/context";
import { parseJevAssistantResponse } from "@/server/assistant-proposal/schema";

export const requestBody: AssistantProposalRequest = {
  state: {
    categorySlug: "lodowki",
    query: "",
    filters: {},
    resultCount: 12,
    page: 1,
  },
  events: [
    {
      id: "event-1",
      timestamp: "2026-10-03T14:00:00.000Z",
      type: "product_view",
      categorySlug: "lodowki",
      productSlug: "lodowka-a",
      productId: "product-a",
      categoryId: "category-lodowki",
      brandId: "brand-a",
    },
    {
      id: "event-2",
      timestamp: "2026-10-03T14:01:00.000Z",
      type: "product_view",
      categorySlug: "lodowki",
      productSlug: "lodowka-b",
      productId: "product-b",
      categoryId: "category-lodowki",
      brandId: "brand-b",
    },
    {
      id: "event-3",
      timestamp: "2026-10-03T14:02:00.000Z",
      type: "product_view",
      categorySlug: "lodowki",
      productSlug: "lodowka-c",
      productId: "product-c",
      categoryId: "category-lodowki",
      brandId: "brand-c",
    },
    {
      id: "event-4",
      timestamp: "2026-10-03T14:03:00.000Z",
      type: "return_to_listing",
      categorySlug: "lodowki",
      categoryId: "category-lodowki",
    },
  ],
};

export const category: Category = {
  id: "category-lodowki",
  slug: "lodowki",
  name: "Lodówki",
  description: "Modele chłodziarko-zamrażarek.",
  imageUrl: "",
  specFilters: [
    {
      key: "capacityLiters",
      label: "Pojemność",
      unit: "l",
      kind: "range",
      min: 180,
      max: 500,
    },
    {
      key: "heightCm",
      label: "Wysokość",
      unit: "cm",
      kind: "range",
      min: 140,
      max: 205,
    },
  ],
};

export function makeContext(): AssistantProposalContext {
  return { request: requestBody, category, viewedProducts: [] };
}

export function makeJevOutput(overrides: {
  situation?: string;
  situationConfidence?: number;
  filter?: string;
  filterConfidence?: number;
} = {}) {
  return parseJevAssistantResponse({
    model: "jev-latest",
    answers: {
      situation: {
        type: "choice",
        choice: overrides.situation ?? "DECISION_FATIGUE",
        confidence: overrides.situationConfidence ?? 0.9,
        probabilities: { DECISION_FATIGUE: 0.9, OTHER: 0.1 },
      },
      recommended_filter: {
        type: "choice",
        choice: overrides.filter ?? "capacityLiters",
        confidence: overrides.filterConfidence ?? 0.9,
        probabilities: { capacityLiters: 0.9, heightCm: 0.1 },
      },
    },
    usage: { input_tokens: 80, output_tokens: 4 },
  });
}
