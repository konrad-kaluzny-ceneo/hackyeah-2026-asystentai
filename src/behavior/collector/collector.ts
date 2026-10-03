import type { PageTypeRule } from "../config/page-types";
import type { PageType, RawEvent, RawEventName } from "../types";

import type { RawEventBuffer } from "../buffer/buffer";
import { generateId as generateUniqueId } from "../id";
import { classifyPathname } from "../page-classifier/classifier";
import { attachDomTrackers } from "./dom-trackers";
import { Sequence } from "./sequence";
import {
  getCurrentPageViewId,
  getSessionId,
  rotatePageViewId,
} from "./session";

export interface CollectorOptions {
  readonly buffer: RawEventBuffer;
  readonly rules: readonly PageTypeRule[];
  /** Injectable clock — required for deterministic tests. */
  readonly now?: () => number;
  /**
   * Optional ID generator for raw events. Defaults to crypto.randomUUID()
   * when available, else a weak fallback. Tests inject a deterministic one.
   */
  readonly generateId?: () => string;
  /** Hook fired AFTER a location change has been fully processed. */
  readonly onPageViewChange?: (info: {
    previous: { pageViewId: string | null; pageType: PageType; pathname: string } | null;
    current: { pageViewId: string; pageType: PageType; pathname: string };
  }) => void;
  /**
   * When true, clicking elements marked with `data-track-progress` is also
   * emitted as a `ui_state_changed` event so detectors can see the UI update.
   */
  readonly trackUiStateClicks?: boolean;
}

export interface CollectorHandle {
  readonly emit: (
    name: RawEventName,
    extras?: Partial<
      Pick<RawEvent, "elementId" | "subject" | "ecommerce" | "data">
    >,
  ) => void;
  readonly getCurrentPage: () => {
    pageType: PageType;
    pathname: string;
    pageViewId: string;
    previousPageType?: PageType;
  };
  /** Tears down every listener/observer; safe to call multiple times. */
  destroy(): void;
}

interface PageState {
  pageViewId: string;
  pageType: PageType;
  pathname: string;
  previousPageType: PageType | undefined;
  detachDom: (() => void) | null;
}

const RESERVED_NOT_EMITTED: ReadonlySet<RawEventName> = new Set([
  "add_to_cart",
  "compare_added",
  "compare_removed",
  "favorite_added",
]);

/**
 * The collector owns all global browser listeners (history patching,
 * popstate/hashchange, errors) and is the funnel through which raw events
 * enter the buffer. It does NOT analyze; analyzers pull from the buffer.
 */
