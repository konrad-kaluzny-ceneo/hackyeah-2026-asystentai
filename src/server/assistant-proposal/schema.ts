import { z } from "zod";
import { JevSituationSchema } from "@/lib/assistant-proposal-api";

const Probability = z.number().min(0).max(1);

export const JevChoiceAnswerSchema = z.object({
  type: z.literal("choice"),
  choice: z.string().trim().min(1).max(128),
  confidence: Probability,
  probabilities: z.record(z.string().max(128), Probability),
});

export const JevAssistantResponseSchema = z.object({
  model: z.string().trim().min(1).max(128),
  answers: z.object({
    situation: JevChoiceAnswerSchema,
    recommended_filter: JevChoiceAnswerSchema,
  }),
  usage: z.object({
    input_tokens: z.number().int().min(0),
    output_tokens: z.number().int().min(0),
  }),
});

export type JevChoiceAnswer = z.infer<typeof JevChoiceAnswerSchema>;
export type JevAssistantResponse = z.infer<typeof JevAssistantResponseSchema>;

export const JevProposalSchema = z.object({
  action_type: z.string().optional(),
  confidence: Probability,
  hedging_required: z.boolean(),
  message_draft: z.string().nullable().optional(),
  action_payload: z.record(z.string(), z.unknown()).optional(),
  reasoning: z.string().optional(),
});

export const JevAssistantOutputSchema = z.object({
  situation: JevSituationSchema,
  primary_meta_event: z.string().optional(),
  signal_strength: Probability.optional(),
  key_evidence: z.array(z.string()).optional(),
  user_context_summary: z.string().optional(),
  proposal: JevProposalSchema,
});

export type JevProposal = z.infer<typeof JevProposalSchema>;
export type JevAssistantOutput = z.infer<typeof JevAssistantOutputSchema>;

export function parseJevAssistantResponse(value: unknown): JevAssistantResponse {
  return JevAssistantResponseSchema.parse(value);
}
