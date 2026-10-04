import { beforeEach, describe, expect, it, vi } from "vitest";

import { POST, resetLimitersForTest, MAX_REQUEST_BODY_BYTES } from "@/app/api/assistant-proposal/route";
import { parseAssistantProposalResponse } from "@/lib/assistant-proposal-api";
import * as jevClient from "@/server/assistant-proposal/jev-client";
import * as openaiClient from "@/server/assistant-proposal/openai-client";
import { makeMetaEvent, resetFixtureSeed } from "../behavior/fixtures";

function makeRequest(body: unknown, headers: Record<string, string> = {}) {
  return new Request("http://localhost/api/assistant-proposal", {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: typeof body === "string" ? body : JSON.stringify(body),
  }) as unknown as Parameters<typeof POST>[0];
}

function jevOutput(
  confidence: number,
  options: {
    situation?: string;
    actionType?: string;
    hedgingRequired?: boolean;
    messageDraft?: string | null;
  } = {},
) {
  return {
    situation: options.situation ?? "DECISION_FATIGUE",
    intent_probabilities: {
      DECISION_FATIGUE: 0.7,
      PRODUCT_HESITATION: 0.3,
    },
    proposal: {
      action_type: options.actionType ?? "NARROW_BY_SPEC",
      confidence,
      hedging_required: options.hedgingRequired ?? false,
      message_draft: options.messageDraft ?? "Zawęź wybór według ważnego parametru.",
      action_payload: { filterKeys: ["capacityLiters"] },
    },
  };
}

const validEvent = makeMetaEvent("rage_click", {
  eventId: "evt-hidden-identifier",
  detectedAt: "2026-10-03T14:00:00.000Z",
  identity: {
    sessionId: "session-hidden-token",
    pageViewId: "pageview-hidden-token",
  },
  page: { type: "catalog", pathname: "/secret/catalog/path" },
  subject: { type: "category", categoryId: "lodowki" },
  metrics: { clickCount: 3, windowMs: 1000, elementId: "product-card" },
});

