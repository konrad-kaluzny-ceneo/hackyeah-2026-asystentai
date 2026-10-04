import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import { GET } from "@/app/api/emotions-timeline/route";
import {
  chartX,
  chartY,
  buildAreaPath,
  EmotionTimelineChart,
  shortenComment,
} from "@/behavior/ui/EmotionTimelineChart";
import {
  EMOTION_DEFINITIONS,
  EMOTION_VISIBILITY_THRESHOLD,
  EMOTION_WINDOW_SECONDS,
  buildMockEmotionTimeline,
  buildStackedEmotionSeries,
} from "@/behavior/ui/emotion-timeline";
import { DebugOverlay } from "@/behavior/ui/DebugOverlay";
import { resetDebugStateForTests, setDebugState } from "@/behavior/ui/debug-store";
import { INTENT_DEFINITIONS, type IntentTimelineResponse } from "@/lib/intent-timeline";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  vi.useRealTimers();
  resetDebugStateForTests();
});

function intentTimeline(currentSecond = 1): IntentTimelineResponse {
  return {
    schemaVersion: "2.0", source: "jev", windowSeconds: 30,
    currentSecond, windowStartSecond: 0, windowEndSecond: currentSecond,
    generatedAt: new Date(currentSecond * 1000).toISOString(), annotations: [],
    series: INTENT_DEFINITIONS.map((intent) => ({
      ...intent,
      points: Array.from({ length: currentSecond + 1 }, (_, second) => ({ second, value: second * 0.1 })),
    })),
  };
}

describe("compact debug chart", () => {
  it("keeps rounded curves without padding data for animation", () => {
    const short = buildAreaPath([{ second: 0, lower: 0, upper: 0.2 }, { second: 1, lower: 0, upper: 0.4 }], 0, 1);
    const full = buildAreaPath(Array.from({ length: 31 }, (_, second) => ({ second, lower: 0.1, upper: 0.5 })), 0, 1);
    expect(short).toContain("C");
    expect(full).toContain("C");
    expect(short.match(/C/g)).toHaveLength(2);
    expect(full.match(/C/g)).toHaveLength(60);
    expect(full).not.toContain("NaN");
    expect(buildAreaPath([], 0, 1)).toBe("");
  });

  it("shows only meta-event names without session, page or event details", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json(intentTimeline())));
    setDebugState({
      trackerEnabled: true, sessionId: "private-session-id", pageType: "product", pathname: "/private-path",
      lastSentMetaEvents: [{
        eventId: "test", name: "rage_click", batchId: "private-batch-id",
        detectedAt: "2026-10-04T00:00:00.000Z", sentAt: "2026-10-04T00:00:01.000Z",
        strength: 0.9, evidenceCount: 4,
      }],
    });
    const container = document.createElement("div");
    const root = createRoot(container);
    try {
      await act(async () => root.render(createElement(DebugOverlay)));
      expect(container.querySelector('aside[aria-label="Behavior debug"]')?.className).toContain("max-h-[min(300px,100dvh)]");
      expect(container.querySelector("li")?.textContent).toBe("rage_click");
      expect(container.querySelector("li")?.getAttribute("title")).toBeNull();
      for (const hidden of ["private-session-id", "private-path", "private-batch-id", "Session ID", "strength=", "evidence="]) {
        expect(container.innerHTML).not.toContain(hidden);
      }
      expect(container.querySelector('svg[role="img"]')).not.toBeNull();
      await act(async () => container.querySelector("button")?.click());
      expect(container.querySelector("svg")).toBeNull();
    } finally {
      await act(async () => root.unmount());
    }
  });

  it("does not overlap polls and updates rounded paths immediately without animation", async () => {
    vi.useFakeTimers();
    let resolveFetch: ((response: Response) => void) | undefined;
    const fetchMock = vi.fn().mockImplementationOnce(() => new Promise<Response>((resolve) => { resolveFetch = resolve; }))
      .mockResolvedValue(Response.json(intentTimeline(2)));
    vi.stubGlobal("fetch", fetchMock);
    const container = document.createElement("div");
    const root = createRoot(container);
    try {
      await act(async () => root.render(createElement(EmotionTimelineChart)));
      await act(async () => vi.advanceTimersByTime(3000));
      expect(fetchMock).toHaveBeenCalledTimes(1);
      await act(async () => resolveFetch?.(Response.json(intentTimeline())));
      const previousPath = container.querySelector("path")?.getAttribute("d");
      await act(async () => vi.advanceTimersByTime(1000));
      expect(fetchMock).toHaveBeenCalledTimes(2);
      expect(container.querySelector("path")?.getAttribute("d")).not.toBe(previousPath);
      expect(container.querySelector("path")?.getAttribute("d")).toContain("C");
      expect(container.querySelectorAll("animate, animateTransform")).toHaveLength(0);
    } finally {
      await act(async () => root.unmount());
    }
  });

  it("pauses requests while the tab is hidden and resumes when visible", async () => {
    vi.useFakeTimers();
    const hidden = vi.spyOn(document, "hidden", "get").mockReturnValue(true);
    const fetchMock = vi.fn().mockResolvedValue(Response.json(intentTimeline()));
    vi.stubGlobal("fetch", fetchMock);
    const root = createRoot(document.createElement("div"));
    try {
      await act(async () => root.render(createElement(EmotionTimelineChart)));
      await act(async () => vi.advanceTimersByTime(3000));
      expect(fetchMock).not.toHaveBeenCalled();
      hidden.mockReturnValue(false);
      await act(async () => vi.advanceTimersByTime(1000));
      expect(fetchMock).toHaveBeenCalledTimes(1);
    } finally {
      await act(async () => root.unmount());
    }
  });

});

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
    expect(chartX(0, 0)).toBe(56);
    expect(chartX(15, 0)).toBe(473);
    expect(chartX(30, 0)).toBe(890);
    expect(chartX(5, 5)).toBe(56);
    expect(chartX(35, 5)).toBe(890);
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