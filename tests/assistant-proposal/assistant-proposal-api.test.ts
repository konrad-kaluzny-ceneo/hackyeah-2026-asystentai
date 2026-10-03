import { describe, expect, it } from "vitest";

import {
  AssistantProposalRequestSchema,
  parseAssistantProposalResponse,
  safeParseAssistantProposalResponse,
} from "@/lib/assistant-proposal-api";

describe("assistant-proposal-api contract", () => {
  describe("AssistantProposalResponseSchema", () => {
    it("accepts a valid 'show' response and trims strings", () => {
      const payload = {
        status: "show",
        kind: "decision_fatigue",
        title: "  Pomóc zawęzić wybór?  ",
        message: "  Zawęź wyniki według pojemności.  ",
        action: "narrow-choice",
        actionLabel: "  Przejdź do filtrów  ",
      };

      const parsed = parseAssistantProposalResponse(payload);
      expect(parsed).toEqual({
        status: "show",
        kind: "decision_fatigue",
        title: "Pomóc zawęzić wybór?",
        message: "Zawęź wyniki według pojemności.",
        action: "narrow-choice",
        actionLabel: "Przejdź do filtrów",
      });
    });

    it("rejects 'show' if message or title is empty after trim", () => {
      const emptyTitle = {
        status: "show",
        kind: "decision_fatigue",
        title: "   ",
        message: "Ok",
        action: "narrow-choice",
        actionLabel: "Filtry",
      };
      expect(safeParseAssistantProposalResponse(emptyTitle).success).toBe(false);

      const emptyMessage = {
        status: "show",
        kind: "decision_fatigue",
        title: "Tytuł",
        message: "",
        action: "narrow-choice",
        actionLabel: "Filtry",
      };
      expect(safeParseAssistantProposalResponse(emptyMessage).success).toBe(false);

      const emptyActionLabel = {
        status: "show",
        kind: "decision_fatigue",
        title: "Tytuł",
        message: "Wiadomość",
        action: "narrow-choice",
        actionLabel: "   ",
      };
      expect(safeParseAssistantProposalResponse(emptyActionLabel).success).toBe(false);
    });

    it("rejects 'show' with invalid action or kind", () => {
      const badAction = {
        status: "show",
        kind: "decision_fatigue",
        title: "Tytuł",
        message: "Wiadomość",
        action: "other-action",
        actionLabel: "Filtry",
      };
      expect(safeParseAssistantProposalResponse(badAction).success).toBe(false);

      const badKind = {
        status: "show",
        kind: "search_friction",
        title: "Tytuł",
        message: "Wiadomość",
        action: "narrow-choice",
        actionLabel: "Filtry",
      };
      expect(safeParseAssistantProposalResponse(badKind).success).toBe(false);
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
