import { describe, expect, it } from "vitest";

import { JevAssistantResponseSchema } from "@/server/assistant-proposal/schema";
import { makeJevOutput } from "./fixtures";

describe("Jev System One response schema", () => {
  it("accepts typed situation and filter choices", () => {
    expect(JevAssistantResponseSchema.safeParse(makeJevOutput()).success).toBe(true);
  });

  it("rejects malformed choice answers and out-of-range confidence", () => {
    const output = makeJevOutput();
    expect(
      JevAssistantResponseSchema.safeParse({
        ...output,
        answers: {
          ...output.answers,
          situation: { ...output.answers.situation, confidence: 1.2 },
        },
      }).success,
    ).toBe(false);
    expect(
      JevAssistantResponseSchema.safeParse({ ...output, answers: { situation: output.answers.situation } }).success,
    ).toBe(false);
  });
});
