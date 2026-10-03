import { NextResponse, type NextRequest } from "next/server";

import {
  AssistantProposalRequestSchema,
  type AssistantProposalResponse,
} from "@/lib/assistant-proposal-api";
import { InMemoryRateLimiter } from "@/server/meta-events/rate-limit";
import { requestJev } from "@/server/assistant-proposal/jev-client";
import { buildAssistantPrompt } from "@/server/assistant-proposal/prompt";
import { routeJevOutput } from "@/server/assistant-proposal/route-decision";
import { JevAssistantOutputSchema } from "@/server/assistant-proposal/schema";

// 30 requests per 60 seconds per IP, 10 requests per 60 seconds per process
export const IP_LIMIT = 30;
export const PROCESS_LIMIT = 10;
export const WINDOW_MS = 60_000;
export const JEV_TIMEOUT_MS = 3000;

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
    const hideResponse: AssistantProposalResponse = { status: "hide" };
    return NextResponse.json(hideResponse, { status: 200 });
  }

  // 2. Parse & validate request body
  let bodyUnknown: unknown;
  try {
    bodyUnknown = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const parsedRequest = AssistantProposalRequestSchema.safeParse(bodyUnknown);
  if (!parsedRequest.success) {
    return NextResponse.json(
      { error: "validation_failed", issues: parsedRequest.error.issues },
      { status: 400 },
    );
  }

  // 3. Compose prompt & call Jev with 3-second abort signal
  const prompt = buildAssistantPrompt(parsedRequest.data);

  let rawJevOutput: unknown;
  try {
    const signal = AbortSignal.timeout(JEV_TIMEOUT_MS);
    rawJevOutput = await requestJev(prompt, signal);
  } catch {
    const hideResponse: AssistantProposalResponse = { status: "hide" };
    return NextResponse.json(hideResponse, { status: 200 });
  }

  // 4. Validate Jev output schema
  const parsedJev = JevAssistantOutputSchema.safeParse(rawJevOutput);
  if (!parsedJev.success) {
    const hideResponse: AssistantProposalResponse = { status: "hide" };
    return NextResponse.json(hideResponse, { status: 200 });
  }

  // 5. Evaluate route decision
  const decision = routeJevOutput(parsedJev.data);
  if (decision.decision === "shortcut") {
    const showResponse: AssistantProposalResponse = {
      status: "show",
      kind: "decision_fatigue",
      title: "Pomóc zawęzić wybór?",
      message: decision.message,
      action: "narrow-choice",
      actionLabel: "Przejdź do filtrów",
    };
    return NextResponse.json(showResponse, { status: 200 });
  }

  // Phase 1: needs_openai returns hide (OpenAI branch added in Phase 2)
  const hideResponse: AssistantProposalResponse = { status: "hide" };
  return NextResponse.json(hideResponse, { status: 200 });
}
