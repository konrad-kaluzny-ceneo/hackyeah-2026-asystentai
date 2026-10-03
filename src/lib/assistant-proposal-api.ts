import { z } from "zod";

import type { CatalogEvent, CatalogState } from "@/lib/catalog-types";

// ============================================================================
// Response Contract (context/changes/assistant-proposal-box/interface.md)
// ============================================================================

export const ASSISTANT_ACTIONS = [
  "narrow-choice",
  "clear-search-and-filters",
] as const;

export const AssistantActionSchema = z.enum(ASSISTANT_ACTIONS);

export const AssistantActionDataSchema = z.object({
  target: z.enum(["filters", "catalog"]),
  filterKeys: z.array(z.string().min(1)).max(3),
});

export type AssistantAction = z.infer<typeof AssistantActionSchema>;
export type AssistantActionData = z.infer<typeof AssistantActionDataSchema>;

export const AssistantProposalShowSchema = z.object({
  status: z.literal("show"),
  action: AssistantActionSchema,
  data: AssistantActionDataSchema,
});

export const AssistantProposalHideSchema = z.object({
  status: z.literal("hide"),
});

export const AssistantProposalResponseSchema = z.discriminatedUnion("status", [
  AssistantProposalShowSchema,
  AssistantProposalHideSchema,
]);

export type AssistantProposalResponse = z.infer<
  typeof AssistantProposalResponseSchema
>;

export function parseAssistantProposalResponse(
  data: unknown,
): AssistantProposalResponse {
  return AssistantProposalResponseSchema.parse(data);
}

export function safeParseAssistantProposalResponse(data: unknown) {
  return AssistantProposalResponseSchema.safeParse(data);
}

// ============================================================================
// Request Contract (context/changes/assistant-proposal-box/interface.md)
// ============================================================================

export const CatalogStateSchema = z.object({
  categorySlug: z.string().nullable(),
  query: z.string(),
  filters: z.record(z.string(), z.string()),
  resultCount: z.number().int().min(0),
  page: z.number().int().min(1),
});

const EventBaseSchema = z.object({
  id: z.string().min(1),
  timestamp: z.string().min(1),
});

export const ListingViewEventSchema = EventBaseSchema.extend({
  type: z.literal("listing_view"),
  categorySlug: z.string(),
  categoryId: z.string(),
});

export const ProductViewEventSchema = EventBaseSchema.extend({
  type: z.literal("product_view"),
  categorySlug: z.string(),
  productSlug: z.string(),
  productId: z.string(),
  categoryId: z.string(),
  brandId: z.string(),
});

export const ReturnToListingEventSchema = EventBaseSchema.extend({
  type: z.literal("return_to_listing"),
  categorySlug: z.string(),
  categoryId: z.string(),
});

export const SearchChangedEventSchema = EventBaseSchema.extend({
  type: z.literal("search_changed"),
  categorySlug: z.string().nullable(),
  query: z.string(),
});

export const FiltersChangedEventSchema = EventBaseSchema.extend({
  type: z.literal("filters_changed"),
  categorySlug: z.string(),
  filters: z.record(z.string(), z.string()),
});

export const CatalogEventSchema = z.discriminatedUnion("type", [
  ListingViewEventSchema,
  ProductViewEventSchema,
  ReturnToListingEventSchema,
  SearchChangedEventSchema,
  FiltersChangedEventSchema,
]);

export const AssistantProposalRequestSchema = z.object({
  state: CatalogStateSchema,
  events: z.array(CatalogEventSchema),
});

export type AssistantProposalRequest = {
  state: CatalogState;
  events: CatalogEvent[];
};
