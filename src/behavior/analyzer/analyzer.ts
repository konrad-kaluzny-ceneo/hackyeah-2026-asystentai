import { THRESHOLDS } from "../config/thresholds";
import type {
  AnalysisContext,
  EcommerceContextProvider,
  MetaEvent,
  MetaEventDetector,
  PageType,
} from "../types";

import type { RawEventBuffer } from "../buffer/buffer";

export interface AnalyzerOptions {
  readonly buffer: RawEventBuffer;
  readonly detectors: readonly MetaEventDetector[];
  readonly contextProvider: EcommerceContextProvider;
  readonly getPageInfo: () => {
    pageType: PageType;
    pathname: string;
    pageViewId: string;
    previousPageType?: PageType;
  };
  readonly sessionId: string;
  readonly now?: () => number;
  /** Optional hook called with each freshly detected meta event. */
  readonly onEmit?: (event: MetaEvent) => void;
}

export interface AnalyzerHandle {
  /** Runs all detectors against the supplied window. Returns emitted meta events. */
  runOnce(windowMs: number): readonly MetaEvent[];
  /** Starts the periodic scheduler. Idempotent. */
  start(): void;
  /** Stops the scheduler. Safe to call multiple times. */
  stop(): void;
  /** Convenience: used by the collector on page_leave. */
  flush(): readonly MetaEvent[];
}

/**
 * Runs detectors over raw events pulled from the buffer. Pure orchestration —
 * no DOM, no I/O. The `scheduler.ts` companion owns the cadence.
 */
export function createAnalyzer(options: AnalyzerOptions): AnalyzerHandle {
  const now = options.now ?? Date.now;
  let timer: number | null = null;
  let running = false;

  const runOnce = (windowMs: number): readonly MetaEvent[] => {
    if (!running) {
      return [];
    }
    return runAnalysis(windowMs);
  };

  const runAnalysis = (windowMs: number): readonly MetaEvent[] => {
    const endedAt = now();
    const startedAt = endedAt - windowMs;
    const events = options.buffer.readSince(startedAt);
    if (events.length === 0) {
      return [];
    }
    const pageInfo = options.getPageInfo();
    const ecommerce = options.contextProvider.getContext();
    const ctx: AnalysisContext = {
      events,
      window: { startedAt, endedAt },
      sessionId: options.sessionId,
      pageViewId: pageInfo.pageViewId,
      pageType: pageInfo.pageType,
      pathname: pageInfo.pathname,
      previousPageType: pageInfo.previousPageType,
      ecommerce,
      now,
    };
    const emitted: MetaEvent[] = [];
    for (const detector of options.detectors) {
      let results: readonly MetaEvent[];
      try {
        results = detector.analyze(ctx);
      } catch {
        // A misbehaving detector must never break the pipeline or others.
        continue;
      }
      for (const event of results) {
        emitted.push(event);
        options.onEmit?.(event);
      }
    }
    return emitted;
  };

  const start = (): void => {
    if (timer !== null || typeof window === "undefined") {
      running = true;
      return;
    }
    running = true;
    timer = window.setInterval(() => {
      // Use requestIdleCallback when available so analysis runs off the UI
      // critical path. Fallback to setTimeout(0) otherwise.
      const schedule: (cb: () => void) => void =
        typeof window.requestIdleCallback === "function"
          ? (cb) => {
              window.requestIdleCallback(() => cb(), { timeout: 1000 });
            }
          : (cb) => {
              window.setTimeout(cb, 0);
            };
      schedule(() => {
        if (running) {
          runAnalysis(THRESHOLDS.analyzer.defaultWindowMs);
        }
      });
    }, THRESHOLDS.analyzer.scheduleIntervalMs);
  };

  const stop = (): void => {
    running = false;
    if (timer !== null && typeof window !== "undefined") {
      window.clearInterval(timer);
      timer = null;
    }
  };

  const flush = (): readonly MetaEvent[] => {
    return runAnalysis(THRESHOLDS.analyzer.defaultWindowMs);
  };

  return { runOnce, start, stop, flush };
}
