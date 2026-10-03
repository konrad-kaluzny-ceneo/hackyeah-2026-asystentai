import {
  AssistantProposalRequestSchema,
  type AssistantProposalRequest,
  type AssistantProposalResponse,
} from "@/lib/assistant-proposal-api";
import { InMemoryRateLimiter } from "@/server/meta-events/rate-limit";
import type { AssistantProposalContext } from "@/server/assistant-proposal/context";
import { buildJevRequest, type JevSystemOneRequest } from "@/server/assistant-proposal/jev-client";
import { routeJevOutput } from "@/server/assistant-proposal/route-decision";
import type { JevAssistantResponse } from "@/server/assistant-proposal/schema";

const HIDE_RESPONSE: AssistantProposalResponse = { status: "hide" };
const DEFAULT_JEV_TIMEOUT_MS = 3_000;

export type AssistantProposalHandlerDependencies = {
  readonly perIpRateLimiter: InMemoryRateLimiter;
  readonly processRateLimiter: InMemoryRateLimiter;
  readonly loadContext: (request: AssistantProposalRequest) => Promise<AssistantProposalContext>;
  readonly requestJev: (
    request: JevSystemOneRequest,
    signal: AbortSignal,
  ) => Promise<JevAssistantResponse>;
  readonly jevTimeoutMs?: number;
};

export function createAssistantProposalHandler(
  dependencies: AssistantProposalHandlerDependencies,
): (request: Request) => Promise<Response> {
  const timeoutMs = dependencies.jevTimeoutMs ?? DEFAULT_JEV_TIMEOUT_MS;

  return async function POST(request: Request): Promise<Response> {
    const processLimit = dependencies.processRateLimiter.check("process");
    const ipLimit = dependencies.perIpRateLimiter.check(extractClientKey(request));
    if (!processLimit.allowed || !ipLimit.allowed) {
      return Response.json(HIDE_RESPONSE);
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return Response.json({ error: "invalid_json" }, { status: 400 });
    }

    const parsedRequest = AssistantProposalRequestSchema.safeParse(body);
    if (!parsedRequest.success) {
      return Response.json({ error: "invalid_payload" }, { status: 400 });
    }

    try {
      const context = await dependencies.loadContext(parsedRequest.data);
      const jevRequest = buildJevRequest(context);
      if (jevRequest === null || context.category === null) {
        return Response.json(HIDE_RESPONSE);
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
      let jevOutput: JevAssistantResponse;
      try {
        jevOutput = await dependencies.requestJev(jevRequest, controller.signal);
      } finally {
        clearTimeout(timeoutId);
      }

      const decision = routeJevOutput(
        jevOutput,
        context.category.specFilters.map(({ key }) => key),
      );
      if (decision.kind !== "shortcut") {
        return Response.json(HIDE_RESPONSE);
      }

      const filter = context.category.specFilters.find(
        ({ key }) => key === decision.filterKey,
      );
      if (filter === undefined) {
        return Response.json(HIDE_RESPONSE);
      }

      return Response.json({
        status: "show",
        kind: "decision_fatigue",
        title: "Pomóc zawęzić wybór?",
        message: `Wybierz filtr „${filter.label}”, aby zawęzić wyniki.`,
        action: "narrow-choice",
        actionLabel: "Przejdź do filtrów",
      } satisfies AssistantProposalResponse);
    } catch {
      return Response.json(HIDE_RESPONSE);
    }
  };
}

function extractClientKey(request: Request): string {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor !== null && forwardedFor.length > 0) {
    const firstAddress = forwardedFor.split(",", 1)[0]?.trim();
    if (firstAddress) return firstAddress;
  }

  const realIp = request.headers.get("x-real-ip")?.trim();
  return realIp || "anonymous";
}
