import { describe, expect, it } from "vitest";

import {
  AssistantProposalRequestSchema,
  parseAssistantProposalResponse,
  safeParseAssistantProposalResponse,
} from "@/lib/assistant-proposal-api";
import { makeMetaEvent, resetFixtureSeed } from "../behavior/fixtures";

const showPayload = {
  status: "show",
  kind: "jev_proposal",
  situation: "PRODUCT_HESITATION",
  title: "  Mogę podpowiedzieć następny krok  ",
  message: "  To demonstracyjna podpowiedź.  ",
  action: "narrow-choice",
  actionLabel: "  Przejdź do filtrów  ",
};

describe("assistant-proposal-api contract", () => {
  describe("AssistantProposalResponseSchema", () => {
    it("accepts a valid known-state 'show' response and trims strings", () => {
      expect(parseAssistantProposalResponse(showPayload)).toEqual({
        ...showPayload,
        title: "Mogę podpowiedzieć następny krok",
        message: "To demonstracyjna podpowiedź.",
        actionLabel: "Przejdź do filtrów",
      });
    });

    it("rejects an empty title, message, or action label after trim", () => {
      for (const payload of [
        { ...showPayload, title: "   " },
        { ...showPayload, message: "" },
        { ...showPayload, actionLabel: "   " },
      ]) {
        expect(safeParseAssistantProposalResponse(payload).success).toBe(false);
      }
    });

    it("rejects an invalid action, kind, or unknown Jev situation", () => {
      expect(
        safeParseAssistantProposalResponse({ ...showPayload, action: "other-action" }).success,
      ).toBe(false);
      expect(
        safeParseAssistantProposalResponse({ ...showPayload, kind: "search_friction" }).success,
      ).toBe(false);
      expect(
        safeParseAssistantProposalResponse({ ...showPayload, situation: "UNKNOWN" }).success,
      ).toBe(false);
    });

    it("accepts a valid 'hide' response", () => {
      expect(parseAssistantProposalResponse({ status: "hide" })).toEqual({
        status: "hide",
      });
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

      expect(AssistantProposalRequestSchema.safeParse(payload).success).toBe(true);
    });

    it("rejects empty, oversized, raw, or catalog-context requests", () => {
      expect(AssistantProposalRequestSchema.safeParse({ metaEvents: [] }).success).toBe(false);
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
