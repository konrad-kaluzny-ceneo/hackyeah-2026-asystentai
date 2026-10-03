import { describe, expect, it } from "vitest";

import { GET } from "@/app/api/emotions-timeline/route";
import {
  chartX,
  chartY,
  shortenComment,
} from "@/behavior/ui/EmotionTimelineChart";
import {
  EMOTION_DEFINITIONS,
  EMOTION_VISIBILITY_THRESHOLD,
  EMOTION_WINDOW_SECONDS,
  buildMockEmotionTimeline,
  buildStackedEmotionSeries,
} from "@/behavior/ui/emotion-timeline";

describe("GET /api/emotions-timeline", () => {
  it("returns 9 colored series with points only through the current second", async () => {
    const response = GET();
    const json = (await response.json()) as ReturnType<
      typeof buildMockEmotionTimeline
    >;

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(json.windowSeconds).toBe(EMOTION_WINDOW_SECONDS);
    expect(json.series).toHaveLength(EMOTION_DEFINITIONS.length);
    expect(new Set(json.series.map((emotion) => emotion.color)).size).toBe(
      EMOTION_DEFINITIONS.length,
    );
    expect(json.windowStartSecond).toBe(0);
    expect(json.windowEndSecond).toBe(json.currentSecond);
    expect(
      json.series.every((emotion) =>
        emotion.points.every(
          (point) =>
            point.second >= json.windowStartSecond &&
            point.second <= json.windowEndSecond,
        ),
      ),
    ).toBe(true);
    expect(
      json.series.every((emotion) =>
        emotion.points.every(
          (point, index) =>
            point.second === index && point.value >= 0 && point.value <= 1,
        ),
      ),
    ).toBe(true);
  });

  it("grows first and then slides the 30-second window", () => {
    const startedAt = 1_000_000;
    const first = buildMockEmotionTimeline(startedAt, startedAt);
    const growing = buildMockEmotionTimeline(startedAt + 5_000, startedAt);
    const sliding = buildMockEmotionTimeline(startedAt + 35_000, startedAt);

    expect(first.currentSecond).toBe(0);
    expect(first.series[0].points.map(({ second }) => second)).toEqual([0]);
    expect(growing.windowStartSecond).toBe(0);
    expect(growing.windowEndSecond).toBe(5);
    expect(growing.series[0].points.at(-1)?.second).toBe(5);
    expect(sliding.windowStartSecond).toBe(5);
    expect(sliding.windowEndSecond).toBe(35);
    expect(sliding.series[0].points.at(0)?.second).toBe(5);
    expect(sliding.series[0].points.at(-1)?.second).toBe(35);
    expect(sliding.annotations.every(({ second }) => second >= 5)).toBe(true);
  });

  it("returns comments anchored to available emotion series", () => {
    const startedAt = 1_000_000;
    const timeline = buildMockEmotionTimeline(startedAt + 15_000, startedAt);
    const ids = new Set(timeline.series.map((emotion) => emotion.id));

    expect(timeline.annotations.length).toBeGreaterThan(0);
    expect(
      timeline.annotations.every(
        (annotation) =>
          annotation.second >= 0 &&
          annotation.second <= EMOTION_WINDOW_SECONDS &&
          ids.has(annotation.emotionId) &&
          annotation.comment.length > 0,
      ),
    ).toBe(true);
  });

  it("maps timeline values into stable SVG coordinates", () => {
    expect(chartX(0, 0)).toBe(0);
    expect(chartX(15, 0)).toBe(450);
    expect(chartX(30, 0)).toBe(900);
    expect(chartX(5, 5)).toBe(0);
    expect(chartX(35, 5)).toBe(900);
    expect(chartY(0)).toBe(204);
    expect(chartY(1)).toBe(28);
    expect(chartY(2)).toBe(28);
    expect(chartY(-1)).toBe(204);
    expect(chartY(5, 10)).toBe(116);
    expect(shortenComment("short comment")).toBe("short comment");
    expect(shortenComment("a".repeat(40), 10)).toHaveLength(10);
  });

  it("builds stacked areas and removes values below the threshold", () => {
    expect(EMOTION_VISIBILITY_THRESHOLD).toBe(0.4);
    const stacked = buildStackedEmotionSeries([
      {
        id: "first",
        label: "First",
        polarity: "neutral",
        color: "#000000",
        points: [
          { second: 0, value: 0.4 },
          { second: 1, value: 0.1 },
          { second: 2, value: 0.6 },
        ],
      },
      {
        id: "second",
        label: "Second",
        polarity: "neutral",
        color: "#ffffff",
        points: [
          { second: 0, value: 0.5 },
          { second: 1, value: 0.7 },
          { second: 2, value: 0.1 },
        ],
      },
    ]);

    expect(stacked[0].points).toEqual([
      { second: 0, lower: 0, upper: 0.4 },
      { second: 1, lower: 0, upper: 0 },
      { second: 2, lower: 0, upper: 0.6 },
    ]);
    expect(stacked[1].points).toEqual([
      { second: 0, lower: 0.4, upper: 0.9 },
      { second: 1, lower: 0, upper: 0.7 },
      { second: 2, lower: 0.6, upper: 0.6 },
    ]);
  });

  it("keeps mock activity slow with two to five strong emotions at a time", () => {
    const timeline = buildMockEmotionTimeline(120_000, 0);
    const activeCounts = timeline.series[0].points.map((_, pointIndex) =>
      timeline.series.filter(
        (emotion) => emotion.points[pointIndex].value >= EMOTION_VISIBILITY_THRESHOLD,
      ).length,
    );

    expect(activeCounts.every((count) => count >= 2 && count <= 5)).toBe(true);
    expect(new Set(activeCounts).size).toBeGreaterThan(1);
  });
});