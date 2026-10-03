import type {
  AssistantProposal,
  CatalogEvent,
  CatalogState,
  Category,
  CategoryFilter,
  Product,
} from "@/lib/catalog-types";

const MAX_NORMALIZED_FILTER_DISTANCE = 0.5;

function hasActiveFilters(filters: Record<string, string>): boolean {
  return Object.values(filters).some((value) => value.trim().length > 0);
}

function latestTimestamp(events: CatalogEvent[]): string {
  return events.at(-1)?.timestamp ?? new Date(0).toISOString();
}

function emptyResultsProposal(events: CatalogEvent[], state: CatalogState): AssistantProposal {
  const latestEvent = events.at(-1);
  return {
    id: `empty-results:${latestEvent?.id ?? `${state.categorySlug ?? "all"}:${state.query}`}`,
    kind: "search_friction",
    title: "Nie znaleźliśmy produktów",
    message: "Wyczyść wyszukiwanie i filtry, aby zobaczyć cały katalog w tej kategorii.",
    actionLabel: "Wyczyść wyszukiwanie i filtry",
    action: "clear-search-and-filters",
    data: { target: "catalog", filterKeys: [] },
    createdAt: latestEvent?.timestamp ?? latestTimestamp(events),
  };
}

function decisionFatigueProposal(
  returnEvent: Extract<CatalogEvent, { type: "return_to_listing" }>,
): AssistantProposal {
  const categoryAdvice: Record<string, string> = {
    lodowki: "Spróbuj zawęzić wybór według pojemności albo wysokości.",
    pralki: "Spróbuj zawęzić wybór według wsadu albo prędkości wirowania.",
    zmywarki: "Spróbuj zawęzić wybór według szerokości albo liczby kompletów.",
  };

  return {
    id: `decision-fatigue:${returnEvent.id}`,
    kind: "decision_fatigue",
    title: "Pomóc zawęzić wybór?",
    message:
      categoryAdvice[returnEvent.categorySlug] ??
      "Wybierz jeden parametr, który jest dla Ciebie najważniejszy, i zawęź nim wyniki.",
    actionLabel: "Przejdź do filtrów",
    action: "narrow-choice",
    data: { target: "filters", filterKeys: [] },
    createdAt: returnEvent.timestamp,
  };
}

function valuesMatchForFilter(
  firstValue: Product["specifications"][string] | undefined,
  secondValue: Product["specifications"][string] | undefined,
  filter: CategoryFilter,
): boolean {
  if (firstValue === undefined || secondValue === undefined) return false;

  if (filter.kind === "range") {
    const min = filter.min;
    const max = filter.max;

    if (
      typeof firstValue === "number" &&
      Number.isFinite(firstValue) &&
      typeof secondValue === "number" &&
      Number.isFinite(secondValue) &&
      typeof min === "number" &&
      typeof max === "number" &&
      max > min
    ) {
      return Math.abs(firstValue - secondValue) / (max - min) <=
        MAX_NORMALIZED_FILTER_DISTANCE;
    }
  }

  // Select values, booleans, and text must agree exactly. String conversion
  // treats numeric JSON values and their equivalent select option as equal.
  return String(firstValue) === String(secondValue);
}

function areSimilarProducts(
  first: Product,
  second: Product,
  categories: Category[],
): boolean {
  if (first.categorySlug !== second.categorySlug) return false;

  const category = categories.find((item) => item.slug === first.categorySlug);
  if (!category || category.specFilters.length === 0) return false;

  return category.specFilters.every((filter) =>
    valuesMatchForFilter(
      first.specifications[filter.key],
      second.specifications[filter.key],
      filter,
    ),
  );
}

/**
 * Replaceable MVP rules: prioritize a recoverable empty result, then look for
 * three distinct, pairwise-similar product details before returning to the list.
 */
export function DecisionEngine(
  events: CatalogEvent[],
  catalogState: CatalogState,
  catalog: { categories: Category[]; products: Product[] },
): AssistantProposal | null {
  const queryIsActive = catalogState.query.trim().length > 0;
  const filtersAreActive = hasActiveFilters(catalogState.filters);

  if (
    catalogState.resultCount === 0 &&
    (queryIsActive || filtersAreActive)
  ) {
    return emptyResultsProposal(events, catalogState);
  }

  if (!catalogState.categorySlug) return null;

  const returnIndex = events.findLastIndex(
    (event) =>
      event.type === "return_to_listing" &&
      event.categorySlug === catalogState.categorySlug,
  );
  if (returnIndex < 0) return null;

  const returnEvent = events[returnIndex];
  if (returnEvent.type !== "return_to_listing") return null;

  const listingEvent = events[returnIndex + 1];
  if (
    listingEvent?.type !== "listing_view" ||
    listingEvent.categorySlug !== catalogState.categorySlug
  ) {
    return null;
  }

  const laterRouteEvent = events.slice(returnIndex + 2).some(
    (event) =>
      event.type === "listing_view" ||
      event.type === "product_view" ||
      event.type === "return_to_listing",
  );
  const laterCatalogChange = events.slice(returnIndex + 2).some(
    (event) => event.type === "search_changed" || event.type === "filters_changed",
  );
  if (laterRouteEvent || laterCatalogChange) return null;

  const viewedProducts = new Map<string, Product>();
  for (let index = returnIndex - 1; index >= 0; index -= 1) {
    const event = events[index];
    if (event.type === "product_view" && event.categorySlug !== catalogState.categorySlug) {
      break;
    }
    if (event.type === "product_view" && event.categorySlug === catalogState.categorySlug) {
      const product = catalog.products.find((item) => item.id === event.productId);
      if (product?.categorySlug === catalogState.categorySlug) {
        viewedProducts.set(product.slug, product);
      }
    }

    if (viewedProducts.size >= 3) break;
    if (
      event.type === "listing_view" &&
      event.categorySlug !== catalogState.categorySlug
    ) {
      break;
    }
  }

  const recentProducts = [...viewedProducts.values()];
  const hasSimilarCluster =
    recentProducts.length >= 3 &&
    areSimilarProducts(recentProducts[0], recentProducts[1], catalog.categories) &&
    areSimilarProducts(recentProducts[0], recentProducts[2], catalog.categories) &&
    areSimilarProducts(recentProducts[1], recentProducts[2], catalog.categories);

  return hasSimilarCluster ? decisionFatigueProposal(returnEvent) : null;
}

export const evaluateAssistant = DecisionEngine;
