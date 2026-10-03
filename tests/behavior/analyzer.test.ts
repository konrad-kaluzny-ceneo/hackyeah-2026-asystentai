import { describe, expect, it } from "vitest";

import { createAnalyzer } from "@/behavior/analyzer/analyzer";
import { RawEventBuffer } from "@/behavior/buffer/buffer";
import { THRESHOLDS } from "@/behavior/config/thresholds";
import type { MetaEvent } from "@/behavior/types";

import {
  makeClock,
  makeEcommerceContext,
  makeIdGenerator,
  makeRawEvent,
  resetFixtureSeed,
} from "./fixtures";

function setupAnalyzer(overrides: {
  now?: () => number;
  onEmit?: (event: MetaEvent) => void;
}) {
  const buffer = new RawEventBuffer({
    maxEvents: 500,
    ttlMs: THRESHOLDS.buffer.rawEventTtlMs,
    now: overrides.now,
  });
  const analyzer = createAnalyzer({
    buffer,
    detectors: [
      {
        name: "rage_click" as const,
        analyze(ctx) {
          return ctx.events.length === 0
            ? []
            : [
                {
                  schemaVersion: "1.0" as const,
                  eventId: "evt-synthetic",
                  name: "rage_click" as const,
                  detectedAt: new Date(ctx.window.endedAt).toISOString(),
                  window: {
                    startedAt: new Date(ctx.window.startedAt).toISOString(),
                    endedAt: new Date(ctx.window.endedAt).toISOString(),
                    durationMs: ctx.window.endedAt - ctx.window.startedAt,
                  },
                  identity: {
                    sessionId: ctx.sessionId,
                    pageViewId: ctx.pageViewId,
                  },
                  page: {
                    type: ctx.pageType,
                    pathname: ctx.pathname,
                  },
                  ecommerce: {
                    activeFilters: ctx.ecommerce.activeFilters,
                    activeFiltersCount: ctx.ecommerce.activeFiltersCount,
                  },
                  metrics: { clickCount: ctx.events.length },
                  quality: {
                    strength: 1,
                    evidenceCount: ctx.events.length,
                    algorithmVersion: "test",
                    partialData: false,
                  },
                  privacy: {
                    containsFreeText: false as const,
                    rawDataUploaded: false as const,
                  },
                },
              ];
        },
      },
    ],
    contextProvider: {
      getContext: makeEcommerceContext,
    },
    getPageInfo: () => ({
      pageType: "catalog" as const,
      pathname: "/katalog",
      pageViewId: "pv-1",
    }),
    sessionId: "session-test-1",
    now: overrides.now,
    onEmit: overrides.onEmit,
  });
  return { analyzer, buffer };
}

describe("Analyzer", () => {
  it("runs detectors against the requested window and passes emitted events to onEmit", () => {
    resetFixtureSeed();
    const clock = makeClock(10_000);
    const emitted: MetaEvent[] = [];
    const { analyzer, buffer } = setupAnalyzer({
      now: clock.now,
      onEmit: (e) => emitted.push(e),
    });
    buffer.push(makeRawEvent({ timestamp: 9_000 }));
    buffer.push(makeRawEvent({ timestamp: 9_500 }));
    // Analyzer was never started — runOnce must be a no-op.
    expect(analyzer.runOnce(1_000)).toEqual([]);
    // Once started, runOnce returns the analysis results.
    analyzer.start();
    const results = analyzer.runOnce(1_000);
    expect(results).toHaveLength(1);
    expect(emitted).toHaveLength(1);
    analyzer.stop();
  });

  it("returns no events when no events fall inside the window", () => {
    resetFixtureSeed();
    const clock = makeClock(10_000);
    const { analyzer, buffer } = setupAnalyzer({ now: clock.now });
    buffer.push(makeRawEvent({ timestamp: 100 })); // far outside any window
    analyzer.start();
    expect(analyzer.runOnce(1_000)).toEqual([]);
    analyzer.stop();
  });

  it("isolates a failing detector so others still run", () => {
    resetFixtureSeed();
    const clock = makeClock(10_000);
    const emitted: MetaEvent[] = [];
    const buffer = new RawEventBuffer({
      maxEvents: 500,
      ttlMs: 60_000,
      now: clock.now,
    });
    buffer.push(makeRawEvent({ timestamp: 9_900 }));
    const analyzer = createAnalyzer({
      buffer,
      detectors: [
        {
          name: "rage_click" as const,
          analyze() {
            throw new Error("broken detector");
          },
        },
        {
          name: "dead_click_cluster" as const,
          analyze(ctx) {
            if (ctx.events.length === 0) return [];
            return [
              {
                schemaVersion: "1.0" as const,
                eventId: "evt-second",
                name: "dead_click_cluster" as const,
                detectedAt: new Date(ctx.window.endedAt).toISOString(),
                window: {
                  startedAt: new Date(ctx.window.startedAt).toISOString(),
                  endedAt: new Date(ctx.window.endedAt).toISOString(),
                  durationMs: 0,
                },
                identity: {
                  sessionId: ctx.sessionId,
                  pageViewId: ctx.pageViewId,
                },
                page: { type: ctx.pageType, pathname: ctx.pathname },
                ecommerce: {
                  activeFilters: [],
                  activeFiltersCount: 0,
                },
                metrics: { clickCount: 0 },
                quality: {
                  strength: 0.5,
                  evidenceCount: 1,
                  algorithmVersion: "test",
                  partialData: false,
                },
                privacy: {
                  containsFreeText: false as const,
                  rawDataUploaded: false as const,
                },
              },
            ];
          },
        },
      ],
      contextProvider: { getContext: makeEcommerceContext },
      getPageInfo: () => ({
        pageType: "catalog" as const,
        pathname: "/katalog",
        pageViewId: "pv-1",
      }),
      sessionId: "session-test-1",
      now: clock.now,
      onEmit: (e) => emitted.push(e),
    });
    analyzer.start();
    const results = analyzer.runOnce(1_000);
    expect(results).toHaveLength(1);
    expect(results[0].name).toBe("dead_click_cluster");
    expect(emitted).toHaveLength(1);
    analyzer.stop();
  });

  it("makeIdGenerator produces deterministic sequential ids", () => {
    const gen = makeIdGenerator("x");
    expect(gen()).toBe("x-000001");
    expect(gen()).toBe("x-000002");
  });
});
