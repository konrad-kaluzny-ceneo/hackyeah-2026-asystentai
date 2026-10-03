import { describe, expect, it } from "vitest";

import {
  AssistantProposalRequestSchema,
  parseAssistantProposalResponse,
  safeParseAssistantProposalResponse,
} from "@/lib/assistant-proposal-api";
import { makeMetaEvent, resetFixtureSeed } from "../behavior/fixtures";

describe("assistant-proposal-api contract", () => {
  describe("AssistantProposalResponseSchema", () => {
    it("accepts a valid 'show' response with action payload", () => {
      const payload = {
        status: "show",
        title: "Pomóc zawęzić wybór?",
        message: "Zawęź wybór według jednego ważnego parametru.",
        action: "narrow-choice",
        actionLabel: "Przejdź do filtrów",
        data: { target: "filters", filterKeys: ["capacityLiters"] },
      };

      const parsed = parseAssistantProposalResponse(payload);
      expect(parsed).toEqual(payload);
    });

    it("accepts show responses for every registered skill action", () => {
      const samples = [
        {
          status: "show",
          title: "Wyczyść wyszukiwanie",
          message: "Brak wyników — spróbuj ponownie z pustymi filtrami.",
          action: "clear-search-and-filters",
          actionLabel: "Wyczyść filtry",
          data: { target: "catalog" as const, filterKeys: [] },
        },
        {
          status: "show",
          title: "Otwórz produkt",
          message: "Chcesz wrócić do ostatnio oglądanego modelu?",
          action: "go-to-product",
          actionLabel: "Otwórz produkt",
          data: {
            target: "product" as const,
            filterKeys: [],
            productSlug: "lodowka-x",
          },
        },
        {
          status: "show",
          title: "Posortuj po cenie",
          message: "Zobacz najtańsze modele w tej kategorii.",
          action: "sort-by-price",
          actionLabel: "Cena rosnąco",
          data: { target: "catalog" as const, filterKeys: [], sort: "price_asc" as const },
        },
        {
          status: "show",
          title: "Sama wskazówka",
          message: "Zwróć uwagę na wysokość urządzenia.",
          action: "explain-choice",
          actionLabel: "Pokaż wskazówkę",
          data: { target: "catalog" as const, filterKeys: [] },
        },
      ];

      for (const payload of samples) {
        expect(safeParseAssistantProposalResponse(payload).success).toBe(true);
      }
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
          action: "narrow-choice",
          actionLabel: "OK",
          data: { target: "filters", filterKeys: [] },
        }).success,
      ).toBe(false);
    });

    it("rejects unknown action values and missing actionLabel", () => {
      expect(
        safeParseAssistantProposalResponse({
          status: "show",
          title: "t",
          message: "m",
          action: "go-to-compare",
          actionLabel: "OK",
          data: { target: "catalog", filterKeys: [] },
        }).success,
      ).toBe(false);
      expect(
        safeParseAssistantProposalResponse({
          status: "show",
          title: "t",
          message: "m",
          action: "narrow-choice",
          data: { target: "filters", filterKeys: [] },
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
