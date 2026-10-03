import { z } from "zod";

import { MetaEventSchema } from "@/behavior/meta-event-schema";

export const MAX_ASSISTANT_PROPOSAL_EVENTS = 10;

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

export const AssistantProposalRequestSchema = z
  .object({
    metaEvents: z
      .array(MetaEventSchema)
      .min(1)
      .max(MAX_ASSISTANT_PROPOSAL_EVENTS),
  })
  .strict();

export type AssistantProposalRequest = z.infer<
  typeof AssistantProposalRequestSchema
>;
