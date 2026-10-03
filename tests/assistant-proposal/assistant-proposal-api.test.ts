import { describe, expect, it } from "vitest";

import {
  AssistantProposalRequestSchema,
  parseAssistantProposalResponse,
  safeParseAssistantProposalResponse,
} from "@/lib/assistant-proposal-api";

describe("assistant-proposal-api contract", () => {
  describe("AssistantProposalResponseSchema", () => {
    it("accepts a valid 'show' response with action data", () => {
      const payload = {
        status: "show",
        action: "narrow-choice",
        data: { target: "filters", filterKeys: ["capacity"] },
      };

      const parsed = parseAssistantProposalResponse(payload);
      expect(parsed).toEqual(payload);
    });

    it("rejects 'show' with invalid action data", () => {
      const badAction = {
        status: "show",
        action: "other-action",
        data: { target: "filters", filterKeys: [] },
      };

      const badTarget = {
        status: "show",
        action: "narrow-choice",
        data: { target: "unknown", filterKeys: [] },
      };

      expect(safeParseAssistantProposalResponse(badAction).success).toBe(false);
      expect(safeParseAssistantProposalResponse(badTarget).success).toBe(false);
    });

    it("accepts a valid 'hide' response", () => {
      const payload = { status: "hide" };
      const parsed = parseAssistantProposalResponse(payload);
      expect(parsed).toEqual({ status: "hide" });
    });
  });

  describe("AssistantProposalRequestSchema", () => {
    it("accepts valid catalog state and events", () => {
      const payload = {
        state: {
          categorySlug: "lodowki",
          query: "samsung",
          filters: { brand: "Samsung" },
          resultCount: 5,
          page: 1,
        },
        events: [
          {
            id: "e1",
            timestamp: "2026-10-03T14:00:00.000Z",
            type: "product_view",
            categorySlug: "lodowki",
            productSlug: "lodowka-samsung-rb",
            productId: "p1",
            categoryId: "c1",
            brandId: "b1",
          },
          {
            id: "e2",
            timestamp: "2026-10-03T14:01:00.000Z",
            type: "return_to_listing",
            categorySlug: "lodowki",
            categoryId: "c1",
          },
        ],
      };

      const result = AssistantProposalRequestSchema.safeParse(payload);
      expect(result.success).toBe(true);
    });

    it("rejects invalid state or events", () => {
      const badState = {
        state: {
          categorySlug: 123,
          query: "",
          filters: {},
          resultCount: -1,
          page: 0,
        },
        events: [],
      };
      expect(AssistantProposalRequestSchema.safeParse(badState).success).toBe(false);
    });
  });
});
