import { describe, expect, it } from "vitest";

import { DecisionEngine } from "@/lib/decision-engine";
import type { CatalogState } from "@/lib/catalog-types";

describe("DecisionEngine", () => {
  it("does not create a predefined proposal when search results are empty", () => {
    const state: CatalogState = {
      categorySlug: "lodowki",
      query: "no-matching-product",
      filters: {},
      resultCount: 0,
      page: 1,
    };

    expect(DecisionEngine([], state, { categories: [], products: [] })).toBeNull();
  });
});