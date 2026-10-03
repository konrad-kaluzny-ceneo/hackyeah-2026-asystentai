import { NextResponse, type NextRequest } from "next/server";

import {
  AssistantProposalRequestSchema,
  type AssistantProposalResponse,
} from "@/lib/assistant-proposal-api";
import { composeProposal } from "@/server/assistant-proposal/compose";
import { buildAssistantPrompt } from "@/server/assistant-proposal/prompt";
import { InMemoryRateLimiter } from "@/server/meta-events/rate-limit";

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
  const clientKey = extractClientKey(request);
  const ipRate = ipLimiter.check(clientKey);
  const processRate = processLimiter.check("global_process");
  if (!ipRate.allowed || !processRate.allowed) return hide();

  let bodyUnknown: unknown;
  try {
    const bodyText = await readRequestBody(request);
    if (bodyText === null) return hide();
    bodyUnknown = JSON.parse(bodyText);
  } catch {
    return hide();
  }

  const parsedRequest = AssistantProposalRequestSchema.safeParse(bodyUnknown);
  if (!parsedRequest.success) return hide();

  const prompt = buildAssistantPrompt(parsedRequest.data);
  const jevSignal = AbortSignal.timeout(JEV_TIMEOUT_MS);
  const proposal = await composeProposal(
    prompt,
    jevSignal,
    request.signal,
  );
  return NextResponse.json(proposal, { status: 200 });
}

function hide(): Response {
  const response: AssistantProposalResponse = { status: "hide" };
  return NextResponse.json(response, { status: 200 });
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
