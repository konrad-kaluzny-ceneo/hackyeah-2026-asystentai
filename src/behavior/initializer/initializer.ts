import { THRESHOLDS } from "../config/thresholds";
import { PAGE_TYPE_RULES } from "../config/page-types";
import { isBehaviorTrackingEnabled } from "../config/feature-flag";

import { createAnalyzer, type AnalyzerHandle } from "../analyzer/analyzer";
import { RawEventBuffer } from "../buffer/buffer";
import { Checkpoint } from "../buffer/checkpoint";
import { createCollector, type CollectorHandle } from "../collector/collector";
import { getSessionId } from "../collector/session";
import { DemoContextProvider } from "../context-provider/demo";
import { Deduplicator } from "../deduplicator/deduplicator";
import { buildDetectorRegistry } from "../detectors";
import type { MetaEventIdGenerator } from "../detectors/base";
import {
  createDispatcher,
  type DispatcherHandle,
} from "../dispatcher/dispatcher";
import { createTransport } from "../dispatcher/transport";
import { generateId as generateUniqueId } from "../id";
import type { MetaEvent } from "../types";

export interface BehaviorTrackerOptions {
  readonly endpoint?: string;
  readonly generateId?: MetaEventIdGenerator;
  readonly now?: () => number;
}

export interface BehaviorTracker {
  destroy(): Promise<void>;
  /** Diagnostics for the demo / devtools. */
  readonly collector: CollectorHandle;
  readonly analyzer: AnalyzerHandle;
  readonly dispatcher: DispatcherHandle;
}

/**
 * Top-level init. Wires together collector + buffer + analyzer + detectors
 * + dispatcher + dedup; emits NO events when the feature flag is off.
 *
 * Returns null when disabled — callers treat this as "tracker absent".
 *
 * Lifecycle: call `destroy()` from a `useEffect` cleanup. The tracker also
 * flushes on `pagehide` automatically while active.
 */
export function initBehaviorTracker(
  options: BehaviorTrackerOptions = {},
): BehaviorTracker | null {
  if (!isBehaviorTrackingEnabled()) {
    return null;
  }
  if (typeof window === "undefined") {
    return null;
  }
  const now = options.now ?? Date.now;
  const generateId =
    options.generateId ??
    (() => generateUniqueId("meta"));

  const buffer = new RawEventBuffer({
    maxEvents: THRESHOLDS.buffer.maxEvents,
    ttlMs: THRESHOLDS.buffer.rawEventTtlMs,
    now,
  });
  const checkpoint = new Checkpoint();
  const sessionId = getSessionId();
  const restored = checkpoint.restore(sessionId);
  if (restored !== undefined) {
    buffer.loadSnapshot(restored.events);
  }

  const dispatcher = createDispatcher({
    transport: createTransport({
      endpoint: options.endpoint ?? "/api/meta-events",
    }),
    generateBatchId: generateId,
    now,
  });

  const deduplicator = new Deduplicator({
    ttlMs: THRESHOLDS.deduplicator.ttlMs,
    maxEntries: THRESHOLDS.deduplicator.maxEntries,
    cooldowns: THRESHOLDS.deduplicator.cooldowns,
    now,
  });

  const contextProviderHolder: {
    current: DemoContextProvider | null;
  } = { current: null };

  const analyzer: AnalyzerHandle = createAnalyzer({
    buffer,
    detectors: buildDetectorRegistry(generateId),
    contextProvider: {
      getContext: () => {
        // Created lazily AFTER the collector exists so we can read pageInfo.
        const p = collector.getCurrentPage();
        contextProviderHolder.current = new DemoContextProvider({
          pageType: p.pageType,
          pathname: p.pathname,
          previousPageType: p.previousPageType,
        });
        return contextProviderHolder.current.getContext();
      },
    },
    getPageInfo: () => collector.getCurrentPage(),
    sessionId,
    now,
    onEmit: (event: MetaEvent) => {
      if (deduplicator.shouldEmit(event)) {
        dispatcher.enqueue(event);
      }
    },
  });

  const collector = createCollector({
    buffer,
    rules: PAGE_TYPE_RULES,
    now,
    generateId,
    onPageViewChange: () => {
      // A page change is a strong signal: run the analyzers against the
      // previous page before the buffer ages events out.
      analyzer.flush();
    },
  });

  // Periodic checkpoint (kept cheap; sessionStorage write is tiny).
  const checkpointTimer = window.setInterval(
    () => checkpoint.save(sessionId, buffer.toJSON(), now),
    THRESHOLDS.buffer.checkpointIntervalMs,
  );

  // Flush on tab hide/close. `pagehide` is the reliable one; visibilitychange
  // catches mobile transitions that skip pagehide.
  const onPageHide = () => {
    checkpoint.save(sessionId, buffer.toJSON(), now);
    void dispatcher.flushNow();
  };
  const onVisibilityChange = () => {
    if (document.visibilityState === "hidden") {
      onPageHide();
    }
  };
  window.addEventListener("pagehide", onPageHide);
  document.addEventListener("visibilitychange", onVisibilityChange);

  analyzer.start();
  dispatcher.start();

  return {
    collector,
    analyzer,
    dispatcher,
    async destroy(): Promise<void> {
      window.clearInterval(checkpointTimer);
      window.removeEventListener("pagehide", onPageHide);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      analyzer.stop();
      dispatcher.stop();
      await dispatcher.flushNow();
      collector.destroy();
      checkpoint.save(sessionId, buffer.toJSON(), now);
    },
  };
}
