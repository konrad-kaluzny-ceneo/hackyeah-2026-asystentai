import { z } from "zod";

export const JevProposalSchema = z.object({
  action_type: z.string().optional(),
  confidence: z.number().min(0).max(1),
  hedging_required: z.boolean(),
  message_draft: z.string().nullable().optional(),
  action_payload: z.record(z.string(), z.unknown()).optional(),
  reasoning: z.string().optional(),
});

export const JevAssistantOutputSchema = z.object({
  situation: z.string(),
  primary_meta_event: z.string().optional(),
  signal_strength: z.number().min(0).max(1).optional(),
  key_evidence: z.array(z.string()).optional(),
  user_context_summary: z.string().optional(),
  proposal: JevProposalSchema,
});

export type JevProposal = z.infer<typeof JevProposalSchema>;
export type JevAssistantOutput = z.infer<typeof JevAssistantOutputSchema>;
