import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { z } from "zod";

import {
  ASSISTANT_PROPOSAL_ACTIONS,
  ASSISTANT_PROPOSAL_SORTS,
  MAX_ASSISTANT_PROPOSAL_ACTION_LABEL_LENGTH,
  MAX_ASSISTANT_PROPOSAL_MESSAGE_LENGTH,
  MAX_ASSISTANT_PROPOSAL_TITLE_LENGTH,
} from "@/lib/assistant-proposal-api";
import type { JevAssistantOutput } from "./schema";

export const DEFAULT_OPENAI_MODEL = "gpt-5.6-luna";
export const OPENAI_TIMEOUT_MS = 5000;

const StrongerReplySchema = z.object({
  title: z.string().trim().min(1).max(MAX_ASSISTANT_PROPOSAL_TITLE_LENGTH),
  message: z.string().trim().min(1).max(MAX_ASSISTANT_PROPOSAL_MESSAGE_LENGTH),
  action: z.enum(ASSISTANT_PROPOSAL_ACTIONS),
  actionLabel: z
    .string()
    .trim()
    .min(1)
    .max(MAX_ASSISTANT_PROPOSAL_ACTION_LABEL_LENGTH),
  data: z
    .object({
      target: z.enum(["filters", "catalog", "product"]),
      filterKeys: z.array(z.string()),
      productSlug: z.string().min(1).nullable(),
      categorySlug: z.string().min(1).nullable(),
      sort: z.enum(ASSISTANT_PROPOSAL_SORTS).nullable(),
    })
    .strict(),
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
      instructions: `Na podstawie zwalidowanego wyniku analizy Jev napisz JEDNĄ krótką propozycję po polsku dla kupującego.

Wybierz DOKŁADNIE JEDNĄ akcję z przekazanego przez Jev wyboru (proposal.action_type). Nie zmieniaj jej na inną.

Dostępne wartości action i wymagania:
- narrow-choice: przycisk prowadzi do filtrów; data.target="filters", data.filterKeys z action_payload.
- clear-search-and-filters: przycisk czyści wyszukiwanie i filtry; data.target="catalog".
- go-to-product: Link do /produkt/<productSlug>; data.target="product", data.productSlug z action_payload.
- sort-by-price: sortowanie listy; data.target="catalog", data.sort z action_payload.
- explain-choice: tylko treść, bez nawigacji; data.target="catalog".
- none: nie pokazuj przycisku; data.target="catalog".

W data.categorySlug wpisz kategorię z kontekstu zdarzeń, jeśli jest znana. Jeśli nie jest potrzebna, zwróć null. Pola productSlug, categorySlug i sort muszą być obecne; użyj null, gdy nie dotyczą wybranej akcji.

Zwróć naturalny tytuł (max ${MAX_ASSISTANT_PROPOSAL_TITLE_LENGTH} znaków), jedno zdanie wiadomości (max ${MAX_ASSISTANT_PROPOSAL_MESSAGE_LENGTH} znaków) oraz krótką etykietę przycisku (max ${MAX_ASSISTANT_PROPOSAL_ACTION_LABEL_LENGTH} znaków). Nie wymyślaj faktów spoza wyniku Jev.
Zwróć wyłącznie obiekt JSON z polami title, message, action, actionLabel, data.`,
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