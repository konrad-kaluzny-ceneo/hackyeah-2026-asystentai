import type {
  EcommerceContext,
  EcommerceContextProvider,
  PageType,
} from "../types";

export type DemoContextProviderInput = Readonly<{
  pageType: PageType;
  pathname: string;
  routeTemplate?: string;
  previousPageType?: PageType;
}>;

/**
 * Default context provider for the demo shell. Until the F-02 mock catalog
 * lands, almost every commerce signal is empty — the provider only reports
 * what's reliably available (page identity + viewport). The mock catalog
 * will replace this with a real implementation reading the filter store.
 *
 * Never reads form values or free-text input; only structured DOM/query
 * signals explicitly tagged by the application.
 */
export class DemoContextProvider implements EcommerceContextProvider {
  constructor(private readonly input: DemoContextProviderInput) {}

  getContext(): EcommerceContext {
    return {
      pageType: this.input.pageType,
      pathname: sanitizePathname(this.input.pathname),
      routeTemplate: this.input.routeTemplate,
      previousPageType: this.input.previousPageType,
      activeFilters: [],
      activeFiltersCount: 0,
      viewportClass: getViewportClass(),
      deviceClass: getDeviceClass(),
      currentJourneyStage: "browsing",
    };
  }
}

function sanitizePathname(pathname: string): string {
  // Drop query string and hash; keep only the path. Trailing slash removed
  // for stability except for the root.
  const withoutExtras = pathname.split(/[?#]/, 1)[0];
  if (withoutExtras.length > 1 && withoutExtras.endsWith("/")) {
    return withoutExtras.slice(0, -1);
  }
  return withoutExtras;
}

const VIEWPORT_CLASSES = ["mobile", "tablet", "desktop"] as const;
type ViewportClass = (typeof VIEWPORT_CLASSES)[number];
void VIEWPORT_CLASSES; // referenced via index signature above; explicit void keeps eslint happy.

function getViewportClass(): ViewportClass | undefined {
  if (typeof window === "undefined") {
    return undefined;
  }
  const width = window.innerWidth;
  if (width < 640) return "mobile";
  if (width < 1024) return "tablet";
  return "desktop";
}

function getDeviceClass(): "touch" | "pointer" | undefined {
  if (typeof window === "undefined") {
    return undefined;
  }
  const hasTouch =
    "ontouchstart" in window ||
    (typeof navigator !== "undefined" && navigator.maxTouchPoints > 0);
  return hasTouch ? "touch" : "pointer";
}
