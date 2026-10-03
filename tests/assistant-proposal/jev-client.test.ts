import { afterEach, describe, expect, it, vi } from "vitest";

import {
  DEFAULT_TYPESAFE_URL,
  requestJev,
} from "@/server/assistant-proposal/jev-client";

const originalApiKey = process.env.TYPESAFE_API_KEY;

afterEach(() => {
  vi.unstubAllGlobals();
  if (originalApiKey === undefined) {
    delete process.env.TYPESAFE_API_KEY;
  } else {
    process.env.TYPESAFE_API_KEY = originalApiKey;
  }
});

describe("requestJev", () => {
  it("calls the System One API and adapts choice answers", async () => {
    process.env.TYPESAFE_API_KEY = "test-key";
    const fetchMock = vi.fn().mockResolvedValue(
      Response.json({
        model: "jev-1.13.0",
        answers: {
          situation: {
            type: "choice",
            choice: "DECISION_FATIGUE",
            confidence: 0.91,
            probabilities: {
              DECISION_FATIGUE: 0.94,
              PRODUCT_HESITATION: 0.06,
            },
          },
          action_type: {
            type: "choice",
            choice: "NARROW_BY_SPEC",
            confidence: 0.84,
            probabilities: {
              NARROW_BY_SPEC: 0.89,
              DO_NOTHING: 0.11,
            },
          },
        },
        usage: { input_tokens: 100, output_tokens: 20 },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await requestJev("Stan sesji", new AbortController().signal);

    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(DEFAULT_TYPESAFE_URL);
    expect(init.headers).toEqual({
      "Content-Type": "application/json",
      Authorization: "Bearer test-key",
    });
    expect(JSON.parse(init.body as string)).toEqual(
      expect.objectContaining({
        state: "Stan sesji",
        model: "jev-latest",
        questions: expect.objectContaining({
          situation: expect.objectContaining({ type: "choice" }),
          action_type: expect.objectContaining({ type: "choice" }),
        }),
      }),
    );
    expect(result).toEqual({
      situation: "DECISION_FATIGUE",
      signal_strength: 0.91,
      proposal: {
        action_type: "NARROW_BY_SPEC",
        confidence: 0.84,
        hedging_required: false,
        message_draft:
          "Porównujesz kilka podobnych modeli. Zawęź wyniki według jednego ważnego parametru, żeby łatwiej wybrać.",
      },
    });
  });

  it("throws when the System One endpoint rejects the request", async () => {
    process.env.TYPESAFE_API_KEY = "test-key";
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(null, { status: 401 })),
    );

    await expect(requestJev("Stan sesji")).rejects.toThrow(
      "Typesafe API returned HTTP 401",
    );
  });
});