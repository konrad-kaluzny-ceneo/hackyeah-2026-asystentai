import { and, asc, eq, lte } from "drizzle-orm";

import {
  INTENT_DEFINITIONS,
  INTENT_TIMELINE_WINDOW_SECONDS,
  emptyIntentProbabilities,
  type IntentAnnotation,
  type IntentTimelineResponse,
} from "@/lib/intent-timeline";
import { getDb, type Database } from "@/lib/db/client";
import {
  sessionIntentSnapshots,
  type SessionIntentSnapshotRow,
} from "@/lib/db/schema";
import {
  SHOPPING_INTENT_KINDS,
  type IntentProbabilities,
  type ShoppingIntentKind,
} from "@/domain/shopping-intent";

export async function getIntentTimeline(
  sessionId: string,
  options: {
    db?: Database;
    now?: number;
    windowSeconds?: typeof INTENT_TIMELINE_WINDOW_SECONDS;
  } = {},
): Promise<IntentTimelineResponse> {
  const db = options.db ?? getDb();
  const now = options.now ?? Date.now();
  const snapshots = await db
    .select()
    .from(sessionIntentSnapshots)
    .where(
      and(
        eq(sessionIntentSnapshots.sessionId, sessionId),
        lte(sessionIntentSnapshots.computedAt, new Date(now)),
      ),
    )
    .orderBy(asc(sessionIntentSnapshots.computedAt));

  return buildIntentTimeline(
    snapshots,
    now,
    options.windowSeconds ?? INTENT_TIMELINE_WINDOW_SECONDS,
  );
}

export function buildIntentTimeline(
  snapshots: readonly Pick<
    SessionIntentSnapshotRow,
    "computedAt" | "intents" | "model"
  >[],
  now = Date.now(),
  windowSeconds: typeof INTENT_TIMELINE_WINDOW_SECONDS =
    INTENT_TIMELINE_WINDOW_SECONDS,
): IntentTimelineResponse {
  const currentEpochSecond = Math.floor(now / 1000);
  const windowStartEpochSecond = currentEpochSecond - windowSeconds;
  const windowEndEpochSecond = currentEpochSecond;
  const orderedSnapshots = [...snapshots]
    .filter(({ computedAt }) => computedAt.getTime() <= now)
    .sort((left, right) => left.computedAt.getTime() - right.computedAt.getTime());

  let snapshotIndex = 0;
  let current = emptyIntentProbabilities();
  const pointsByIntent = new Map<ShoppingIntentKind, Array<{ second: number; value: number }>>(
    SHOPPING_INTENT_KINDS.map((kind) => [kind, []]),
  );

  for (
    let epochSecond = windowStartEpochSecond;
    epochSecond <= windowEndEpochSecond;
    epochSecond += 1
  ) {
    while (
      snapshotIndex < orderedSnapshots.length &&
      Math.floor(orderedSnapshots[snapshotIndex].computedAt.getTime() / 1000) <= epochSecond
    ) {
      current = normalizeProbabilities(orderedSnapshots[snapshotIndex].intents);
      snapshotIndex += 1;
    }
    for (const kind of SHOPPING_INTENT_KINDS) {
      pointsByIntent.get(kind)?.push({
        second: epochSecond - windowStartEpochSecond,
        value: current[kind],
      });
    }
  }

  const annotations = orderedSnapshots
    .filter(({ computedAt }) => {
      const epochSecond = Math.floor(computedAt.getTime() / 1000);
      return (
        epochSecond >= windowStartEpochSecond &&
        epochSecond <= windowEndEpochSecond
      );
    })
    .map(({ computedAt, intents, model }) => {
      const intentId = strongestIntent(intents);
      return {
        second:
          Math.floor(computedAt.getTime() / 1000) - windowStartEpochSecond,
        intentId,
        comment: `${model}: ${intentId} ${normalizeProbabilities(intents)[intentId].toFixed(2)}`,
      } satisfies IntentAnnotation;
    });

  return {
    schemaVersion: "2.0",
    source: orderedSnapshots.length > 0 ? "jev" : "empty",
    windowSeconds,
    currentSecond: windowSeconds,
    windowStartSecond: 0,
    windowEndSecond: windowSeconds,
    generatedAt: new Date(now).toISOString(),
    series: INTENT_DEFINITIONS.map((definition) => ({
      ...definition,
      points: pointsByIntent.get(definition.id) ?? [],
    })),
    annotations,
  };
}

function normalizeProbabilities(
  intents: IntentProbabilities,
): Record<ShoppingIntentKind, number> {
  const normalized = emptyIntentProbabilities();
  for (const kind of SHOPPING_INTENT_KINDS) {
    const value = intents[kind];
    normalized[kind] = Number.isFinite(value)
      ? Math.max(0, Math.min(1, value))
      : 0;
  }
  return normalized;
}

function strongestIntent(intents: IntentProbabilities): ShoppingIntentKind {
  const normalized = normalizeProbabilities(intents);
  return SHOPPING_INTENT_KINDS.reduce((strongest, candidate) =>
    normalized[candidate] > normalized[strongest] ? candidate : strongest,
  );
}
