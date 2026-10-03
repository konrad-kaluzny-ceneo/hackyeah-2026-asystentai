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
    const catalogContext = readCatalogContext();
    return {
      pageType: this.input.pageType,
      pathname: sanitizePathname(this.input.pathname),
      routeTemplate: catalogContext.routeTemplate ?? this.input.routeTemplate,
      previousPageType: this.input.previousPageType,
      categoryId: catalogContext.categoryId,
      productId: catalogContext.productId,
      brandId: catalogContext.brandId,
      activeFilters: catalogContext.activeFilters,
      activeFiltersCount: catalogContext.activeFilters.length,
      viewportClass: getViewportClass(),
      deviceClass: getDeviceClass(),
      currentJourneyStage: "browsing",
    };
  }
}

const ROUTE_TEMPLATES = new Set([
  "/",
  "/katalog",
  "/katalog/[categorySlug]",
  "/produkt/[productSlug]",
]);

function readCatalogContext(): {
  routeTemplate?: string;
  categoryId?: string;
  productId?: string;
  brandId?: string;
  activeFilters: EcommerceContext["activeFilters"];
} {
  if (typeof document === "undefined") return { activeFilters: [] };
  const element = document.querySelector<HTMLElement>("[data-catalog-context]");
  if (!element) return { activeFilters: [] };

  let activeFilters: EcommerceContext["activeFilters"] = [];
  try {
    const parsed: unknown = JSON.parse(element.dataset.activeFilters ?? "[]");
    if (Array.isArray(parsed)) {
      activeFilters = parsed.flatMap((filter: unknown): EcommerceContext["activeFilters"][number][] => {
        if (
          typeof filter !== "object" ||
          filter === null ||
          !("id" in filter) ||
          typeof filter.id !== "string" ||
          filter.id.length === 0 ||
          filter.id.length > 128
        ) return [];
        const valueIds = "valueIds" in filter && Array.isArray(filter.valueIds)
          ? filter.valueIds.filter((value: unknown): value is string => typeof value === "string" && value.length > 0 && value.length <= 128)
          : undefined;
        return [{ id: filter.id, ...(valueIds && valueIds.length > 0 ? { valueIds } : {}) }];
      });
    }
  } catch {
    activeFilters = [];
  }

  const routeTemplate = element.dataset.routeTemplate;
  return {
    ...(routeTemplate && ROUTE_TEMPLATES.has(routeTemplate) ? { routeTemplate } : {}),
    ...(element.dataset.catalogCategoryId ? { categoryId: element.dataset.catalogCategoryId } : {}),
    ...(element.dataset.catalogProductId ? { productId: element.dataset.catalogProductId } : {}),
    ...(element.dataset.catalogBrandId ? { brandId: element.dataset.catalogBrandId } : {}),
    activeFilters,
  };
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
