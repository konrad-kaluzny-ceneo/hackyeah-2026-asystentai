"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

import { THRESHOLDS } from "@/behavior/config/thresholds";
import {
  clearAssistantMetaEventHistory,
  recordAssistantMetaEventBatch,
} from "@/behavior/assistant-meta-event-history";
import {
  CATALOG_PRODUCT_VIEW_EVENT,
  type CatalogProductViewDetail,
} from "@/lib/catalog-ui-events";
import {
  initBehaviorTracker,
  type BehaviorTracker,
} from "@/behavior/initializer";
import type { RawEvent } from "@/behavior/types";
import { DebugOverlay } from "@/behavior/ui/DebugOverlay";
import {
  recordBatchSent,
  setDebugState,
  type DebugState,
  type RawEventSummary,
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
  const pathname = usePathname();

  useEffect(() => {
    clearAssistantMetaEventHistory();
    let isActive = true;
    const tracker = initBehaviorTracker({
      onBatchSent: (batch) => {
        if (!isActive) return;
        recordAssistantMetaEventBatch(batch.events);
        recordBatchSent(batch);
      },
    });
    trackerRef.current = tracker;
    setDebugState({
      trackerEnabled: tracker !== null,
      ...(tracker !== null && snapshotFromTracker(tracker)),
    });

    if (tracker === null) {
      return undefined;
    }

    const onCatalogProductView = (event: Event) => {
      const detail = (event as CustomEvent<CatalogProductViewDetail>).detail;
      if (!detail) return;
      tracker.collector.emit("product_viewed", {
        elementId: "product-detail",
        subject: {
          productId: detail.productId,
          categoryId: detail.categoryId,
          brandId: detail.brandId,
        },
      });
    };
    window.addEventListener(CATALOG_PRODUCT_VIEW_EVENT, onCatalogProductView);

    const intervalId = window.setInterval(() => {
      const current = trackerRef.current;
      if (current === null) return;
      setDebugState(snapshotFromTracker(current));
    }, REPORT_INTERVAL_MS);

    return () => {
      isActive = false;
      clearAssistantMetaEventHistory();
      window.clearInterval(intervalId);
      window.removeEventListener(CATALOG_PRODUCT_VIEW_EVENT, onCatalogProductView);
      void tracker.destroy();
      trackerRef.current = null;
      setDebugState({ trackerEnabled: false });
    };
  }, []);

  useEffect(() => {
    trackerRef.current?.collector.syncPathname();
  }, [pathname]);

  if (process.env.NODE_ENV !== "development") {
    return null;
  }

  return <DebugOverlay />;
}

function snapshotFromTracker(tracker: BehaviorTracker): Partial<DebugState> {
  const page = tracker.collector.getCurrentPage();
  const rawEvents = readCheckpointRawEvents();
  return {
    rawEventsInSessionStorage: rawEvents.length,
    lastRawEvents: rawEvents,
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

function readCheckpointRawEvents(): RawEventSummary[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.sessionStorage.getItem(
      THRESHOLDS.buffer.checkpointStorageKey,
    );
    if (raw === null) return [];
    const parsed = JSON.parse(raw) as { events?: unknown };
    if (!Array.isArray(parsed.events)) return [];
    return parsed.events
      .filter(isRawEvent)
      .reverse()
      .map((event) => ({
        eventId: event.id,
        name: event.name,
        timestamp: event.timestamp,
        sequenceNumber: event.sequenceNumber,
        pageType: event.pageType,
        pathname: event.pathname,
      }));
  } catch {
    return [];
  }
}

function isRawEvent(value: unknown): value is RawEvent {
  if (typeof value !== "object" || value === null) return false;
  const event = value as Partial<RawEvent>;
  return (
    typeof event.id === "string" &&
    typeof event.name === "string" &&
    typeof event.timestamp === "number" &&
    typeof event.sequenceNumber === "number" &&
    typeof event.pageType === "string" &&
    typeof event.pathname === "string"
  );
}
