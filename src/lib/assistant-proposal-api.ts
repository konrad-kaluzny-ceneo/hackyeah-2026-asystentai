import { z } from "zod";
import { MetaEventSchema } from "@/behavior/meta-event-schema";

export const MAX_ASSISTANT_PROPOSAL_EVENTS = 10;

const NonEmptyId = z.string().trim().min(1).max(128);
const IsoDateString = z.string().refine((value) => !Number.isNaN(Date.parse(value)), {
  message: "expected ISO-8601 date string",
});

const EventBase = {
  id: NonEmptyId,
  timestamp: IsoDateString,
};

const CatalogEventSchema = z.discriminatedUnion("type", [
  z.object({
    ...EventBase,
    type: z.literal("listing_view"),
    categorySlug: NonEmptyId,
    categoryId: NonEmptyId,
  }).strict(),
  z.object({
    ...EventBase,
    type: z.literal("product_view"),
    categorySlug: NonEmptyId,
    productSlug: NonEmptyId,
    productId: NonEmptyId,
    categoryId: NonEmptyId,
    brandId: NonEmptyId,
  }).strict(),
  z.object({
    ...EventBase,
    type: z.literal("return_to_listing"),
    categorySlug: NonEmptyId,
    categoryId: NonEmptyId,
  }).strict(),
  z.object({
    ...EventBase,
    type: z.literal("search_changed"),
    categorySlug: NonEmptyId.nullable(),
    query: z.string().max(500),
  }).strict(),
  z.object({
    ...EventBase,
    type: z.literal("filters_changed"),
    categorySlug: NonEmptyId,
    filters: z.record(z.string().max(64), z.string().max(128)),
  }).strict(),
]);

export const CatalogAssistantProposalRequestSchema = z.object({
  state: z.object({
    categorySlug: NonEmptyId.nullable(),
    query: z.string().max(500),
    filters: z.record(z.string().max(64), z.string().max(128)),
    resultCount: z.number().int().min(0).max(100_000),
    page: z.number().int().min(1).max(100_000),
  }).strict(),
  events: z.array(CatalogEventSchema).max(100),
}).strict();

export const MetaEventsAssistantProposalRequestSchema = z.object({
  metaEvents: z.array(MetaEventSchema).min(1).max(MAX_ASSISTANT_PROPOSAL_EVENTS),
}).strict();

export const AssistantProposalRequestSchema = z.union([
  CatalogAssistantProposalRequestSchema,
  MetaEventsAssistantProposalRequestSchema,
]);

export type CatalogAssistantProposalRequest = z.infer<
  typeof CatalogAssistantProposalRequestSchema
>;
export type MetaEventsAssistantProposalRequest = z.infer<
  typeof MetaEventsAssistantProposalRequestSchema
>;
export type AssistantProposalRequest = CatalogAssistantProposalRequest;

export const AssistantProposalResponseSchema = z.discriminatedUnion("status", [
  z.object({
    status: z.literal("show"),
    kind: z.literal("decision_fatigue"),
    title: z.string().trim().min(1).max(160),
    message: z.string().trim().min(1).max(500),
    action: z.literal("narrow-choice"),
    actionLabel: z.string().trim().min(1).max(160),
  }).strict(),
  z.object({ status: z.literal("hide") }).strict(),
]);

export type AssistantProposalResponse = z.infer<typeof AssistantProposalResponseSchema>;

export function parseAssistantProposalResponse(value: unknown): AssistantProposalResponse {
  return AssistantProposalResponseSchema.parse(value);
}

export function safeParseAssistantProposalResponse(value: unknown) {
  return AssistantProposalResponseSchema.safeParse(value);
}
