import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { z } from "zod";

import {
  AssistantActionDataSchema,
  AssistantActionSchema,
} from "@/lib/assistant-proposal-api";
import type { CategoryFilter } from "@/lib/catalog-types";
import type { JevAssistantOutput } from "./schema";

export const DEFAULT_OPENAI_MODEL = "gpt-5.6-luna";
export const OPENAI_TIMEOUT_MS = 5000;

const StrongerReplySchema = z.object({
  action: AssistantActionSchema,
  data: AssistantActionDataSchema,
});

export type StrongerReply = z.infer<typeof StrongerReplySchema>;

export async function requestStrongerReply(
  jevOutput: JevAssistantOutput,
  availableFilters: readonly CategoryFilter[] = [],
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
  const availableFilterKeys = availableFilters.map((filter) => filter.key);
  const response = await client.responses.parse(
    {
      model: process.env.OPENAI_MODEL || DEFAULT_OPENAI_MODEL,
      instructions: `Wybierz dokładnie jedną akcję, którą aplikacja może wykonać na podstawie zwalidowanego wyniku analizy Jev:
- "narrow-choice" gdy użytkownik powinien przejść do filtrów;
- "clear-search-and-filters" gdy aktywne ograniczenia mogą blokować użytkownika.
Zwróć data.target jako "filters" dla narrow-choice albo "catalog" dla clear-search-and-filters.
Dostępne filtry kategorii: ${availableFilters.length > 0 ? JSON.stringify(availableFilters) : "brak"}.
Dozwolone klucze filtrów: ${availableFilterKeys.length > 0 ? availableFilterKeys.join(", ") : "brak"}.
Zwróć data.filterKeys jako tablicę maksymalnie trzech kluczy wyłącznie z tej listy; użyj pustej tablicy, jeśli nie da się wskazać konkretnego klucza.
  Zwróć wyłącznie obiekt JSON z polami action i data, bez tytułu, wiadomości, etykiety, uzasadnienia ani dodatkowego tekstu.`,
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