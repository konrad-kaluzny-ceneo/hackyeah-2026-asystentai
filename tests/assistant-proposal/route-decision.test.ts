import { describe, expect, it } from "vitest";

import { routeJevOutput } from "@/server/assistant-proposal/route-decision";
import type { JevAssistantOutput } from "@/server/assistant-proposal/schema";
import type { JevSituation } from "@/lib/assistant-proposal-api";

function output(
  situation: JevSituation,
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
      situation: "DECISION_FATIGUE",
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

  it("routes a recognized non-fatigue situation above 0.75", () => {
    expect(routeJevOutput(output("PRODUCT_HESITATION", 0.95))).toEqual({
      decision: "generate_proposal",
      situation: "PRODUCT_HESITATION",
    });
  });

  it("hides unknown situations even when confidence is high", () => {
    expect(routeJevOutput(output("UNKNOWN" as JevSituation, 0.95))).toEqual({
      decision: "hide",
    });
  });
});
