import { describe, expect, it } from "vitest";

import {
  AssistantProposalRequestSchema,
  parseAssistantProposalResponse,
  safeParseAssistantProposalResponse,
} from "@/lib/assistant-proposal-api";
import { makeMetaEvent, resetFixtureSeed } from "../behavior/fixtures";

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
    it("accepts a bounded MetaEvents-only request", () => {
      resetFixtureSeed();
      const payload = {
        metaEvents: [
          makeMetaEvent("rage_click"),
          makeMetaEvent("category_interest"),
        ],
      };

      const result = AssistantProposalRequestSchema.safeParse(payload);
      expect(result.success).toBe(true);
    });

    it("rejects empty, oversized, raw, or catalog-context requests", () => {
      expect(
        AssistantProposalRequestSchema.safeParse({ metaEvents: [] }).success,
      ).toBe(false);
      expect(
        AssistantProposalRequestSchema.safeParse({
          metaEvents: Array.from({ length: 11 }, () => makeMetaEvent("rage_click")),
        }).success,
      ).toBe(false);
      expect(
        AssistantProposalRequestSchema.safeParse({
          metaEvents: [{ type: "product_view", pathname: "/product" }],
        }).success,
      ).toBe(false);
      expect(
        AssistantProposalRequestSchema.safeParse({
          state: { query: "fridge" },
          events: [],
          metaEvents: [makeMetaEvent("rage_click")],
        }).success,
      ).toBe(false);
    });
  });
});
