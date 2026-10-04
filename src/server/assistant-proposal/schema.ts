import { z } from "zod";

export const JEV_ACTION_TYPES = [
  "NARROW_BY_SPEC",
  "COMPARE_MODELS",
  "RESET_FILTERS",
  "GO_TO_PRODUCT",
  "SORT_BY_PRICE",
  "SET_BUDGET",
  "CHOOSE_BRAND",
  "BROWSE_CATEGORY",
  "EXPLAIN_CHOICE",
  "DO_NOTHING",
] as const;

export const JevActionPayloadSchema = z
  .object({
    filterKeys: z.array(z.string()).optional(),
    productSlug: z.string().min(1).optional(),
    sort: z.enum(["price_asc", "price_desc"]).optional(),
  })
  .strict();

export const JevProposalSchema = z.object({
  action_type: z.enum(JEV_ACTION_TYPES).optional(),
  confidence: z.number().min(0).max(1),
  hedging_required: z.boolean(),
  message_draft: z.string().nullable().optional(),
  action_payload: JevActionPayloadSchema.optional(),
  reasoning: z.string().optional(),
});

export const JevAssistantOutputSchema = z.object({
  situation: z.string(),
  intent_probabilities: z.record(z.string(), z.number().min(0).max(1)),
  primary_meta_event: z.string().optional(),
  signal_strength: z.number().min(0).max(1).optional(),
  key_evidence: z.array(z.string()).optional(),
  user_context_summary: z.string().optional(),
  proposal: JevProposalSchema,
});

export type JevProposal = z.infer<typeof JevProposalSchema>;
export type JevAssistantOutput = z.infer<typeof JevAssistantOutputSchema>;
