import { describe, expect, it, vi } from "vitest";

import { parseAssistantProposalResponse } from "@/lib/assistant-proposal-api";
import { InMemoryRateLimiter } from "@/server/meta-events/rate-limit";
import {
  createAssistantProposalHandler,
  type AssistantProposalHandlerDependencies,
} from "@/server/assistant-proposal/handler";
import type { JevAssistantResponse } from "@/server/assistant-proposal/schema";
import type { JevSystemOneRequest } from "@/server/assistant-proposal/jev-client";
import { makeContext, makeJevOutput, requestBody } from "./fixtures";

function makeRequest(body: unknown, headers: Record<string, string> = {}): Request {
  return new Request("http://localhost/api/assistant-proposal", {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

function makeHandler(
  overrides: Partial<AssistantProposalHandlerDependencies> = {},
  limits: { perIp?: number; process?: number } = {},
) {
  return createAssistantProposalHandler({
    perIpRateLimiter: new InMemoryRateLimiter(limits.perIp ?? 30, 60_000, () => 0),
    processRateLimiter: new InMemoryRateLimiter(limits.process ?? 10, 60_000, () => 0),
    loadContext: vi.fn(async () => makeContext()),
    requestJev: vi.fn(async () => makeJevOutput()),
    ...overrides,
  });
}

describe("POST /api/assistant-proposal handler", () => {
  it("returns a contract-valid shortcut without generating copy in Jev", async () => {
    const requestJev = vi.fn(async () => makeJevOutput());
    const loadContext = vi.fn(async () => makeContext());
    const handler = makeHandler({ requestJev, loadContext });

    const response = await handler(makeRequest(requestBody));
    const body = parseAssistantProposalResponse(await response.json());

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      status: "show",
      kind: "decision_fatigue",
      title: "Pomóc zawęzić wybór?",
      message: "Wybierz filtr „Pojemność”, aby zawęzić wyniki.",
      action: "narrow-choice",
      actionLabel: "Przejdź do filtrów",
    });
    expect(requestJev).toHaveBeenCalledOnce();
    expect(loadContext).toHaveBeenCalledWith(requestBody);
  });

  it("hides low-confidence and different-situation decisions", async () => {
    for (const output of [
      makeJevOutput({ situationConfidence: 0.74 }),
      makeJevOutput({ situation: "OTHER" }),
    ]) {
      const requestJev = vi.fn(async () => output);
      const handler = makeHandler({ requestJev });
      const response = await handler(makeRequest(requestBody));
      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ status: "hide" });
    }
  });

  it("hides when Jev fails or the 3-second decision budget expires", async () => {
    const failed = makeHandler({
      requestJev: vi.fn(async () => {
        throw new Error("provider unavailable");
      }),
    });
    expect(await (await failed(makeRequest(requestBody))).json()).toEqual({ status: "hide" });

    const timedOut = makeHandler({
      jevTimeoutMs: 5,
      requestJev: vi.fn(
        (_payload: JevSystemOneRequest, signal: AbortSignal) =>
          new Promise<JevAssistantResponse>((_resolve, reject) => {
            signal.addEventListener("abort", () => reject(new Error("aborted")), { once: true });
          }),
      ),
    });
    expect(await (await timedOut(makeRequest(requestBody))).json()).toEqual({ status: "hide" });
  });

  it("rejects malformed JSON and request bodies before calling Jev", async () => {
    const requestJev = vi.fn(async () => makeJevOutput());
    const handler = makeHandler({ requestJev });

    const badJsonResponse = await handler(makeRequest("{"));
    expect(badJsonResponse.status).toBe(400);
    expect(await badJsonResponse.json()).toEqual({ error: "invalid_json" });

    const invalidPayloadResponse = await handler(makeRequest({ ...requestBody, events: [{ type: "rage_click" }] }));
    expect(invalidPayloadResponse.status).toBe(400);
    expect(await invalidPayloadResponse.json()).toEqual({ error: "invalid_payload" });
    expect(requestJev).not.toHaveBeenCalled();
  });

  it("returns hide on the 31st request from one IP before calling Jev", async () => {
    const requestJev = vi.fn(async () => makeJevOutput());
    const handler = makeHandler({ requestJev }, { perIp: 30, process: 100 });

    let lastResponse: Response | undefined;
    for (let index = 0; index < 31; index += 1) {
      lastResponse = await handler(makeRequest(requestBody, { "x-forwarded-for": "192.0.2.7" }));
    }

    expect(lastResponse?.status).toBe(200);
    expect(await lastResponse?.json()).toEqual({ status: "hide" });
    expect(requestJev).toHaveBeenCalledTimes(30);
  });

  it("returns hide on the 11th request in one process across different IPs", async () => {
    const requestJev = vi.fn(async () => makeJevOutput());
    const handler = makeHandler({ requestJev }, { perIp: 30, process: 10 });

    let lastResponse: Response | undefined;
    for (let index = 0; index < 11; index += 1) {
      lastResponse = await handler(makeRequest(requestBody, { "x-forwarded-for": `192.0.2.${index + 1}` }));
    }

    expect(lastResponse?.status).toBe(200);
    expect(await lastResponse?.json()).toEqual({ status: "hide" });
    expect(requestJev).toHaveBeenCalledTimes(10);
  });
});
