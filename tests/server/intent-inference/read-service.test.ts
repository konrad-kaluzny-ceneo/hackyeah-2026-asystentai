import { describe, expect, it, vi } from "vitest";

import { buildIntentTimeline, getLatestIntentSnapshot } from "@/server/intent-inference/read-service";
import type { Database } from "@/lib/db/client";
import { PgDialect } from "drizzle-orm/pg-core";
import {
  buildStackedIntentSeries,
  emptyIntentProbabilities,
} from "@/lib/intent-timeline";
import type { IntentProbabilities } from "@/domain/shopping-intent";

const NOW = Date.parse("2026-10-03T12:00:30.000Z");

describe("getLatestIntentSnapshot", () => {
  it.each([true, false])("reads one fresh snapshot for the specified session (present: %s)", async (present) => {
    const snapshot = { computedAt: new Date(NOW), intents: { ...emptyIntentProbabilities(), researching: 0.7 } };
    const query = {
      select: vi.fn().mockReturnThis(), from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(), orderBy: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue(present ? [snapshot] : []),
    };
    expect(await getLatestIntentSnapshot("research-session", { db: query as unknown as Database, now: NOW }))
      .toEqual(present ? snapshot : null);
    expect(query.limit).toHaveBeenCalledWith(1);
    const dialect = new PgDialect();
    const filter = dialect.sqlToQuery(query.where.mock.calls[0][0]);
    expect(filter.params).toEqual([
      "research-session", new Date(NOW - 120_000).toISOString(), new Date(NOW).toISOString(),
    ]);
    expect(dialect.sqlToQuery(query.orderBy.mock.calls[0][0]).sql).toContain("desc");
  });
});

function makeSnapshot(
  secondsAgo: number,
  intents: Partial<IntentProbabilities>,
  model = "jev-latest",
) {
  return {
    computedAt: new Date(NOW - secondsAgo * 1000),
    intents: { ...emptyIntentProbabilities(), ...intents },
    model,
  };
}

describe("buildIntentTimeline", () => {
  it("forward-fills the latest JEV state until the next snapshot", () => {
    const timeline = buildIntentTimeline([
      makeSnapshot(25, { exploring: 0.4 }),
      makeSnapshot(10, { overloaded: 0.8 }),
    ], NOW);
    const exploring = timeline.series.find(({ id }) => id === "exploring");
    const overloaded = timeline.series.find(({ id }) => id === "overloaded");
    const pointAt = (series: typeof exploring, second: number) =>
      series?.points.find((point) => point.second === second)?.value;

    expect(timeline.source).toBe("jev");
    expect(timeline.windowStartSecond).toBe(0);
    expect(timeline.windowEndSecond).toBe(30);
    expect(pointAt(exploring, 19)).toBe(0.4);
    expect(pointAt(exploring, 20)).toBe(0);
    expect(pointAt(overloaded, 19)).toBe(0);
    expect(pointAt(overloaded, 20)).toBe(0.8);
    expect(pointAt(overloaded, 30)).toBe(0.8);

    const stacked = buildStackedIntentSeries(timeline.series);
    expect(stacked).toHaveLength(8);
    expect(stacked.every(({ points }) => points.length === 31)).toBe(true);
    expect(stacked.find(({ id }) => id === "exploring")?.points[19]).toMatchObject({
      lower: 0,
      upper: 0.4,
    });
  });

  it("returns a zero-filled window when there are no snapshots", () => {
    const timeline = buildIntentTimeline([], NOW);

    expect(timeline.source).toBe("empty");
    expect(timeline.series).toHaveLength(8);
    expect(timeline.series.flatMap(({ points }) => points).every(({ value }) => value === 0)).toBe(true);
  });

  it("ignores snapshots computed after now", () => {
    const timeline = buildIntentTimeline([
      makeSnapshot(-1, { ready_to_buy: 1 }),
    ], NOW);

    expect(timeline.source).toBe("empty");
    expect(timeline.annotations).toHaveLength(0);
  });
});
