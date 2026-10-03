import { afterEach, describe, expect, it, vi } from "vitest";

import { buildJevRequest, requestJev } from "@/server/assistant-proposal/jev-client";
import { makeContext, makeJevOutput } from "./fixtures";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("TypeSafe Jev client", () => {
  it("builds typed questions using only category filter keys and safe session summaries", () => {
    const context = makeContext();
    const request = buildJevRequest(context);

    expect(request?.model).toBe("jev-latest");
    expect(Object.keys(request?.questions.recommended_filter.criteria ?? {})).toEqual([
      "capacityLiters",
      "heightCm",
    ]);
    expect(request?.state.recentCatalogEvents[0]).toMatchObject({
      type: "product_view",
      productSlug: "lodowka-a",
    });
    const serialized = JSON.stringify(request);
    expect(serialized).not.toContain("event-1");
    expect(serialized).not.toContain("2026-10-03T14:00:00.000Z");
  });

  it("sends the official System One request and validates the typed response", async () => {
    vi.stubEnv("TYPESAFE_API_KEY", "test-only-key");
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(makeJevOutput()), { status: 200 }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const request = buildJevRequest(makeContext());
    if (request === null) throw new Error("fixture must have a category");

    const response = await requestJev(request, new AbortController().signal);

    expect(response.answers.situation.choice).toBe("DECISION_FATIGUE");
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.typesafe.ai/v1/systemone",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({ Authorization: "Bearer test-only-key" }),
        body: JSON.stringify(request),
      }),
    );
  });

  it("fails closed on missing credentials, provider errors, and malformed responses", async () => {
    const request = buildJevRequest(makeContext());
    if (request === null) throw new Error("fixture must have a category");
    const signal = new AbortController().signal;

    vi.stubEnv("TYPESAFE_API_KEY", "");
    await expect(requestJev(request, signal)).rejects.toThrow("TYPESAFE_API_KEY");

    vi.stubEnv("TYPESAFE_API_KEY", "test-only-key");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("{}", { status: 503 })));
    await expect(requestJev(request, signal)).rejects.toThrow("HTTP 503");

    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ model: "jev-latest" }), { status: 200 })));
    await expect(requestJev(request, signal)).rejects.toThrow();
  });
});
