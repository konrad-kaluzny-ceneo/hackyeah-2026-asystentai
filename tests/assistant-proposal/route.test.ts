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
  subject: { type: "category", categoryId: "c1" },
  metrics: { clickCount: 3, windowMs: 1000, elementId: "product-card" },
});

const validRequestBody = { metaEvents: [validEvent] };
describe("POST /api/assistant-proposal", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    resetLimitersForTest();
    resetFixtureSeed();
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
      data: { target: "filters", filterKeys: [] },
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
          sort: null,
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
      data: { target: "filters", filterKeys: [] },
    });
    expect(parseAssistantProposalResponse(json)).toEqual(json);
    expect(openaiSpy).toHaveBeenCalledWith(
      expect.objectContaining({ situation: "DECISION_FATIGUE" }),
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
        sort: null,
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

  it("returns hide when OpenAI fails", async () => {
    vi.spyOn(jevClient, "requestJev").mockResolvedValue(
      jevOutput(0.7, { hedgingRequired: true }),
    );
    vi.spyOn(openaiClient, "requestStrongerReply").mockRejectedValue(
      new Error("OpenAI unavailable"),
    );

    const response = await POST(makeRequest(validRequestBody));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: "hide" });
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
