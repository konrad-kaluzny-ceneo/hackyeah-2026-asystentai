import { NextResponse, type NextRequest } from "next/server";

import {
  AssistantProposalRequestSchema,
  type AssistantProposalResponse,
} from "@/lib/assistant-proposal-api";
import type { CategoryFilter } from "@/lib/catalog-types";
import { getCategoryFilters } from "@/server/assistant-proposal/category-filters";
import { composeProposal } from "@/server/assistant-proposal/compose";
import { InMemoryRateLimiter } from "@/server/meta-events/rate-limit";
import { buildAssistantPrompt } from "@/server/assistant-proposal/prompt";

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

async function readAvailableFilters(
  categorySlug: string | null,
): Promise<CategoryFilter[]> {
  if (!categorySlug) return [];

  try {
    return await getCategoryFilters(categorySlug);
  } catch (error) {
    console.warn(
      JSON.stringify({
        component: "assistant-proposal",
        action: "category_filters_unavailable",
        error: error instanceof Error ? error.message : "unknown",
      }),
    );
    return [];
  }
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

  // 3. Compose the proposal through Jev and, when needed, OpenAI
  const availableFilters = await readAvailableFilters(
    parsedRequest.data.state.categorySlug,
  );
  const prompt = buildAssistantPrompt(parsedRequest.data, availableFilters);
  const signal = AbortSignal.timeout(JEV_TIMEOUT_MS);
  const proposal = await composeProposal(
    prompt,
    signal,
    availableFilters,
  );
  return NextResponse.json(proposal, { status: 200 });
}
