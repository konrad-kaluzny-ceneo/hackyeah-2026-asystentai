import { NextResponse } from "next/server";

import {
  AssistantProposalRequestSchema,
  AssistantProposalResponseSchema,
  type MetaEventsAssistantProposalRequest,
} from "@/lib/assistant-proposal-api";
import { buildAssistantProposalContext } from "@/server/assistant-proposal/context";
import { createAssistantProposalHandler } from "@/server/assistant-proposal/handler";
import * as jevClient from "@/server/assistant-proposal/jev-client";
import * as proposalStub from "@/server/assistant-proposal/openai-stub";
import { buildAssistantPrompt } from "@/server/assistant-proposal/prompt";
import { InMemoryRateLimiter } from "@/server/meta-events/rate-limit";
import { routeJevOutput } from "@/server/assistant-proposal/route-decision";
import { JevAssistantOutputSchema } from "@/server/assistant-proposal/schema";

const RATE_WINDOW_MS = 60_000;
export const IP_LIMIT = 30;
export const PROCESS_LIMIT = 10;
export const MAX_REQUEST_BODY_BYTES = 64 * 1024;

export let ipLimiter = new InMemoryRateLimiter(IP_LIMIT, RATE_WINDOW_MS);
export let processLimiter = new InMemoryRateLimiter(PROCESS_LIMIT, RATE_WINDOW_MS);

function createCatalogPost(): (request: Request) => Promise<Response> {
  return createAssistantProposalHandler({
    perIpRateLimiter: ipLimiter,
    processRateLimiter: processLimiter,
    loadContext: buildAssistantProposalContext,
    requestJev: (request, signal) => jevClient.requestJev(request, signal),
  });
}

let catalogPost = createCatalogPost();

export function resetLimitersForTest(): void {
  ipLimiter = new InMemoryRateLimiter(IP_LIMIT, RATE_WINDOW_MS);
  processLimiter = new InMemoryRateLimiter(PROCESS_LIMIT, RATE_WINDOW_MS);
  catalogPost = createCatalogPost();
}

export async function POST(request: Request): Promise<Response> {
  if (!withinBodyLimit(request)) return hide();

  let body: unknown;
  try {
    body = await request.clone().json();
  } catch {
    return hide();
  }

  if (hasMetaEventsField(body)) {
    return postMetaEvents(request, body);
  }
  return catalogPost(request);
}

async function postMetaEvents(
  request: Request,
  body: unknown,
): Promise<Response> {
  if (!withinBodyLimit(request)) return hide();

  const ipResult = ipLimiter.check(extractClientKey(request));
  const processResult = processLimiter.check("process");
  if (!ipResult.allowed || !processResult.allowed) return hide();

  const parsedRequest = AssistantProposalRequestSchema.safeParse(body);
  if (!parsedRequest.success || !isMetaEventsRequest(parsedRequest.data)) {
    return hide();
  }

  try {
    const prompt = buildAssistantPrompt(parsedRequest.data);
    const jevOutput = await jevClient.requestJev(
      prompt,
      AbortSignal.timeout(3_000),
    );
    const parsedJev = JevAssistantOutputSchema.safeParse(jevOutput);
    if (!parsedJev.success) return hide();

    const decision = routeJevOutput(parsedJev.data);
    if (decision.decision !== "generate_proposal") return hide();

    const draft = await proposalStub.generateProposalWithOpenAiStub(
      parsedJev.data,
    );
    const response = AssistantProposalResponseSchema.safeParse({
      status: "show",
      kind: "jev_proposal",
      situation: decision.situation,
      ...draft,
      action: "narrow-choice",
      actionLabel: "Przejdź do filtrów",
    });
    return response.success ? NextResponse.json(response.data) : hide();
  } catch {
    return hide();
  }
}

function isMetaEventsRequest(
  value: unknown,
): value is MetaEventsAssistantProposalRequest {
  return typeof value === "object" && value !== null && "metaEvents" in value;
}

function hasMetaEventsField(value: unknown): boolean {
  return isMetaEventsRequest(value);
}

function withinBodyLimit(request: Request): boolean {
  const contentLength = request.headers.get("content-length");
  if (contentLength === null) return true;
  const bytes = Number(contentLength);
  return !Number.isFinite(bytes) || bytes <= MAX_REQUEST_BODY_BYTES;
}

function extractClientKey(request: Request): string {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor !== null && forwardedFor.length > 0) {
    return forwardedFor.split(",", 1)[0]?.trim() || "anonymous";
  }
  return request.headers.get("x-real-ip")?.trim() || "anonymous";
}

function hide(): Response {
  return NextResponse.json({ status: "hide" });
}
