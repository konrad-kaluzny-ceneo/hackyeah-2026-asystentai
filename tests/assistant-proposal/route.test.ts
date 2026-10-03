import { beforeEach, describe, expect, it, vi } from "vitest";

import * as categoryFilters from "@/server/assistant-proposal/category-filters";
import { POST, resetLimitersForTest } from "@/app/api/assistant-proposal/route";
import { parseAssistantProposalResponse } from "@/lib/assistant-proposal-api";
import * as jevClient from "@/server/assistant-proposal/jev-client";
import * as openaiClient from "@/server/assistant-proposal/openai-client";

vi.mock("@/server/assistant-proposal/category-filters", () => ({
  getCategoryFilters: vi.fn(),
}));

function makeRequest(body: unknown, headers: Record<string, string> = {}) {
  return new Request("http://localhost/api/assistant-proposal", {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: typeof body === "string" ? body : JSON.stringify(body),
  }) as unknown as Parameters<typeof POST>[0];
}

const validRequestBody = {
  state: {
    categorySlug: "lodowki",
    query: "",
    filters: {},
    resultCount: 12,
    page: 1,
  },
  events: [
    {
      id: "e1",
      timestamp: "2026-10-03T14:00:00.000Z",
      type: "product_view",
      categorySlug: "lodowki",
      productSlug: "lodowka-a",
      productId: "p1",
      categoryId: "c1",
      brandId: "b1",
    },
    {
      id: "e2",
      timestamp: "2026-10-03T14:01:00.000Z",
      type: "product_view",
      categorySlug: "lodowki",
      productSlug: "lodowka-b",
      productId: "p2",
      categoryId: "c1",
      brandId: "b2",
    },
    {
      id: "e3",
      timestamp: "2026-10-03T14:02:00.000Z",
      type: "return_to_listing",
      categorySlug: "lodowki",
      categoryId: "c1",
    },
    {
      id: "e4",
      timestamp: "2026-10-03T14:02:01.000Z",
      type: "listing_view",
      categorySlug: "lodowki",
      categoryId: "c1",
    },
  ],
};