const validRequestBody = { metaEvents: [validEvent] };
describe("POST /api/assistant-proposal", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    resetLimitersForTest();
    resetFixtureSeed();
  });

  it.each([
    ["SET_BUDGET", "set-budget", "product", ["price"]],
    ["SET_BUDGET", "set-budget", "catalog", ["price"]],
    ["CHOOSE_BRAND", "choose-brand", "product", ["brand"]],
    ["CHOOSE_BRAND", "choose-brand", "catalog", ["brand"]],
    ["BROWSE_CATEGORY", "browse-category", "product", []],
    ["BROWSE_CATEGORY", "browse-category", "catalog", []],
  ] as const)("maps %s from a %s action on %s", async (actionType, action, pageType, filterKeys) => {
    vi.spyOn(jevClient, "requestJev").mockResolvedValue(jevOutput(0.9, { actionType }));
    vi.spyOn(openaiClient, "requestStrongerReply").mockResolvedValue({
      title: "Następny krok",
      message: "Wybierz najważniejsze kryterium.",
      action,
      actionLabel: "Przejdź",
      data: {
        target: "catalog",
        filterKeys: [],
        productSlug: null,
        categorySlug: null,
        sort: null,
        illustration: "fox-guiding",
      },
    });

    const event = {
      ...validEvent,
      page: { ...validEvent.page, type: pageType },
      subject: pageType === "product"
        ? { type: "product", id: "product-test", categoryId: "lodowki" }
        : validEvent.subject,
    };
    const response = await POST(makeRequest({ metaEvents: [event] }));
    const json = await response.json();
    expect(response.status).toBe(200);
    expect(json.status).toBe("show");
    expect(json.action).toBe(action);
    expect(json.data).toEqual({
      target: action === "browse-category" ? "catalog" : "filters",
      filterKeys,
      categorySlug: "lodowki",
      illustration: "fox-guiding",
    });
    expect(parseAssistantProposalResponse(json)).toEqual(json);
  });

  it("does not offer a category filter without a validated category", async () => {
    vi.spyOn(jevClient, "requestJev").mockResolvedValue(jevOutput(0.9, { actionType: "SET_BUDGET" }));
    const openaiSpy = vi.spyOn(openaiClient, "requestStrongerReply");
    const response = await POST(makeRequest({ metaEvents: [{ ...validEvent, subject: null }] }));
    expect(await response.json()).toEqual({ status: "hide" });
    expect(openaiSpy).not.toHaveBeenCalled();
  });

  it("uses Jev's confident fatigue draft as a shortcut", async () => {
    const jevSpy = vi
      .spyOn(jevClient, "requestJev")
      .mockResolvedValue(jevOutput(0.95));
    const openaiSpy = vi
      .spyOn(openaiClient, "requestStrongerReply")

    const response = await POST(
      makeRequest(validRequestBody, { "x-real-ip": "10.0.0.1" }),
    );
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json).toEqual({
      status: "show",
      title: "Pomóc zawęzić wybór?",
      message: "Zawęź wybór według ważnego parametru.",
      action: "narrow-choice",
      actionLabel: "Przejdź do filtrów",
      data: {
        target: "filters",
        filterKeys: ["capacityLiters"],
        categorySlug: "lodowki",
        illustration: "fox-guiding",
      },
    });
    expect(parseAssistantProposalResponse(json)).toEqual(json);
    expect(jevSpy).toHaveBeenCalledOnce();
    expect(openaiSpy).not.toHaveBeenCalled();
    const prompt = jevSpy.mock.calls[0]![0];
    expect(prompt).toContain("event=rage_click");
    expect(prompt).toContain("clickCount=3");
    expect(prompt).toContain("+0ms");
    expect(prompt).not.toContain("evt-hidden-identifier");
    expect(prompt).not.toContain("session-hidden-token");
    expect(prompt).not.toContain("pageview-hidden-token");
    expect(prompt).not.toContain("/secret/catalog/path");
    expect(prompt).not.toContain("2026-10-03T14:00:00.000Z");
  });

  it("uses OpenAI for uncertain Jev output and merges the chosen action", async () => {
    const jev = jevOutput(0.7, { hedgingRequired: true });
    vi.spyOn(jevClient, "requestJev").mockResolvedValue(jev);
    const openaiSpy = vi
      .spyOn(openaiClient, "requestStrongerReply")
      .mockResolvedValue({
        title: "Zawęź wybór",
        message: "Wskaż najważniejszy parametr, aby łatwiej wybrać.",
        action: "narrow-choice",
        actionLabel: "Przejdź do filtrów",
        data: {
          target: "filters",
          filterKeys: [],
          productSlug: null,
          categorySlug: null,
          sort: null,
          illustration: "fox-celebrating",
        },
      });

    const response = await POST(
      makeRequest(validRequestBody, { "x-real-ip": "10.0.0.2" }),
    );
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json).toEqual({
      status: "show",
      title: "Zawęź wybór",
      message: "Wskaż najważniejszy parametr, aby łatwiej wybrać.",
      action: "narrow-choice",
      actionLabel: "Przejdź do filtrów",
      data: {
        target: "filters",
        filterKeys: ["capacityLiters"],
        categorySlug: "lodowki",
        illustration: "fox-celebrating",
      },
    });
    expect(parseAssistantProposalResponse(json)).toEqual(json);
    expect(openaiSpy).toHaveBeenCalledWith(
      expect.objectContaining({ situation: "DECISION_FATIGUE" }),
      expect.any(AbortSignal),
    );
  });

  it("recovers a strong non-smooth DO_NOTHING result as an explanation", async () => {
    vi.spyOn(jevClient, "requestJev").mockResolvedValue(
      jevOutput(0.9, {
        actionType: "DO_NOTHING",
        messageDraft: null,
      }),
    );
    const openaiSpy = vi
      .spyOn(openaiClient, "requestStrongerReply")
      .mockResolvedValue({
        title: "Ważny parametr wyboru",
        message: "Skup się na jednym parametrze, który jest dla Ciebie najważniejszy.",
        action: "explain-choice",
        actionLabel: "Pokaż wskazówkę",
        data: {
          target: "catalog",
          filterKeys: [],
          productSlug: null,
          categorySlug: null,
          sort: null,
          illustration: "fox-thinking",
        },
      });

    const response = await POST(makeRequest(validRequestBody));
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.status).toBe("show");
    expect(json.action).toBe("explain-choice");
    expect(openaiSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        proposal: expect.objectContaining({ action_type: "EXPLAIN_CHOICE" }),
      }),
      expect.any(AbortSignal),
    );
  });

  it("allows at most one OpenAI request at a time", async () => {
    vi.spyOn(jevClient, "requestJev").mockResolvedValue(
      jevOutput(0.7, { hedgingRequired: true }),
    );
    let resolveOpenAI: ((reply: openaiClient.StrongerReply) => void) | undefined;
    const openaiSpy = vi
      .spyOn(openaiClient, "requestStrongerReply")
      .mockImplementation(
        () =>
          new Promise((resolve) => {
            resolveOpenAI = resolve;
          }),
      );

    const firstRequest = POST(
      makeRequest(validRequestBody, { "x-real-ip": "10.0.0.11" }),
    );
    await vi.waitFor(() => expect(openaiSpy).toHaveBeenCalledOnce());

    const secondResponse = await POST(
      makeRequest(validRequestBody, { "x-real-ip": "10.0.0.12" }),
    );
    expect(await secondResponse.json()).toEqual({ status: "hide" });
    expect(openaiSpy).toHaveBeenCalledOnce();

    resolveOpenAI?.({
      title: "Zawęź wybór",
      message: "Wskaż najważniejszy parametr, aby łatwiej wybrać.",
      action: "narrow-choice",
      actionLabel: "Przejdź do filtrów",
      data: {
        target: "filters",
        filterKeys: [],
        productSlug: null,
        categorySlug: null,
        sort: null,
        illustration: null,
      },
    });
    expect((await firstRequest).status).toBe(200);
  });

  it("returns hide when Jev throws or returns invalid schema output", async () => {
    const jevSpy = vi
      .spyOn(jevClient, "requestJev")
      .mockRejectedValueOnce(new Error("Jev unavailable"))
      .mockResolvedValueOnce({ not_a_valid_field: true });

    for (let index = 0; index < 2; index += 1) {
      const response = await POST(makeRequest(validRequestBody));
      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ status: "hide" });
    }
    expect(jevSpy).toHaveBeenCalledTimes(2);
  });

  it("returns a useful fallback when OpenAI fails", async () => {
    vi.spyOn(jevClient, "requestJev").mockResolvedValue(
      jevOutput(0.7, { hedgingRequired: true }),
    );
    vi.spyOn(openaiClient, "requestStrongerReply").mockRejectedValue(
      new Error("OpenAI unavailable"),
    );

    const response = await POST(makeRequest(validRequestBody));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      status: "show",
      title: "Mam dla Ciebie podpowiedź",
      message:
        "Warto zawęzić wyniki według jednego ważnego parametru, żeby łatwiej wybrać.",
      action: "narrow-choice",
      actionLabel: "Przejdź do filtrów",
      data: {
        target: "filters",
        filterKeys: ["capacityLiters"],
        categorySlug: "lodowki",
        illustration: "fox-guiding",
      },
    });
  });

  it("returns a fallback instead of throwing when OpenAI aborts", async () => {
    vi.spyOn(jevClient, "requestJev").mockResolvedValue(
      jevOutput(0.7, { hedgingRequired: true }),
    );
    vi.spyOn(openaiClient, "requestStrongerReply").mockRejectedValue(
      new Error("Request was aborted."),
    );

    const response = await POST(makeRequest(validRequestBody));
    expect(response.status).toBe(200);
    expect((await response.json()).status).toBe("show");
  });

  it("uses the mapped action when OpenAI returns none", async () => {
    vi.spyOn(jevClient, "requestJev").mockResolvedValue(
      jevOutput(0.7, { hedgingRequired: true }),
    );
    vi.spyOn(openaiClient, "requestStrongerReply").mockResolvedValue({
      title: "Nie pokazuj",
      message: "Brak komunikatu.",
      action: "none",
      actionLabel: "Brak",
      data: {
        target: "catalog",
        filterKeys: [],
        productSlug: null,
        categorySlug: null,
        sort: null,
        illustration: "fox-thinking",
      },
    });

    const response = await POST(makeRequest(validRequestBody));
    expect(response.status).toBe(200);
    expect((await response.json()).action).toBe("narrow-choice");
  });

  it("rethrows provider errors in development", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.spyOn(jevClient, "requestJev").mockRejectedValue(
      new Error("Typesafe unavailable"),
    );

    try {
      await expect(POST(makeRequest(validRequestBody))).rejects.toThrow(
        "Typesafe unavailable",
      );
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it("rejects invalid, empty, legacy, raw-event, and over-limit event bodies before Jev", async () => {
    const jevSpy = vi.spyOn(jevClient, "requestJev");
    const invalidBodies = [
      "not-json",
      { metaEvents: [] },
      { state: { query: "fridge" }, events: [], metaEvents: [validEvent] },
      { metaEvents: [{ type: "product_view", pathname: "/catalog/product" }] },
      { metaEvents: Array.from({ length: 11 }, () => validEvent) },
    ];

    for (const body of invalidBodies) {
      const response = await POST(makeRequest(body));
      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ status: "hide" });
    }
    expect(jevSpy).not.toHaveBeenCalled();
  });

  it("rejects bodies over 64 KiB before calling Jev", async () => {
    const jevSpy = vi.spyOn(jevClient, "requestJev");
    const response = await POST(
      makeRequest("x".repeat(MAX_REQUEST_BODY_BYTES + 1)),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: "hide" });
    expect(jevSpy).not.toHaveBeenCalled();
  });

  it("enforces the process rate limit without calling Jev after the limit", async () => {
    const jevSpy = vi
      .spyOn(jevClient, "requestJev")
      .mockResolvedValue(jevOutput(0.9));

    for (let index = 0; index < 10; index += 1) {
      const response = await POST(
        makeRequest(validRequestBody, { "x-real-ip": "10.1.1.1" }),
      );
      expect(response.status).toBe(200);
    }
    expect(jevSpy).toHaveBeenCalledTimes(10);

    const limited = await POST(
      makeRequest(validRequestBody, { "x-real-ip": "10.1.1.1" }),
    );
    expect(await limited.json()).toEqual({ status: "hide" });
    expect(jevSpy).toHaveBeenCalledTimes(10);
  });
});
