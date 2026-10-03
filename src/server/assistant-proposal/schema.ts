import { z } from "zod";

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

export function parseJevAssistantResponse(value: unknown): JevAssistantResponse {
  return JevAssistantResponseSchema.parse(value);
}
