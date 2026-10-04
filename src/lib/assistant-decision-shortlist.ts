import type { CatalogEvent, Category, Product } from "@/lib/catalog-types";

export type ShortlistItem = {
  product: Product;
  rank: number;
  badge: string;
  badgeTone: "primary" | "muted";
};

export type DecisionShortlist = {
  items: ShortlistItem[];
  chips: string[];
  sessionSummary: string | null;
  tipTitle: string;
  tipMessage: string;
};

const CATEGORY_TIP_MESSAGES: Record<string, string> = {
  lodowki:
    "Różnice między tymi modelami to głównie pojemność, klasa energetyczna i cena.",
  pralki:
    "Różnice między tymi modelami to głównie wsad, prędkość wirowania i cena.",
  zmywarki:
    "Różnice między tymi modelami to głównie liczba zestawów, poziom hałasu i cena.",
};

const DEFAULT_TIP =
  "Różnice między tymi modelami to głównie cena i parametry.";

function productBySlug(products: readonly Product[], slug: string): Product | undefined {
  return products.find((product) => product.slug === slug);
}

function viewedSlugsInCategory(
  events: readonly CatalogEvent[],
  categorySlug: string,
): string[] {
  const seen = new Set<string>();
  const ordered: string[] = [];
  for (let index = events.length - 1; index >= 0; index -= 1) {
    const event = events[index];
    if (event.type !== "product_view" || event.categorySlug !== categorySlug) continue;
    if (seen.has(event.productSlug)) continue;
    seen.add(event.productSlug);
    ordered.push(event.productSlug);
  }
  return ordered;
}

function hasActiveFilters(events: readonly CatalogEvent[], categorySlug: string): boolean {
  for (let index = events.length - 1; index >= 0; index -= 1) {
    const event = events[index];
    if (event.type !== "filters_changed") continue;
    if (event.categorySlug !== categorySlug && event.categorySlug !== "all") continue;
    return Object.values(event.filters).some((value) => value.trim().length > 0);
  }
  return false;
}

function sessionMinutes(events: readonly CatalogEvent[], categorySlug: string): number | null {
  const timestamps = events
    .filter(
      (event): event is CatalogEvent & { type: "product_view" } =>
        event.type === "product_view" && event.categorySlug === categorySlug,
    )
    .map((event) => Date.parse(event.timestamp))
    .filter((value) => Number.isFinite(value));
  if (timestamps.length === 0) return null;
  const spanMs = Math.max(...timestamps) - Math.min(...timestamps);
  return Math.max(1, Math.round(spanMs / 60_000));
}

export function buildSessionSummary(
  events: readonly CatalogEvent[],
  category: Pick<Category, "slug" | "name">,
): string | null {
  const viewed = viewedSlugsInCategory(events, category.slug);
  if (viewed.length === 0) return null;
  const minutes = sessionMinutes(events, category.slug);
  const devices = `${viewed.length} ${category.name.toLocaleLowerCase("pl-PL")}`;
  if (minutes === null) {
    return `Przejrzałeś już ${devices} w tej kategorii.`;
  }
  return `Przejrzałeś już ${devices} w ciągu ${minutes} minut.`;
}

function pickDistinguishingSpec(
  product: Product,
  others: readonly Product[],
  category: Category | null,
): string | null {
  for (const spec of category?.specFilters ?? []) {
    const value = product.specifications[spec.key];
    if (value === undefined) continue;
    const allValues = [product, ...others].map(
      (item) => item.specifications[spec.key],
    );
    if (new Set(allValues.map(String)).size <= 1) continue;
    const unit = spec.unit ? ` ${spec.unit}` : "";
    return `${spec.label}: ${String(value)}${unit}`;
  }
  return null;
}

function assignBadges(
  items: readonly Product[],
  viewedSet: ReadonlySet<string>,
  category: Category | null,
): Map<string, { badge: string; badgeTone: "primary" | "muted" }> {
  const badges = new Map<string, { badge: string; badgeTone: "primary" | "muted" }>();
  if (items.length === 0) return badges;

  const lowestPrice = Math.min(...items.map((item) => item.price));
  badges.set(items[0].slug, { badge: "Najlepszy wybór", badgeTone: "primary" });

  for (const product of items.slice(1)) {
    if (product.price === lowestPrice) {
      badges.set(product.slug, { badge: "Najniższa cena z trójki", badgeTone: "muted" });
      continue;
    }
    if (viewedSet.has(product.slug)) {
      badges.set(product.slug, { badge: "Oglądany", badgeTone: "muted" });
      continue;
    }
    const others = items.filter((item) => item.slug !== product.slug);
    const specLabel = pickDistinguishingSpec(product, others, category);
    badges.set(product.slug, {
      badge: specLabel ?? "Inne parametry",
      badgeTone: "muted",
    });
  }

  return badges;
}

export function buildDecisionShortlist(input: {
  products: readonly Product[];
  events: readonly CatalogEvent[];
  category: Category | null;
  categorySlug: string | null;
}): DecisionShortlist | null {
  const { products, events, category, categorySlug } = input;
  if (products.length === 0 || !categorySlug) return null;

  const viewedOrder = viewedSlugsInCategory(events, categorySlug);
  const viewedSet = new Set(viewedOrder);
  const picked: Product[] = [];

  for (const slug of viewedOrder) {
    const product = productBySlug(products, slug);
    if (product && !picked.some((item) => item.slug === product.slug)) {
      picked.push(product);
    }
    if (picked.length >= 3) break;
  }

  if (picked.length < 3) {
    const fillers = [...products]
      .filter((product) => !picked.some((item) => item.slug === product.slug))
      .sort((a, b) => a.price - b.price);
    for (const product of fillers) {
      picked.push(product);
      if (picked.length >= 3) break;
    }
  }

  const items = picked.slice(0, 3);
  if (items.length === 0) return null;

  const badgeMap = assignBadges(items, viewedSet, category);
  const prices = items.map((item) => item.price);
  const minPrice = Math.min(...prices);
  const maxPrice = Math.max(...prices);
  const chips: string[] = [];
  if (minPrice === maxPrice) {
    chips.push(`Cena ok. ${minPrice} zł`);
  } else {
    chips.push(`Cena ${minPrice}–${maxPrice} zł`);
  }
  chips.push("Podobne parametry");
  if (hasActiveFilters(events, categorySlug)) {
    chips.push("Zgodne z Twoimi filtrami");
  }

  const slug = category?.slug ?? categorySlug;
  return {
    items: items.map((product, index) => {
      const badge = badgeMap.get(product.slug) ?? {
        badge: "Propozycja",
        badgeTone: "muted" as const,
      };
      return {
        product,
        rank: index + 1,
        badge: badge.badge,
        badgeTone: badge.badgeTone,
      };
    }),
    chips,
    sessionSummary: category ? buildSessionSummary(events, category) : null,
    tipTitle: "Wskazówka AI",
    tipMessage: CATEGORY_TIP_MESSAGES[slug] ?? DEFAULT_TIP,
  };
}