export function createCollector(options: CollectorOptions): CollectorHandle {
  const buffer = options.buffer;
  const now = options.now ?? Date.now;
  const generateId = options.generateId ?? (() => generateUniqueId("raw"));
  const sequence = new Sequence();
  const sessionId = getSessionId();

  const state: PageState = {
    pageViewId: getCurrentPageViewId(),
    pageType: "unknown",
    pathname: "",
    previousPageType: undefined,
    detachDom: null,
  };

  let destroyed = false;
  const globalDisposers: Array<() => void> = [];

  // -- Emission ---------------------------------------------------------------
  const emit: CollectorHandle["emit"] = (name, extras) => {
    if (destroyed) {
      return;
    }
    // Hard rule: PRD Non-Goals. These names remain in the type contract for
    // external consumers, but this demo never emits them.
    if (RESERVED_NOT_EMITTED.has(name)) {
      return;
    }
    const event: RawEvent = {
      id: generateId(),
      name,
      timestamp: now(),
      sequenceNumber: sequence.getNext(),
      sessionId,
      pageViewId: state.pageViewId,
      pageType: state.pageType,
      pathname: state.pathname,
      ...(extras?.elementId !== undefined && { elementId: extras.elementId }),
      ...(extras?.subject !== undefined && { subject: extras.subject }),
      ...(extras?.ecommerce !== undefined && { ecommerce: extras.ecommerce }),
      ...(extras?.data !== undefined && { data: extras.data }),
    };
    buffer.push(event);
  };

  // -- Page lifecycle -----------------------------------------------------------
  const attachPage = (pathname: string): void => {
    state.pathname = sanitizePathname(pathname);
    state.pageType = classifyPathname(state.pathname, options.rules);
    state.detachDom = attachDomTrackers({
      emit: (name, payload) => emit(name, payload),
      now,
    });
  };

  const detachPage = (): void => {
    if (state.detachDom !== null) {
      state.detachDom();
      state.detachDom = null;
    }
  };

  const beginPage = (pathname: string): void => {
    // First call: no previous page to leave.
    attachPage(pathname);
    emit("page_enter");
  };

  const transitionTo = (nextPathname: string): void => {
    const previousPathname = state.pathname;
    if (sanitizePathname(nextPathname) === previousPathname) {
      return; // Same path (e.g. only query changed) — not a page change here.
    }
    const previousPageViewId = state.pageViewId;
    const previousPageType = state.pageType;

    emit("page_leave");
    detachPage();
    const rotation = rotatePageViewId();
    state.pageViewId = rotation.current;
    state.previousPageType = previousPageType;
    attachPage(nextPathname);
    emit("url_changed", {
      data: {
        fromPageType: previousPageType,
        toPageType: state.pageType,
      },
    });
    emit("page_enter");
    options.onPageViewChange?.({
      previous: {
        pageViewId: previousPageViewId,
        pageType: previousPageType,
        pathname: previousPathname,
      },
      current: {
        pageViewId: state.pageViewId,
        pageType: state.pageType,
        pathname: state.pathname,
      },
    });
  };

  // -- Global listeners -----------------------------------------------------------
  if (typeof window !== "undefined") {
    // Patch history.{pushState,replaceState} once per collector. Next.js App
    // Router drives SPA navigation through these, so patching them covers
    // router.push / Link clicks / router.replace.
    const originalPushState = window.history.pushState;
    const originalReplaceState = window.history.replaceState;
    const patchedPush: typeof window.history.pushState = function (
      this: History,
      data,
      unused,
      url,
    ) {
      const result = originalPushState.call(this, data, unused, url);
      handlePotentialTransition();
      return result;
    };
    const patchedReplace: typeof window.history.replaceState = function (
      this: History,
      data,
      unused,
      url,
    ) {
      const result = originalReplaceState.call(this, data, unused, url);
      handlePotentialTransition();
      return result;
    };
    window.history.pushState = patchedPush;
    window.history.replaceState = patchedReplace;
    globalDisposers.push(() => {
      window.history.pushState = originalPushState;
      window.history.replaceState = originalReplaceState;
    });

    const onPopState = () => handlePotentialTransition();
    const onHashChange = () => handlePotentialTransition();
    const onError = (event: ErrorEvent) => {
      emit("client_error", {
        data: { kind: "error", source: "window" },
        // message is *not* included — may contain user data.
      });
      void event;
    };
    const onUnhandledRejection = () => {
      emit("client_error", {
        data: { kind: "unhandledrejection", source: "window" },
      });
    };
    window.addEventListener("popstate", onPopState);
    window.addEventListener("hashchange", onHashChange);
    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onUnhandledRejection);
    globalDisposers.push(() => {
      window.removeEventListener("popstate", onPopState);
      window.removeEventListener("hashchange", onHashChange);
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onUnhandledRejection);
    });

    // Instrument fetch to detect request_failed — narrow: only status class
    // and hostname, never body or query.
    const originalFetch = window.fetch?.bind(window);
    if (originalFetch) {
      const instrumentedFetch: typeof window.fetch = async (input, init) => {
        const response = await originalFetch(input, init);
        try {
          if (!response.ok && response.status >= 500) {
            const url =
              typeof input === "string"
                ? input
                : input instanceof URL
                  ? input.href
                  : input.url;
            emit("request_failed", {
              data: {
                statusClass: "5xx",
                host: safeHost(url),
              },
            });
          }
        } catch {
          // Instrumentation must never break the host app.
        }
        return response;
      };
      window.fetch = instrumentedFetch;
      globalDisposers.push(() => {
        window.fetch = originalFetch;
      });
    }
  }

  function handlePotentialTransition(): void {
    if (typeof window === "undefined") {
      return;
    }
    const candidate = window.location.pathname;
    if (sanitizePathname(candidate) !== state.pathname) {
      transitionTo(candidate);
    }
  }

  function sanitizePathname(value: string): string {
    const cleaned = value.split(/[?#]/, 1)[0];
    if (cleaned.length > 1 && cleaned.endsWith("/")) {
      return cleaned.slice(0, -1);
    }
    return cleaned;
  }

  function safeHost(url: string): string {
    try {
      return new URL(url, window.location.href).host;
    } catch {
      return "unknown";
    }
  }

  // Bootstrap current page.
  const initialPathname =
    typeof window !== "undefined" ? window.location.pathname : "/";
  beginPage(initialPathname);

  return {
    emit,
    getCurrentPage: () => ({
      pageType: state.pageType,
      pathname: state.pathname,
      pageViewId: state.pageViewId,
      previousPageType: state.previousPageType,
    }),
    destroy: () => {
      if (destroyed) {
        return;
      }
      destroyed = true;
      emit("page_leave");
      detachPage();
      for (const dispose of globalDisposers) {
        dispose();
      }
    },
  };
}
