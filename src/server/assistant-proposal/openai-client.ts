import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { z } from "zod";

import {
  MAX_ASSISTANT_PROPOSAL_MESSAGE_LENGTH,
  MAX_ASSISTANT_PROPOSAL_TITLE_LENGTH,
} from "@/lib/assistant-proposal-api";
import type { JevAssistantOutput } from "./schema";

export const DEFAULT_OPENAI_MODEL = "gpt-5.6-luna";
export const OPENAI_TIMEOUT_MS = 5000;

const StrongerReplySchema = z.object({
  title: z.string().trim().min(1).max(MAX_ASSISTANT_PROPOSAL_TITLE_LENGTH),
  message: z.string().trim().min(1).max(MAX_ASSISTANT_PROPOSAL_MESSAGE_LENGTH),
}).strict();

export type StrongerReply = z.infer<typeof StrongerReplySchema>;

export async function requestStrongerReply(
  jevOutput: JevAssistantOutput,
  signal?: AbortSignal,
): Promise<StrongerReply> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("Missing OPENAI_API_KEY environment variable");
  }

  const requestSignal = AbortSignal.any([
    AbortSignal.timeout(OPENAI_TIMEOUT_MS),
    ...(signal ? [signal] : []),
  ]);
  const client = new OpenAI({
    apiKey,
    maxRetries: 0,
    timeout: OPENAI_TIMEOUT_MS,
  });
  const response = await client.responses.parse(
    {
      model: process.env.OPENAI_MODEL || DEFAULT_OPENAI_MODEL,
      instructions: `Na podstawie zwalidowanego wyniku analizy Jev napisz jedną krótką propozycję po polsku dla kupującego.
    Zwróć naturalny tytuł (maksymalnie ${MAX_ASSISTANT_PROPOSAL_TITLE_LENGTH} znaków) oraz jedno zdanie wiadomości (maksymalnie ${MAX_ASSISTANT_PROPOSAL_MESSAGE_LENGTH} znaków). Nie zmieniaj klasyfikacji ani nie wymyślaj faktów spoza wyniku Jev.
Zwróć wyłącznie obiekt JSON z polami title i message. Nie zwracaj akcji, etykiety przycisku, danych filtrów, uzasadnienia ani dodatkowego tekstu.`,
      input: JSON.stringify(jevOutput),
      text: {
        format: zodTextFormat(StrongerReplySchema, "assistant_proposal"),
      },
    },
    {
      signal: requestSignal,
    },
  );

  if (response.output_parsed === null) {
    throw new Error("OpenAI returned no structured assistant proposal");
  }

  return StrongerReplySchema.parse(response.output_parsed);
}