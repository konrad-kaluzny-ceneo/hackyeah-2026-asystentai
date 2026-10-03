import { describe, expect, it } from "vitest";

import { routeJevOutput } from "@/server/assistant-proposal/route-decision";
import type { JevAssistantOutput } from "@/server/assistant-proposal/schema";

function output(
  situation: string,
  confidence: number,
): JevAssistantOutput {
  return {
    situation,
    proposal: {
      confidence,
      hedging_required: true,
      message_draft: null,
    },
  };
}

describe("routeJevOutput", () => {
  it("routes decision fatigue above 0.75 to the proposal stub", () => {
    expect(routeJevOutput(output("DECISION_FATIGUE", 0.76))).toEqual({
      decision: "generate_proposal",
    });
  });

  it("hides at exactly 0.75", () => {
    expect(routeJevOutput(output("DECISION_FATIGUE", 0.75))).toEqual({
      decision: "hide",
    });
  });

  it("hides below 0.75", () => {
    expect(routeJevOutput(output("DECISION_FATIGUE", 0.74))).toEqual({
      decision: "hide",
    });
  });

  it("hides other situations even when confidence is high", () => {
    expect(routeJevOutput(output("PRODUCT_HESITATION", 0.95))).toEqual({
      decision: "hide",
    });
  });
});
