import { describe, expect, it } from "vitest";

import { buildIntentTimeline } from "@/server/intent-inference/read-service";
import {
  buildStackedIntentSeries,
  emptyIntentProbabilities,
} from "@/lib/intent-timeline";
import type { IntentProbabilities } from "@/domain/shopping-intent";

const NOW = Date.parse("2026-10-03T12:00:30.000Z");

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
