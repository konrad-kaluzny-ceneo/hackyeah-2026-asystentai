import type { JevAssistantOutput } from "./schema";

export type AssistantDraft = Readonly<{
  title: string;
  message: string;
}>;

/**
 * Deterministic stand-in for the future S-04 OpenAI client.
 * Replace this local implementation with a model call in a later slice.
 */
export async function generateProposalWithOpenAiStub(
  jevOutput: JevAssistantOutput,
): Promise<AssistantDraft> {
  void jevOutput;
  return {
    title: "Mogę podpowiedzieć następny krok",
    message:
      "To demonstracyjna podpowiedź na podstawie ostatnich sygnałów z przeglądania.",
  };
}