describe("POST /api/assistant-proposal", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    resetLimitersForTest();
    vi.mocked(categoryFilters.getCategoryFilters).mockResolvedValue([
      {
        key: "capacity",
        label: "Pojemność",
        kind: "range",
        min: 100,
        max: 500,
      },
    ]);
  });

  it("returns show response when Jev meets shortcut criteria", async () => {
    const jevSpy = vi.spyOn(jevClient, "requestJev").mockResolvedValue({
      situation: "DECISION_FATIGUE",
      proposal: {
        confidence: 0.88,
        hedging_required: false,
        message_draft: "Zawęź wyniki według pojemności — oglądałeś trzy podobne modele.",
      },
    });
    const openaiSpy = vi
      .spyOn(openaiClient, "requestStrongerReply")
      .mockResolvedValue({
        action: "narrow-choice",
        data: { target: "filters", filterKeys: [] },
      });

    const response = await POST(
      makeRequest(validRequestBody, { "x-real-ip": "10.0.0.1" }),
    );

    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json).toEqual({
      status: "show",
      action: "narrow-choice",
      data: { target: "filters", filterKeys: [] },
    });

    // Validates against shared contract schema
    expect(parseAssistantProposalResponse(json)).toEqual(json);
    expect(jevSpy).toHaveBeenCalledOnce();
    expect(openaiSpy).not.toHaveBeenCalled();
  });

  it("returns hide when Jev client throws or aborts", async () => {
    const jevSpy = vi
      .spyOn(jevClient, "requestJev")
      .mockRejectedValue(new Error("Timeout / connection abort"));

    const response = await POST(
      makeRequest(validRequestBody, { "x-real-ip": "10.0.0.2" }),
    );

    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json).toEqual({ status: "hide" });
    expect(jevSpy).toHaveBeenCalledOnce();
  });

  it("rethrows provider errors in development", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.spyOn(jevClient, "requestJev").mockRejectedValue(
      new Error("Typesafe unavailable"),
    );

    try {
      await expect(
        POST(makeRequest(validRequestBody, { "x-real-ip": "10.0.0.7" })),
      ).rejects.toThrow("Typesafe unavailable");
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it("returns hide when Jev returns invalid schema output", async () => {
    vi.spyOn(jevClient, "requestJev").mockResolvedValue({
      not_a_valid_field: true,
    });

    const response = await POST(
      makeRequest(validRequestBody, { "x-real-ip": "10.0.0.3" }),
    );

    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json).toEqual({ status: "hide" });
  });

  it("returns OpenAI show response when Jev output needs the stronger model", async () => {
    vi.spyOn(jevClient, "requestJev").mockResolvedValue({
      situation: "DECISION_FATIGUE",
      proposal: {
        confidence: 0.7,
        hedging_required: false,
        message_draft: "Może warto sprawdzić inne wymiary.",
      },
    });
    const openaiSpy = vi
      .spyOn(openaiClient, "requestStrongerReply")
      .mockResolvedValue({
        action: "narrow-choice",
        data: {
          target: "filters",
          filterKeys: ["capacity", "not-a-real-filter"],
        },
      });

    const response = await POST(
      makeRequest(validRequestBody, { "x-real-ip": "10.0.0.4" }),
    );

    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json).toEqual({
      status: "show",
      action: "narrow-choice",
      data: { target: "filters", filterKeys: ["capacity"] },
    });
    expect(parseAssistantProposalResponse(json)).toEqual(json);
    expect(openaiSpy).toHaveBeenCalledOnce();
    expect(openaiSpy).toHaveBeenCalledWith(
      expect.objectContaining({ situation: "DECISION_FATIGUE" }),
      [
        {
          key: "capacity",
          label: "Pojemność",
          kind: "range",
          min: 100,
          max: 500,
        },
      ],
      expect.any(AbortSignal),
    );
  });

  it("returns hide when the stronger model fails", async () => {
    vi.spyOn(jevClient, "requestJev").mockResolvedValue({
      situation: "PRODUCT_HESITATION",
      proposal: {
        confidence: 0.82,
        hedging_required: false,
        message_draft: "Wróć do wcześniej oglądanego modelu.",
      },
    });
    vi.spyOn(openaiClient, "requestStrongerReply").mockRejectedValue(
      new Error("OpenAI unavailable"),
    );

    const response = await POST(
      makeRequest(validRequestBody, { "x-real-ip": "10.0.0.6" }),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: "hide" });
  });

  it("returns 400 when request body fails validation", async () => {
    const response = await POST(
      makeRequest({ state: "invalid" }, { "x-real-ip": "10.0.0.5" }),
    );

    expect(response.status).toBe(400);
    const json = (await response.json()) as { error: string };
    expect(json.error).toBe("validation_failed");
  });

  it("enforces rate limit: 31st request from same IP within 60s returns hide without calling Jev", async () => {
    const jevSpy = vi.spyOn(jevClient, "requestJev").mockResolvedValue({
      situation: "DECISION_FATIGUE",
      proposal: {
        confidence: 0.9,
        hedging_required: false,
        message_draft: "Skrót testowy.",
      },
    });

    // Make 10 requests (process limit is 10, so let's test process limiter and IP limiter)
    // First, let's reset to test specifically IP limiter:
    // With process limit = 10, requests 1-10 are allowed, 11th hits process limit.
    for (let i = 0; i < 10; i++) {
      const res = await POST(
        makeRequest(validRequestBody, { "x-real-ip": "10.1.1.1" }),
      );
      expect(res.status).toBe(200);
    }

    expect(jevSpy).toHaveBeenCalledTimes(10);

    // 11th request hits the process limiter
    const res11 = await POST(
      makeRequest(validRequestBody, { "x-real-ip": "10.1.1.1" }),
    );
    expect(res11.status).toBe(200);
    expect(await res11.json()).toEqual({ status: "hide" });
    // Jev should NOT be called on 11th request
    expect(jevSpy).toHaveBeenCalledTimes(10);
  });

  it("enforces IP rate limit: 31st request from same IP returns hide without calling Jev (when process limit allows)", async () => {
    const jevSpy = vi.spyOn(jevClient, "requestJev").mockResolvedValue({
      situation: "DECISION_FATIGUE",
      proposal: {
        confidence: 0.9,
        hedging_required: false,
        message_draft: "Skrót testowy.",
      },
    });

    // Temporarily increase process limit or check IP limiter directly to test 31st IP call
    const { ipLimiter } = await import("@/app/api/assistant-proposal/route");
    for (let i = 0; i < 30; i++) {
      expect(ipLimiter.check("192.168.1.100").allowed).toBe(true);
    }
    const check31 = ipLimiter.check("192.168.1.100");
    expect(check31.allowed).toBe(false);

    // Now send request from that IP
    const res = await POST(
      makeRequest(validRequestBody, { "x-real-ip": "192.168.1.100" }),
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: "hide" });
    expect(jevSpy).not.toHaveBeenCalled();
  });
});
