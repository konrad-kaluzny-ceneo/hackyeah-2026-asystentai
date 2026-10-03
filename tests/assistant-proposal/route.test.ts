import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  MAX_REQUEST_BODY_BYTES,
  POST,
  resetLimitersForTest,
} from "@/app/api/assistant-proposal/route";
import { parseAssistantProposalResponse } from "@/lib/assistant-proposal-api";
import * as proposalStub from "@/server/assistant-proposal/openai-stub";
import * as jevClient from "@/server/assistant-proposal/jev-client";
import { makeMetaEvent, resetFixtureSeed } from "../behavior/fixtures";

function makeRequest(body: unknown, headers: Record<string, string> = {}) {
  return new Request("http://localhost/api/assistant-proposal", {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: typeof body === "string" ? body : JSON.stringify(body),
  }) as unknown as Parameters<typeof POST>[0];
}

function jevOutput(confidence: number, situation = "DECISION_FATIGUE") {
  return {
    situation,
    proposal: {
      confidence,
      hedging_required: true,
      message_draft: null,
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
  metrics: { clickCount: 3, windowMs: 1000, elementId: "product-card" },
  quality: {
    strength: 0.99,
    evidenceCount: 2,
    algorithmVersion: "1.0",
    partialData: false,
  },
});

const validRequestBody = { metaEvents: [validEvent] };

describe("POST /api/assistant-proposal", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    resetLimitersForTest();
    resetFixtureSeed();
  });

  it("returns the deterministic proposal when Jev confidence is above 0.75", async () => {
    const jevSpy = vi
      .spyOn(jevClient, "requestJev")
      .mockResolvedValue(jevOutput(0.76));
    const stubSpy = vi
      .spyOn(proposalStub, "generateProposalWithOpenAiStub")
      .mockResolvedValue({ title: "Stały tytuł", message: "Stała treść demo." });

    const response = await POST(
      makeRequest(validRequestBody, { "x-real-ip": "10.0.0.1" }),
    );

    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json).toEqual({
      status: "show",
      kind: "decision_fatigue",
      title: "Stały tytuł",
      message: "Stała treść demo.",
      action: "narrow-choice",
      actionLabel: "Przejdź do filtrów",
    });
    expect(parseAssistantProposalResponse(json)).toEqual(json);
    expect(jevSpy).toHaveBeenCalledOnce();
    expect(stubSpy).toHaveBeenCalledOnce();
    expect(stubSpy).toHaveBeenCalledWith(jevOutput(0.76));

    const prompt = jevSpy.mock.calls[0]![0];
    expect(prompt).toContain("event=rage_click");
    expect(prompt).toContain("clickCount=3");
    expect(prompt).toContain("+0ms");
    expect(prompt).not.toContain("evt-hidden-identifier");
    expect(prompt).not.toContain("session-hidden-token");
    expect(prompt).not.toContain("pageview-hidden-token");
    expect(prompt).not.toContain("/secret/catalog/path");
    expect(prompt).not.toContain("2026-10-03T14:00:00.000Z");
    expect(prompt).not.toContain("0.99");
  });

  it("uses the fixed local stub copy without a model call", async () => {
    vi.spyOn(jevClient, "requestJev").mockResolvedValue(jevOutput(0.9));

    const response = await POST(makeRequest(validRequestBody));

    expect(await response.json()).toEqual({
      status: "show",
      kind: "decision_fatigue",
      title: "Pomóc zawęzić wybór?",
      message:
        "Wybierzmy jeden parametr, na przykład pojemność, aby szybciej zawęzić wyniki.",
      action: "narrow-choice",
      actionLabel: "Przejdź do filtrów",
    });
  });

  it.each([0.75, 0.7])("returns hide and skips the stub at confidence %s", async (confidence) => {
    vi.spyOn(jevClient, "requestJev").mockResolvedValue(jevOutput(confidence));
    const stubSpy = vi.spyOn(proposalStub, "generateProposalWithOpenAiStub");

    const response = await POST(makeRequest(validRequestBody));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: "hide" });
    expect(stubSpy).not.toHaveBeenCalled();
  });

  it("returns hide for a high-confidence non-fatigue situation", async () => {
    vi.spyOn(jevClient, "requestJev").mockResolvedValue(
      jevOutput(0.95, "PRODUCT_HESITATION"),
    );
    const stubSpy = vi.spyOn(proposalStub, "generateProposalWithOpenAiStub");

    const response = await POST(makeRequest(validRequestBody));

    expect(await response.json()).toEqual({ status: "hide" });
    expect(stubSpy).not.toHaveBeenCalled();
  });

  it("returns hide when Jev throws, times out, or returns an invalid shape", async () => {
    const jevSpy = vi
      .spyOn(jevClient, "requestJev")
      .mockRejectedValueOnce(new Error("Timeout / connection abort"))
      .mockResolvedValueOnce({ not_a_valid_field: true });

    for (let index = 0; index < 2; index += 1) {
      const response = await POST(makeRequest(validRequestBody));
      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ status: "hide" });
    }
    expect(jevSpy).toHaveBeenCalledTimes(2);
  });

  it("returns hide when the local proposal stub fails or returns invalid copy", async () => {
    vi.spyOn(jevClient, "requestJev").mockResolvedValue(jevOutput(0.9));
    const stubSpy = vi
      .spyOn(proposalStub, "generateProposalWithOpenAiStub")
      .mockRejectedValueOnce(new Error("stub failure"))
      .mockResolvedValueOnce({ title: "  ", message: "  " });

    for (let index = 0; index < 2; index += 1) {
      const response = await POST(makeRequest(validRequestBody));
      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ status: "hide" });
    }
    expect(stubSpy).toHaveBeenCalledTimes(2);
  });

  it("rejects invalid, empty, catalog, raw-event, and over-10-event bodies before Jev", async () => {
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

    const response = await POST(makeRequest("x".repeat(MAX_REQUEST_BODY_BYTES + 1)));

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

  it("enforces the per-IP rate limit", async () => {
    const jevSpy = vi.spyOn(jevClient, "requestJev");
    const { ipLimiter } = await import("@/app/api/assistant-proposal/route");
    for (let index = 0; index < 30; index += 1) {
      expect(ipLimiter.check("192.168.1.100").allowed).toBe(true);
    }
    expect(ipLimiter.check("192.168.1.100").allowed).toBe(false);

    const response = await POST(
      makeRequest(validRequestBody, { "x-real-ip": "192.168.1.100" }),
    );
    expect(await response.json()).toEqual({ status: "hide" });
    expect(jevSpy).not.toHaveBeenCalled();
  });
});
