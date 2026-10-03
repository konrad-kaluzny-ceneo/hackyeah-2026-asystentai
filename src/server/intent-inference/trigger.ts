import type { MetaEvent } from "@/behavior/types";
import { saveIntentSnapshot, type SaveIntentSnapshotResult } from "./service";
import {
  buildJevIntentRequest,
  JEV_INTENT_EVENT_LIMIT,
  requestJevIntent,
  type JevIntentRequest,
  type JevIntentResponse,
} from "./jev-intent-client";
import {
  IntentSnapshotInputSchema,
  type ValidatedIntentSnapshot,
} from "./validation";
import type { Database } from "@/lib/db/client";

export const INTENT_ALGORITHM_VERSION = "intent-inference-v1";
export const INTENT_INFERENCE_TIMEOUT_MS = 3_000;
export const MIN_JEV_INTENT_EVENTS = JEV_INTENT_EVENT_LIMIT;

type RequestJevIntent = (
  request: JevIntentRequest,
  signal: AbortSignal,
) => Promise<JevIntentResponse>;

type TriggerOptions = Readonly<{
  db?: Database;
  requestJev?: RequestJevIntent;
  now?: () => Date;
  createSnapshotId?: () => string;
}>;

/** Runs one bounded JEV intent classification and persists its validated snapshot. */
export async function inferAndSaveIntentSnapshot(
  events: readonly MetaEvent[],
  options: TriggerOptions = {},
): Promise<SaveIntentSnapshotResult> {
  if (events.length === 0) {
    throw new Error("At least one MetaEvent is required for intent inference");
  }
  if (events.length < MIN_JEV_INTENT_EVENTS) {
    throw new Error(
      `At least ${MIN_JEV_INTENT_EVENTS} MetaEvents are required for intent inference`,
    );
  }

  const sessionId = events[0]?.identity.sessionId;
  if (sessionId === undefined || events.some((event) => event.identity.sessionId !== sessionId)) {
    throw new Error("Intent inference requires MetaEvents from one session");
  }

  const orderedEvents = [...events].sort(
    (first, second) => Date.parse(first.detectedAt) - Date.parse(second.detectedAt),
  );
  const inputEvents = orderedEvents.slice(-JEV_INTENT_EVENT_LIMIT);
  const requestJev = options.requestJev ?? requestJevIntent;
  const response = await requestJev(
    buildJevIntentRequest(sessionId, inputEvents),
    AbortSignal.timeout(INTENT_INFERENCE_TIMEOUT_MS),
  );
  const computedAt = (options.now ?? (() => new Date()))().toISOString();
  const snapshot = IntentSnapshotInputSchema.parse({
    snapshotId: options.createSnapshotId?.() ?? crypto.randomUUID(),
    sessionId,
    computedAt,
    model: response.model,
    intents: response.answers.intents.probabilities,
    inputEventWindow: {
      windowStartedAt: inputEvents[0]?.window.startedAt,
      windowEndedAt: inputEvents.at(-1)?.window.endedAt,
      eventCount: inputEvents.length,
    },
    algorithmVersion: INTENT_ALGORITHM_VERSION,
  }) satisfies ValidatedIntentSnapshot;

  return saveIntentSnapshot(snapshot, { db: options.db });
}
