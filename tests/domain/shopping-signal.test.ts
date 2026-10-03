import { describe, expect, it } from "vitest";

import { META_EVENT_NAMES } from "@/behavior/types";
import {
  SHOPPING_SIGNAL_KINDS,
  isShoppingSignalKind,
} from "@/domain/shopping-signal";

describe("shopping signal language", () => {
  it("names the five readings from the product rules", () => {
    expect(SHOPPING_SIGNAL_KINDS).toEqual([
      "brand",
      "uncertainty",
      "decision_fatigue",
      "weak_budget",
      "search_friction",
    ]);
  });

  it("does not reuse observation event names as shopping signals", () => {
    for (const name of META_EVENT_NAMES) {
      expect(isShoppingSignalKind(name)).toBe(false);
    }
    expect(isShoppingSignalKind("decision_fatigue")).toBe(true);
  });
});
