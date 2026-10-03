import { describe, expect, it } from "vitest";

import {
  AssistantProposalRequestSchema,
  parseAssistantProposalResponse,
  safeParseAssistantProposalResponse,
} from "@/lib/assistant-proposal-api";
import { makeMetaEvent, resetFixtureSeed } from "../behavior/fixtures";

describe("assistant-proposal-api contract", () => {
  describe("AssistantProposalResponseSchema", () => {
    it("accepts a valid 'show' response with title and message", () => {
      const payload = {
        status: "show",
        title: "Pomóc zawęzić wybór?",
        message: "Zawęź wybór według jednego ważnego parametru.",
      };

      const parsed = parseAssistantProposalResponse(payload);
      expect(parsed).toEqual(payload);
    });

    it("rejects 'show' with missing or empty copy", () => {
      const missingMessage = {
        status: "show",
        title: "Pomóc zawęzić wybór?",
      };

      const emptyTitle = {
        status: "show",
        title: "  ",
        message: "Wybierz parametr.",
      };

      expect(safeParseAssistantProposalResponse(missingMessage).success).toBe(false);
      expect(safeParseAssistantProposalResponse(emptyTitle).success).toBe(false);
    });

    it("rejects copy that is too long for the widget", () => {
      expect(
        safeParseAssistantProposalResponse({
          status: "show",
          title: "Krótki tytuł",
          message: "x".repeat(181),
        }).success,
      ).toBe(false);
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
