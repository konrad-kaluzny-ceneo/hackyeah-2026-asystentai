import { z } from "zod";

import {
  SHOPPING_INTENT_KINDS,
  type ShoppingIntentKind,
} from "@/domain/shopping-intent";
import type { MetaEvent } from "@/behavior/types";

const DEFAULT_TYPESAFE_API_URL = "https://api.typesafe.ai/v1/systemone";
export const JEV_INTENT_MODEL = "jev-latest" as const;
export const JEV_INTENT_EVENT_LIMIT = 10;

export type JevIntentRequest = Readonly<{
  model: typeof JEV_INTENT_MODEL;
  state: Readonly<{
    sessionId: string;
    recentMetaEvents: readonly Record<string, unknown>[];
  }>;
  questions: Readonly<{
    intents: Readonly<{
      type: "choice";
      instructions: string;
      criteria: Readonly<Record<ShoppingIntentKind, string>>;
    }>;
  }>;
}>;

const ProbabilitySchema = z.number().finite().min(0).max(1);
const ProbabilitiesSchema = z.object(
  Object.fromEntries(
    SHOPPING_INTENT_KINDS.map((kind) => [kind, ProbabilitySchema]),
  ) as Record<ShoppingIntentKind, typeof ProbabilitySchema>,
).strict();

const JevIntentResponseSchema = z.object({
  model: z.string().min(1),
  answers: z.object({
    intents: z.object({
      type: z.literal("choice"),
      choice: z.string().trim().min(1).max(128).optional(),
      confidence: ProbabilitySchema,
      probabilities: ProbabilitiesSchema,
    }).strict(),
  }).strict(),
  usage: z.object({
    input_tokens: z.number().int().nonnegative(),
    output_tokens: z.number().int().nonnegative(),
  }).strict(),
}).strict();

export type JevIntentResponse = z.infer<typeof JevIntentResponseSchema>;

export function buildJevIntentRequest(
  sessionId: string,
  events: readonly MetaEvent[],
): JevIntentRequest {
  return {
    model: JEV_INTENT_MODEL,
    state: {
      sessionId,
      recentMetaEvents: events.slice(-JEV_INTENT_EVENT_LIMIT).map(safeMetaEvent),
    },
    questions: {
      intents: {
        type: "choice",
        instructions:
          "For the supplied session events, estimate the probability from 0 to 1 for every shopping intent. Return all eight probabilities; do not infer emotions or personality.",
        criteria: {
          exploring: "The shopper is broadly discovering the catalog or categories.",
          researching: "The shopper is gathering information and inspecting details.",
          comparing: "The shopper is weighing multiple products or alternatives.",
          deciding: "The shopper is narrowing the choice toward a decision.",
          ready_to_buy: "The shopper shows strong signs of purchase readiness.",
          price_sensitive: "Price or cost is a prominent constraint in the behavior.",
          overloaded: "The shopper appears burdened by too many choices or signals.",
          hesitant: "The shopper repeatedly delays, reverses, or avoids committing.",
        },
      },
    },
  };
}

export function parseJevIntentResponse(payload: unknown): JevIntentResponse {
  return JevIntentResponseSchema.parse(payload);
}

export async function requestJevIntent(
  request: JevIntentRequest,
  signal: AbortSignal,
): Promise<JevIntentResponse> {
  const apiKey = process.env.TYPESAFE_API_KEY;
  if (apiKey === undefined || apiKey.trim().length === 0) {
    throw new Error("TYPESAFE_API_KEY is not configured");
  }

  const endpoint = process.env.TYPESAFE_API_URL ?? DEFAULT_TYPESAFE_API_URL;
  logLine({
    action: "request_sent",
    model: request.model,
    eventCount: request.state.recentMetaEvents.length,
    endpoint,
  });

  let response: Response;
  try {
    response = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(request),
      signal,
    });
  } catch (error) {
    logLine({ action: "request_failed", error: errorMessage(error) });
    throw error;
  }
  if (!response.ok) {
    logLine({
      action: "response_received",
      ok: false,
      status: response.status,
    });
    throw new Error(`TypeSafe returned HTTP ${response.status}`);
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch (error) {
    logLine({ action: "response_invalid", error: errorMessage(error) });
    throw new Error("TypeSafe returned invalid JSON");
  }
  try {
    const parsed = parseJevIntentResponse(payload);
    logLine({
      action: "response_received",
      ok: true,
      status: response.status,
      model: parsed.model,
      confidence: parsed.answers.intents.confidence,
      inputTokens: parsed.usage.input_tokens,
      outputTokens: parsed.usage.output_tokens,
    });
    return parsed;
  } catch (error) {
    logLine({ action: "response_invalid", error: errorMessage(error) });
    throw error;
  }
}

function logLine(fields: Record<string, unknown>): void {
  console.log(JSON.stringify({ component: "jev-intent", ...fields }));
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "unknown";
}

function safeMetaEvent(event: MetaEvent): Record<string, unknown> {
  return {
    eventId: event.eventId,
    name: event.name,
    detectedAt: event.detectedAt,
    window: event.window,
    page: event.page,
    subject: event.subject,
    ecommerce: event.ecommerce,
    metrics: event.metrics,
    quality: {
      strength: event.quality.strength,
      evidenceCount: event.quality.evidenceCount,
      algorithmVersion: event.quality.algorithmVersion,
      partialData: event.quality.partialData,
    },
  };
}
