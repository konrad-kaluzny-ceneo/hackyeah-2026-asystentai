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
    title: "Pomóc zawęzić wybór?",
    message:
      "Wybierzmy jeden parametr, na przykład pojemność, aby szybciej zawęzić wyniki.",
  };
}
