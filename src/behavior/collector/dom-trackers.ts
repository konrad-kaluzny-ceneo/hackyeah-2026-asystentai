import { THRESHOLDS } from "../config/thresholds";
import type { RawEventName } from "../types";

import { semanticElementId, scrollDepthBucket } from "./element-id";

/**
 * Page-specific DOM wiring owned by the collector:
 * - click listener (semantic elementId only)
 * - IntersectionObserver for *meaningfully tagged* elements (`[data-element-id]`)
 * - debounced scroll summary
 *
 * Returns a cleanup function that MUST be invoked when the page view ends.
 * All listeners and observers are torn down there.
 */
export interface DomTrackersOptions {
  readonly emit: (
    name: RawEventName,
    payload: {
      elementId?: string;
      subject?: Record<string, string>;
      data?: Record<string, string | number | boolean>;
    },
  ) => void;
  readonly root?: ParentNode;
  readonly now?: () => number;
}

export function attachDomTrackers(options: DomTrackersOptions): () => void {
  const root = options.root ?? document;

  const disposers: Array<() => void> = [];

  // -- Click ---------------------------------------------------------------
  const onClick: EventListener = (event) => {
    if (!(event instanceof MouseEvent)) {
      return;
    }
    const elementId = semanticElementId(event.target);
    if (elementId === undefined) {
      return;
    }
    options.emit("element_click", { elementId });
  };
  root.addEventListener("click", onClick, { capture: true, passive: true });
  disposers.push(() =>
    root.removeEventListener("click", onClick, { capture: true }),
  );

  // -- Filter changes ------------------------------------------------------
  const onChange: EventListener = (event) => {
    if (!(event.target instanceof Element)) {
      return;
    }
    const filterId = event.target.getAttribute("data-filter-id");
    if (filterId === null || filterId.length === 0) {
      return;
    }
    const value =
      "value" in event.target && typeof event.target.value === "string"
        ? event.target.value
        : "";
    options.emit(value.length > 0 ? "filter_added" : "filter_removed", {
      elementId: semanticElementId(event.target),
      data: { filterId },
    });
  };
  root.addEventListener("change", onChange, { capture: true, passive: true });
  disposers.push(() =>
    root.removeEventListener("change", onChange, { capture: true }),
  );

  // -- IntersectionObserver -------------------------------------------------
  let observer: IntersectionObserver | undefined;
  if (typeof IntersectionObserver !== "undefined") {
    observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const target = entry.target as Element;
          const explicit = target.getAttribute("data-element-id");
          if (explicit === null || explicit.length === 0) {
            continue;
          }
          options.emit(
            entry.isIntersecting
              ? "element_exposure_started"
              : "element_exposure_ended",
            {
              elementId: explicit,
              // Optional subject hint via data-subject-* attributes. These
              // are stable catalog identifiers, not user input.
              subject: readSubjectHints(target),
            },
          );
        }
      },
      { threshold: 0 },
    );
    // Observe only explicitly-tagged elements. We never observe the entire
    // DOM (privacy + perf); the demo application tags what matters.
    const tagged = root.querySelectorAll("[data-element-id]");
    tagged.forEach((el) => observer?.observe(el));
    disposers.push(() => observer?.disconnect());
  }

  // -- Scroll summary -------------------------------------------------------
  let scrollIdleTimer: number | undefined;
  const session: {
    maxDepth: number;
    lastY: number;
    scrollSamples: Array<{ timestamp: number; delta: number }>;
  } = {
    maxDepth: 0,
    lastY: typeof window !== "undefined" ? window.scrollY : 0,
    scrollSamples: [],
  };
  const emitScrollBurst = (timestamp: number, delta: number) => {
    if (delta === 0) {
      return;
    }
    session.scrollSamples.push({ timestamp, delta });
    const burstStart = timestamp - THRESHOLDS.scroll.burstWindowMs;
    session.scrollSamples = session.scrollSamples.filter(
      (sample) => sample.timestamp >= burstStart,
    );
    if (session.scrollSamples.length < THRESHOLDS.scroll.burstMinEvents) {
      return;
    }

    const distance = session.scrollSamples.reduce(
      (total, sample) => total + Math.abs(sample.delta),
      0,
    );
    const viewportHeight = Math.max(1, window.innerHeight);
    let reversalCount = 0;
    for (let index = 1; index < session.scrollSamples.length; index += 1) {
      const previous = session.scrollSamples[index - 1].delta;
      const current = session.scrollSamples[index].delta;
      if (Math.sign(previous) !== Math.sign(current)) {
        reversalCount += 1;
      }
    }
    const distanceRatio = distance / viewportHeight;
    if (
      distanceRatio < THRESHOLDS.scroll.burstMinDistanceRatio &&
      reversalCount === 0
    ) {
      return;
    }

    options.emit("scroll_burst", {
      data: {
        scrollCount: session.scrollSamples.length,
        distanceRatioBucket: distanceRatio >= 1 ? "high" : "medium",
        reversalCount,
      },
    });
    session.scrollSamples = [];
  };
  const flushScroll = () => {
    scrollIdleTimer = undefined;
    const doc = document.documentElement;
    const scrollable = Math.max(1, doc.scrollHeight - window.innerHeight);
    const depth = scrollDepthBucket(window.scrollY / scrollable);
    session.maxDepth = Math.max(session.maxDepth, depth);
    if (session.maxDepth === 0) {
      return;
    }
    options.emit("scroll_summary", {
      data: {
        maxDepthBucket: session.maxDepth,
      },
    });
    session.maxDepth = 0;
  };
  const onScroll = () => {
    const doc = document.documentElement;
    const scrollable = Math.max(1, doc.scrollHeight - window.innerHeight);
    const currentY = window.scrollY;
    session.maxDepth = Math.max(session.maxDepth, scrollDepthBucket(currentY / scrollable));
    emitScrollBurst(options.now?.() ?? Date.now(), currentY - session.lastY);
    session.lastY = currentY;
    markActivity();
    if (scrollIdleTimer !== undefined) {
      window.clearTimeout(scrollIdleTimer);
    }
    scrollIdleTimer = window.setTimeout(
      flushScroll,
      THRESHOLDS.scroll.idleMs,
    );
  };
  if (typeof window !== "undefined") {
    window.addEventListener("scroll", onScroll, { passive: true });
    disposers.push(() => {
      if (scrollIdleTimer !== undefined) {
        window.clearTimeout(scrollIdleTimer);
        scrollIdleTimer = undefined;
      }
      window.removeEventListener("scroll", onScroll);
    });
  }

  // -- Idle state ----------------------------------------------------------
  let idleTimer: number | undefined;
  let mouseMoveThrottleTimer: number | undefined;
  let idleStarted = false;
  const startIdleTimer = () => {
    if (idleTimer !== undefined) {
      window.clearTimeout(idleTimer);
    }
    idleTimer = window.setTimeout(() => {
      idleTimer = undefined;
      if (idleStarted) {
        return;
      }
      idleStarted = true;
      options.emit("idle_started", {
        data: { idleMs: THRESHOLDS.idle.idleMs },
      });
    }, THRESHOLDS.idle.idleMs);
  };
  const markActivity = () => {
    if (idleStarted) {
      idleStarted = false;
      options.emit("idle_ended", {
        data: { idleMs: THRESHOLDS.idle.idleMs },
      });
    }
    startIdleTimer();
  };
  const onActivity: EventListener = () => markActivity();
  const onMouseMove: EventListener = () => {
    if (mouseMoveThrottleTimer !== undefined) {
      return;
    }
    markActivity();
    mouseMoveThrottleTimer = window.setTimeout(() => {
      mouseMoveThrottleTimer = undefined;
    }, THRESHOLDS.idle.activityThrottleMs);
  };
  root.addEventListener("mousedown", onActivity, { passive: true });
  root.addEventListener("keydown", onActivity, { passive: true });
  root.addEventListener("touchstart", onActivity, { passive: true });
  root.addEventListener("mousemove", onMouseMove, { passive: true });
  disposers.push(() => {
    root.removeEventListener("mousedown", onActivity);
    root.removeEventListener("keydown", onActivity);
    root.removeEventListener("touchstart", onActivity);
    root.removeEventListener("mousemove", onMouseMove);
    if (idleTimer !== undefined) window.clearTimeout(idleTimer);
    if (mouseMoveThrottleTimer !== undefined) window.clearTimeout(mouseMoveThrottleTimer);
  });
  startIdleTimer();

  return () => {
    for (const dispose of disposers) {
      dispose();
    }
  };
}

function readSubjectHints(el: Element): Record<string, string> | undefined {
  const subject: Record<string, string> = {};
  const product = el.getAttribute("data-subject-product-id");
  const category = el.getAttribute("data-subject-category-id");
  const offer = el.getAttribute("data-subject-offer-id");
  const brand = el.getAttribute("data-subject-brand-id");
  if (product !== null && product.length > 0) subject.productId = product;
  if (category !== null && category.length > 0) subject.categoryId = category;
  if (offer !== null && offer.length > 0) subject.offerId = offer;
  if (brand !== null && brand.length > 0) subject.brandId = brand;
  return Object.keys(subject).length > 0 ? subject : undefined;
}
