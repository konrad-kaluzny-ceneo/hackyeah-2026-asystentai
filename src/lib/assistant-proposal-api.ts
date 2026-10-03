import { z } from "zod";

import { MetaEventSchema } from "@/behavior/meta-event-schema";

export const MAX_ASSISTANT_PROPOSAL_EVENTS = 10;

// ============================================================================
// Response Contract (context/changes/assistant-proposal-box/interface.md)
// ============================================================================

export const AssistantProposalShowSchema = z.object({
  status: z.literal("show"),
  title: z.string().trim().min(1),
  message: z.string().trim().min(1),
}).strict();

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
