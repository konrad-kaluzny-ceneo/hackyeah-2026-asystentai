import { buildAssistantProposalContext } from "@/server/assistant-proposal/context";
import { createAssistantProposalHandler } from "@/server/assistant-proposal/handler";
import { requestJev } from "@/server/assistant-proposal/jev-client";
import { InMemoryRateLimiter } from "@/server/meta-events/rate-limit";

const RATE_WINDOW_MS = 60_000;
const perIpRateLimiter = new InMemoryRateLimiter(30, RATE_WINDOW_MS);
const processRateLimiter = new InMemoryRateLimiter(10, RATE_WINDOW_MS);

export const POST = createAssistantProposalHandler({
  perIpRateLimiter,
  processRateLimiter,
  loadContext: buildAssistantProposalContext,
  requestJev,
});
