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
      { threshold: 0.5 },
    );
    // Observe only explicitly-tagged elements. We never observe the entire
    // DOM (privacy + perf); the demo application tags what matters.
    const tagged = root.querySelectorAll("[data-element-id]");
    tagged.forEach((el) => observer?.observe(el));
    disposers.push(() => observer?.disconnect());
  }

  // -- Scroll summary -------------------------------------------------------
  let scrollIdleTimer: number | undefined;
  const session: { maxDepth: number; lastY: number } = {
    maxDepth: 0,
    lastY: typeof window !== "undefined" ? window.scrollY : 0,
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
    session.maxDepth = Math.max(
      session.maxDepth,
      scrollDepthBucket(window.scrollY / scrollable),
    );
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
