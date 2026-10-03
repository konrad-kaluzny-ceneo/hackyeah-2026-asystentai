"use client";

import { useEffect, useRef } from "react";

import { THRESHOLDS } from "@/behavior/config/thresholds";
import {
  initBehaviorTracker,
  type BehaviorTracker,
} from "@/behavior/initializer";
import { DebugOverlay } from "@/behavior/ui/DebugOverlay";
import {
  setDebugState,
  type DebugState,
} from "@/behavior/ui/debug-store";

const REPORT_INTERVAL_MS = 1_000;
const SESSION_ID_STORAGE_KEY = "behavior.sessionId.v1";

/**
 * Top-level shell mounted in the root layout. Owns the behavior tracker
 * lifecycle AND feeds telemetry into the dev-only debug overlay.
 *
 * Subsumes the previous <BehaviorTracker /> component.
 */
export function BehaviorDebugShell() {
  const trackerRef = useRef<BehaviorTracker | null>(null);

  useEffect(() => {
    const tracker = initBehaviorTracker();
    trackerRef.current = tracker;
    setDebugState({
      trackerEnabled: tracker !== null,
      ...(tracker !== null && snapshotFromTracker(tracker)),
    });

    if (tracker === null) {
      return undefined;
    }

    const intervalId = window.setInterval(() => {
      const current = trackerRef.current;
      if (current === null) return;
      setDebugState(snapshotFromTracker(current));
    }, REPORT_INTERVAL_MS);

    return () => {
      window.clearInterval(intervalId);
      void tracker.destroy();
      trackerRef.current = null;
      setDebugState({ trackerEnabled: false });
    };
  }, []);

  return <DebugOverlay />;
}

function snapshotFromTracker(tracker: BehaviorTracker): Partial<DebugState> {
  const page = tracker.collector.getCurrentPage();
  return {
    rawEventsInSessionStorage: readCheckpointEventCount(),
    unsentMetaEvents: tracker.dispatcher.queueSize(),
    sessionId: readSessionIdSafe(),
    pageViewId: page.pageViewId,
    pageType: page.pageType,
    pathname: page.pathname,
  };
}

function readSessionIdSafe(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.sessionStorage.getItem(SESSION_ID_STORAGE_KEY);
  } catch {
    return null;
  }
}

function readCheckpointEventCount(): number {
  if (typeof window === "undefined") return 0;
  try {
    const raw = window.sessionStorage.getItem(
      THRESHOLDS.buffer.checkpointStorageKey,
    );
    if (raw === null) return 0;
    const parsed = JSON.parse(raw) as { events?: unknown };
    return Array.isArray(parsed.events) ? parsed.events.length : 0;
  } catch {
    return 0;
  }
}
