import { describe, expect, it } from "vitest";

import { routeJevOutput } from "@/server/assistant-proposal/route-decision";
import { makeJevOutput } from "./fixtures";

describe("routeJevOutput", () => {
  const filters = ["capacityLiters", "heightCm"];

  it("uses the local shortcut for a confident fatigue classification and known filter", () => {
    expect(routeJevOutput(makeJevOutput(), filters)).toEqual({
      kind: "shortcut",
      filterKey: "capacityLiters",
    });
  });

  it("routes low-confidence output to OpenAI", () => {
    expect(routeJevOutput(makeJevOutput({ situationConfidence: 0.74 }), filters)).toEqual({
      kind: "needs_openai",
    });
    expect(routeJevOutput(makeJevOutput({ filterConfidence: 0.74 }), filters)).toEqual({
      kind: "needs_openai",
    });
  });

  it("hides a different situation and escalates an unknown filter key", () => {
    expect(routeJevOutput(makeJevOutput({ situation: "OTHER" }), filters)).toEqual({ kind: "hide" });
    expect(routeJevOutput(makeJevOutput({ filter: "unsupported" }), filters)).toEqual({ kind: "needs_openai" });
  });
});
