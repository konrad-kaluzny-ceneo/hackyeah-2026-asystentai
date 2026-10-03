import { describe, expect, it } from "vitest";

import {
  AssistantProposalRequestSchema,
  parseAssistantProposalResponse,
  safeParseAssistantProposalResponse,
} from "@/lib/assistant-proposal-api";
import { makeMetaEvent, resetFixtureSeed } from "../behavior/fixtures";

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
