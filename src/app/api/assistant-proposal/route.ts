import { NextResponse, type NextRequest } from "next/server";

import {
  AssistantProposalRequestSchema,
  AssistantProposalResponseSchema,
} from "@/lib/assistant-proposal-api";
import { InMemoryRateLimiter } from "@/server/meta-events/rate-limit";
import { requestJev } from "@/server/assistant-proposal/jev-client";
import {
  generateProposalWithOpenAiStub,
  type AssistantDraft,
} from "@/server/assistant-proposal/openai-stub";
import { buildAssistantPrompt } from "@/server/assistant-proposal/prompt";
import { routeJevOutput } from "@/server/assistant-proposal/route-decision";
import { JevAssistantOutputSchema } from "@/server/assistant-proposal/schema";

// 30 requests per 60 seconds per IP, 10 requests per 60 seconds per process
export const IP_LIMIT = 30;
export const PROCESS_LIMIT = 10;
export const WINDOW_MS = 60_000;
export const JEV_TIMEOUT_MS = 3000;
export const MAX_REQUEST_BODY_BYTES = 64 * 1024;

export let ipLimiter = new InMemoryRateLimiter(IP_LIMIT, WINDOW_MS);
export let processLimiter = new InMemoryRateLimiter(PROCESS_LIMIT, WINDOW_MS);

export function resetLimitersForTest(): void {
  ipLimiter = new InMemoryRateLimiter(IP_LIMIT, WINDOW_MS);
  processLimiter = new InMemoryRateLimiter(PROCESS_LIMIT, WINDOW_MS);
}

export function extractClientKey(request: NextRequest): string {
  const fwd = request.headers.get("x-forwarded-for");
  if (fwd !== null && fwd.length > 0) {
    const first = fwd.split(",", 1)[0].trim();
    if (first.length > 0) return first;
  }
  const real = request.headers.get("x-real-ip");
  if (real !== null && real.length > 0) {
    return real;
  }
  return "anonymous";
}

export async function POST(request: NextRequest): Promise<Response> {
  // 1. Check rate limits before calling any model
  const clientKey = extractClientKey(request);
  const ipRate = ipLimiter.check(clientKey);
  const processRate = processLimiter.check("global_process");

  if (!ipRate.allowed || !processRate.allowed) {
    return hide();
  }

  // 2. Enforce a byte ceiling before decoding or parsing untrusted JSON.
  let bodyUnknown: unknown;
  try {
    const bodyText = await readRequestBody(request);
    if (bodyText === null) return hide();
    bodyUnknown = JSON.parse(bodyText);
  } catch {
    return hide();
  }

  const parsedRequest = AssistantProposalRequestSchema.safeParse(bodyUnknown);
  if (!parsedRequest.success) {
    return hide();
  }

  // 3. Compose prompt & call Jev with 3-second abort signal
  let rawJevOutput: unknown;
  try {
    const prompt = buildAssistantPrompt(parsedRequest.data);
    const signal = AbortSignal.timeout(JEV_TIMEOUT_MS);
    rawJevOutput = await requestJev(prompt, signal);
  } catch {
    return hide();
  }

  // 4. Validate Jev output schema
  const parsedJev = JevAssistantOutputSchema.safeParse(rawJevOutput);
  if (!parsedJev.success) {
    return hide();
  }

  // 5. Evaluate route decision
  const decision = routeJevOutput(parsedJev.data);
  if (decision.decision === "hide") {
    return hide();
  }

  // This local deterministic stub stands in for the future OpenAI call.
  let draft: AssistantDraft;
  try {
    draft = await generateProposalWithOpenAiStub(parsedJev.data);
  } catch {
    return hide();
  }

  const parsedResponse = AssistantProposalResponseSchema.safeParse({
    status: "show",
    kind: "jev_proposal",
    situation: decision.situation,
    ...draft,
    action: "narrow-choice",
    actionLabel: "Przejdź do filtrów",
  });
  if (!parsedResponse.success) return hide();

  return NextResponse.json(parsedResponse.data, { status: 200 });
}

function hide(): Response {
  return NextResponse.json({ status: "hide" }, { status: 200 });
}

async function readRequestBody(request: NextRequest): Promise<string | null> {
  const contentLength = request.headers.get("content-length");
  if (contentLength !== null) {
    const declaredBytes = Number(contentLength);
    if (
      Number.isFinite(declaredBytes) &&
      declaredBytes > MAX_REQUEST_BODY_BYTES
    ) {
      return null;
    }
  }

  const reader = request.body?.getReader();
  if (reader === undefined) return null;

  const chunks: Uint8Array[] = [];
  let totalBytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      totalBytes += value.byteLength;
      if (totalBytes > MAX_REQUEST_BODY_BYTES) {
        await reader.cancel();
        return null;
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const bodyBytes = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    bodyBytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder("utf-8", { fatal: true }).decode(bodyBytes);
}
