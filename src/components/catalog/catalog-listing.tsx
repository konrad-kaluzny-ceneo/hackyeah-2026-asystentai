"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AssistantInline } from "@/components/assistant/assistant-inline";
import { AssistantProposalWidget } from "@/components/assistant/assistant-proposal-widget";
import { trackCatalogEvent } from "@/lib/assistant-events";
import { subscribeAssistantCatalogAction } from "@/lib/assistant-proposal-state";
import { CLEAR_GLOBAL_SEARCH_EVENT, CATALOG_SEARCH_SUBMITTED_EVENT } from "@/lib/catalog-ui-events";
import type { ActiveFilter } from "@/behavior/types";
import type { CatalogState, Category, Product } from "@/lib/catalog-types";

const PAGE_SIZE = 20;

type CatalogListingProps = {
  category: Category | null;
  products: Product[];
  initialQuery?: string;
  initialSort?: "price_asc" | "price_desc" | null;
};

export default function CatalogListing({
  category,
  products,
  initialQuery = "",
  initialSort = null,
}: CatalogListingProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [query, setQuery] = useState(initialQuery);
  const [previousInitialQuery, setPreviousInitialQuery] = useState(initialQuery);
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [page, setPage] = useState(1);
  const [sortOrder, setSortOrder] = useState<"price_asc" | "price_desc" | null>(initialSort);
  const [highlightedFilters, setHighlightedFilters] = useState<string[]>([]);
  const categorySlug = category?.slug ?? null;
  const clearSearchAndFilters = useCallback(() => {
    setQuery("");
    setFilters({});
    setPage(1);
    trackCatalogEvent({ type: "search_changed", categorySlug, query: "" });
    trackCatalogEvent({ type: "filters_changed", categorySlug: category?.slug ?? "all", filters: {} });
    window.dispatchEvent(new Event(CLEAR_GLOBAL_SEARCH_EVENT));
    router.replace(pathname, { scroll: false });
  }, [category?.slug, categorySlug, pathname, router]);

  useEffect(() => {
    return subscribeAssistantCatalogAction((action) => {
      if (action.type === "clear-search-and-filters") clearSearchAndFilters();
      if (action.type === "sort-by-price") setSortOrder(action.sort);
      if (action.type === "highlight-filters") {
        setHighlightedFilters(action.filterKeys);
        const target = document.querySelector(
          `[data-filter-id="${action.filterKeys[0] ?? ""}"]`,
        );
        target?.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    });
  }, [clearSearchAndFilters]);

  useEffect(() => {
    const focusRequestedFilter = () => {
      const target = document.getElementById(window.location.hash.slice(1));
      if (!target || !target.id.startsWith("filter-")) return;
      const filterKey = target.id.slice("filter-".length);
      setHighlightedFilters([filterKey]);
      target.scrollIntoView({ behavior: "smooth", block: "center" });
      target.querySelector<HTMLElement>("input, select")?.focus({ preventScroll: true });
    };
    focusRequestedFilter();
    window.addEventListener("hashchange", focusRequestedFilter);
    return () => window.removeEventListener("hashchange", focusRequestedFilter);
  }, []);

  if (initialQuery !== previousInitialQuery) {
    setPreviousInitialQuery(initialQuery);
    setQuery(initialQuery);
    setPage(1);
  }

  const visibleProducts = useMemo(() => products.filter((product) => {
    const normalizedQuery = query.trim().toLocaleLowerCase("pl-PL");
    if (normalizedQuery) {
      const searchable = `${product.name} ${product.brand} ${product.model} ${product.shortDescription} ${Object.values(product.specifications).join(" ")}`.toLocaleLowerCase("pl-PL");
      if (!searchable.includes(normalizedQuery)) return false;
    }
    const minPrice = filters.priceMin ? Number(filters.priceMin) : undefined;
    const maxPrice = filters.priceMax ? Number(filters.priceMax) : undefined;
    if (minPrice !== undefined && product.price < minPrice) return false;
    if (maxPrice !== undefined && product.price > maxPrice) return false;
    if (filters.brand && product.brand !== filters.brand) return false;

    for (const spec of category?.specFilters ?? []) {
      const rawValue = product.specifications[spec.key];
      if (rawValue === undefined) continue;
      const numericValue = Number(rawValue);
      const min = filters[`${spec.key}Min`] ? Number(filters[`${spec.key}Min`]) : undefined;
      const max = filters[`${spec.key}Max`] ? Number(filters[`${spec.key}Max`]) : undefined;
      if (spec.kind === "range" && ((min !== undefined && numericValue < min) || (max !== undefined && numericValue > max))) return false;
      if (spec.kind === "select" && filters[spec.key] && String(rawValue) !== filters[spec.key]) return false;
    }
    return true;
  }), [category?.specFilters, filters, products, query]);

  const sortedProducts = useMemo(() => {
    if (sortOrder === null) return visibleProducts;
    const direction = sortOrder === "price_asc" ? 1 : -1;
    return [...visibleProducts].sort(
      (a, b) => (a.price - b.price) * direction,
    );
  }, [visibleProducts, sortOrder]);

  const totalPages = Math.max(1, Math.ceil(sortedProducts.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageProducts = sortedProducts.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  const state: CatalogState = { categorySlug, query, filters, resultCount: visibleProducts.length, page: safePage };
  const brands = [...new Set(products.map((product) => product.brand))].sort((a, b) => a.localeCompare(b, "pl-PL"));
  const activeFilters: ActiveFilter[] = [];
  if (filters.priceMin || filters.priceMax) activeFilters.push({ id: "price" });
  if (filters.brand) {
    const brandId = products.find((product) => product.brand === filters.brand)?.brandId;
    if (brandId) activeFilters.push({ id: "brand", valueIds: [brandId] });
  }
  for (const spec of category?.specFilters ?? []) {
    if (spec.kind === "select" && filters[spec.key]) {
      activeFilters.push({ id: spec.key, valueIds: [filters[spec.key]] });
    } else if (spec.kind === "range" && (filters[`${spec.key}Min`] || filters[`${spec.key}Max`])) {
      activeFilters.push({ id: spec.key });
    }
  }

  function updateFilter(key: string, value: string) {
    const next = { ...filters };
    if (value) next[key] = value;
    else delete next[key];
    setFilters(next);
    setPage(1);
    trackCatalogEvent({ type: "filters_changed", categorySlug: category?.slug ?? "all", filters: next });
  }

  function updateQuery(value: string) {
    setQuery(value);
    setPage(1);
    trackCatalogEvent({ type: "search_changed", categorySlug, query: value });
    if (value.trim().length > 0) {
      window.dispatchEvent(new Event(CATALOG_SEARCH_SUBMITTED_EVENT));
    }
  }

  return (
    <div
      data-catalog-context=""
      data-route-template={category ? "/katalog/[categorySlug]" : "/katalog"}
      data-catalog-category-id={category?.id}
      data-catalog-category-slug={category?.slug}
      data-active-filters={JSON.stringify(activeFilters)}
      className="mx-auto w-full max-w-7xl px-5 pb-16 pt-6 sm:px-8"
    >
      <div className="mb-5 flex flex-wrap items-center gap-2 text-xs text-purple-400/90">
        <Link href="/" className="hover:text-purple-700 transition">Strona główna</Link><span>/</span>
        {category ? <Link href="/katalog" className="hover:text-purple-700 transition">Katalog</Link> : <span>Katalog</span>}
        {category && <><span>/</span><span className="font-semibold text-purple-950">{category.name}</span></>}
      </div>
      <div className="mb-8 flex flex-col justify-between gap-5 border-b border-purple-100 pb-7 md:flex-row md:items-end">
        <div>
          <p className="text-xs font-bold uppercase tracking-[.16em] text-purple-700">Katalog AGD</p>
          <h1 className="mt-2 text-3xl font-bold tracking-[-.035em] text-[#181126] sm:text-4xl">{category?.name ?? "Wyniki wyszukiwania"}</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[#6b617a]">{category?.description ?? (query ? `Modele pasujące do frazy „${query}”.` : "Znajdź urządzenie według marki i parametrów.")}</p>
        </div>
        <form action={category ? `/katalog/${category.slug}` : "/katalog"} onSubmit={(event) => {
          const formData = new FormData(event.currentTarget);
          trackCatalogEvent({ type: "search_changed", categorySlug, query: String(formData.get("q") ?? "") });
        }} className="flex w-full max-w-md gap-2 rounded-xl border border-purple-100 bg-white p-1.5 shadow-xs transition focus-within:border-purple-300 focus-within:ring-2 focus-within:ring-purple-500/10">
          <label className="flex min-w-0 flex-1 items-center px-3">
            <span className="sr-only">Szukaj w katalogu</span>
            <input data-element-id="catalog-search" name="q" value={query} onChange={(event) => updateQuery(event.target.value)} placeholder="Szukaj w katalogu" className="w-full bg-transparent py-2 text-sm text-[#181126] outline-none placeholder:text-purple-400/80" />
          </label>
          <button className="rounded-lg bg-gradient-to-r from-purple-700 to-purple-600 px-4 py-2 text-sm font-semibold text-white shadow-xs transition hover:from-purple-800 hover:to-purple-700 active:scale-[0.98]" type="submit">Szukaj</button>
        </form>
      </div>

      <div className="grid items-start gap-6 md:grid-cols-[240px_minmax(0,1fr)]">
        <aside id="filters" className="rounded-2xl border border-purple-100/90 bg-white p-5 shadow-xs md:sticky md:top-20">
          <div className="flex items-center justify-between">
            <h2 className="font-bold text-[#181126]">Filtry</h2>
            {visibleProducts.length > 0 && <button data-element-id="filter-clear" type="button" onClick={clearSearchAndFilters} className="text-xs font-semibold text-purple-700 hover:text-purple-900 transition">Wyczyść</button>}
          </div>
          <div id="filter-price" className="mt-5 scroll-mt-24 border-t border-purple-100/70 pt-4" data-highlighted={highlightedFilters.includes("price") || undefined}>
            <p className={`mb-3 text-sm font-semibold ${highlightedFilters.includes("price") ? "text-purple-700" : "text-[#181126]"}`}>Cena</p>
            <div className="grid grid-cols-2 gap-2">
              <label className="text-[11px] font-medium text-purple-950/70">Od
                <input data-element-id="filter-price-min" data-filter-id="price" aria-label="Cena od" inputMode="numeric" type="number" min="0" value={filters.priceMin ?? ""} onChange={(event) => updateFilter("priceMin", event.target.value)} placeholder="0 zł" className="mt-1 w-full rounded-lg border border-purple-100 bg-purple-50/20 px-2.5 py-2 text-sm text-[#181126] outline-none transition focus:border-purple-500 focus:bg-white focus:ring-2 focus:ring-purple-500/10" />
              </label>
              <label className="text-[11px] font-medium text-purple-950/70">Do
                <input data-element-id="filter-price-max" data-filter-id="price" aria-label="Cena do" inputMode="numeric" type="number" min="0" value={filters.priceMax ?? ""} onChange={(event) => updateFilter("priceMax", event.target.value)} placeholder="bez limitu" className="mt-1 w-full rounded-lg border border-purple-100 bg-purple-50/20 px-2.5 py-2 text-sm text-[#181126] outline-none transition focus:border-purple-500 focus:bg-white focus:ring-2 focus:ring-purple-500/10" />
              </label>
            </div>
          </div>
          <div id="filter-brand" className="mt-5 scroll-mt-24 border-t border-purple-100/70 pt-4" data-highlighted={highlightedFilters.includes("brand") || undefined}>
            <label className={`block text-sm font-semibold ${highlightedFilters.includes("brand") ? "text-purple-700" : "text-[#181126]"}`} htmlFor="brand-filter">Producent</label>
            <select data-element-id="filter-brand" data-filter-id="brand" id="brand-filter" value={filters.brand ?? ""} onChange={(event) => updateFilter("brand", event.target.value)} className="mt-3 w-full rounded-lg border border-purple-100 bg-purple-50/20 px-3 py-2.5 text-sm text-[#181126] outline-none transition focus:border-purple-500 focus:bg-white focus:ring-2 focus:ring-purple-500/10">
              <option value="">Wszyscy producenci</option>
              {brands.map((brand) => <option key={brand} value={brand}>{brand}</option>)}
            </select>
          </div>
          {category?.specFilters.map((spec) => (
            <div id={`filter-${spec.key}`} key={spec.key} className={`mt-5 scroll-mt-24 border-t border-purple-100/70 pt-4 ${highlightedFilters.includes(spec.key) ? "rounded-xl p-2 ring-2 ring-purple-300 bg-purple-50/40" : ""}`}>
              <p className={`mb-3 text-sm font-semibold ${highlightedFilters.includes(spec.key) ? "text-purple-700" : "text-[#181126]"}`}>{spec.label}</p>
              {spec.kind === "select" ? (
                <select data-element-id={`filter-${spec.key}`} data-filter-id={spec.key} aria-label={spec.label} value={filters[spec.key] ?? ""} onChange={(event) => updateFilter(spec.key, event.target.value)} className="w-full rounded-lg border border-purple-100 bg-purple-50/20 px-3 py-2.5 text-sm text-[#181126] outline-none transition focus:border-purple-500 focus:bg-white focus:ring-2 focus:ring-purple-500/10">
                  <option value="">Dowolna</option>
                  {spec.options?.map((option) => <option key={option} value={option}>{option}{spec.unit ? ` ${spec.unit}` : ""}</option>)}
                </select>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  <label className="text-[11px] font-medium text-purple-950/70">Od
                    <input data-element-id={`filter-${spec.key}-min`} data-filter-id={spec.key} aria-label={`${spec.label} od`} type="number" min={spec.min} max={spec.max} value={filters[`${spec.key}Min`] ?? ""} onChange={(event) => updateFilter(`${spec.key}Min`, event.target.value)} placeholder={String(spec.min ?? "")} className="mt-1 w-full rounded-lg border border-purple-100 bg-purple-50/20 px-2.5 py-2 text-sm text-[#181126] outline-none transition focus:border-purple-500 focus:bg-white focus:ring-2 focus:ring-purple-500/10" />
                  </label>
                  <label className="text-[11px] font-medium text-purple-950/70">Do
                    <input data-element-id={`filter-${spec.key}-max`} data-filter-id={spec.key} aria-label={`${spec.label} do`} type="number" min={spec.min} max={spec.max} value={filters[`${spec.key}Max`] ?? ""} onChange={(event) => updateFilter(`${spec.key}Max`, event.target.value)} placeholder={String(spec.max ?? "")} className="mt-1 w-full rounded-lg border border-purple-100 bg-purple-50/20 px-2.5 py-2 text-sm text-[#181126] outline-none transition focus:border-purple-500 focus:bg-white focus:ring-2 focus:ring-purple-500/10" />
                  </label>
                  {spec.unit && <span className="col-span-2 text-[11px] text-purple-400">Wartości w {spec.unit}</span>}
                </div>
              )}
            </div>
          ))}
        </aside>

        <section aria-label="Lista produktów">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-[#6b617a]">Znaleziono <strong className="text-[#181126]">{visibleProducts.length}</strong> {plural(visibleProducts.length, "produkt", "produkty", "produktów")}</p>
            <div className="flex items-center gap-3">
              {sortOrder !== null && (
                <button
                  type="button"
                  data-element-id="assistant-sort-clear"
                  onClick={() => setSortOrder(null)}
                  className="rounded-lg border border-purple-200 bg-purple-50/60 px-3 py-1.5 text-xs font-semibold text-purple-700 hover:bg-purple-100/80 transition"
                >
                  {sortOrder === "price_asc" ? "Cena: rosnąco ✕" : "Cena: malejąco ✕"}
                </button>
              )}
              <span className="text-xs text-purple-400/80">Modele demonstracyjne</span>
            </div>
          </div>

          <AssistantProposalWidget />
          <AssistantInline
            state={state}
            catalog={{ categories: category ? [category] : [], products }}
            onClearSearchAndFilters={clearSearchAndFilters}
          />

          {visibleProducts.length > 0 ? (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {pageProducts.map((product) => <ProductCard key={product.id} product={product} />)}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-purple-200 bg-purple-50/30 px-6 py-14 text-center">
              <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-purple-100 text-xl text-purple-700">⌕</span>
              <h2 className="mt-4 text-xl font-bold text-[#181126]">Nie znaleźliśmy takich urządzeń</h2>
              <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[#6b617a]">Zmień frazę albo poluzuj filtry. Możesz też zacząć wyszukiwanie od początku.</p>
            </div>
          )}

          {totalPages > 1 && (
            <nav aria-label="Strony wyników" className="mt-8 flex items-center justify-center gap-2">
              <button type="button" data-element-id="pagination-prev" disabled={safePage === 1} onClick={() => setPage((current) => Math.max(1, current - 1))} className="rounded-xl border border-purple-100 bg-white px-4 py-2 text-sm font-medium text-purple-900 shadow-xs hover:border-purple-200 hover:bg-purple-50/50 transition disabled:cursor-not-allowed disabled:opacity-40">← Poprzednia</button>
              <span className="px-2 text-sm font-medium text-[#6b617a]">{safePage} / {totalPages}</span>
              <button type="button" data-element-id="pagination-next" disabled={safePage === totalPages} onClick={() => setPage((current) => Math.min(totalPages, current + 1))} className="rounded-xl border border-purple-100 bg-white px-4 py-2 text-sm font-medium text-purple-900 shadow-xs hover:border-purple-200 hover:bg-purple-50/50 transition disabled:cursor-not-allowed disabled:opacity-40">Następna →</button>
            </nav>
          )}

          {visibleProducts.length > 0 && <Recommendations title="Może Cię zainteresować" items={products.filter((product) => product.categorySlug === (category?.slug ?? pageProducts[0]?.categorySlug) && !pageProducts.some((current) => current.id === product.id)).slice(0, 4)} />}
        </section>
      </div>
    </div>
  );
}

export function ProductCard({ product }: { product: Product }) {
  return (
    <Link href={`/produkt/${product.slug}`} data-element-id="product-card" data-subject-product-id={product.id} data-subject-category-id={product.categoryId} data-subject-brand-id={product.brandId} className="group flex h-full flex-col rounded-2xl border border-purple-100/80 bg-white p-3.5 transition-all duration-300 hover:-translate-y-1 hover:border-purple-200 hover:shadow-[0_16px_36px_rgba(109,40,217,0.08)]">
      <div className="relative aspect-[1.2/1] overflow-hidden rounded-xl bg-gradient-to-b from-purple-50/40 to-purple-50/80">
        <Image src={product.imageUrl} alt={product.name} fill sizes="(max-width: 640px) 90vw, (max-width: 1280px) 44vw, 300px" className="max-h-full max-w-full object-contain transition duration-500 group-hover:scale-105" />
        <span className="absolute left-3 top-3 rounded-full border border-purple-100/80 bg-white/90 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-purple-700 shadow-xs">{product.brand}</span>
      </div>
      <div className="flex flex-1 flex-col px-1 pb-1 pt-4">
        <p className="text-[11px] font-semibold text-purple-400/90">{product.model}</p>
        <h3 className="mt-1 line-clamp-2 min-h-10 text-sm font-semibold leading-5 text-[#181126] transition-colors group-hover:text-purple-700">{product.name}</h3>
        <p className="mt-2 line-clamp-2 text-xs leading-5 text-[#6b617a]">{product.shortDescription}</p>
        <div className="mt-auto flex items-end justify-between gap-2 pt-4">
          <p className="text-xl font-bold tracking-tight text-purple-950">{formatPrice(product.price)}</p>
          <span aria-hidden="true" className="grid h-8 w-8 place-items-center rounded-full bg-purple-50 text-purple-700 transition group-hover:bg-purple-700 group-hover:text-white">↗</span>
        </div>
      </div>
    </Link>
  );
}

export function Recommendations({ title, items }: { title: string; items: Product[] }) {
  if (items.length === 0) return null;
  return (
    <section className="mt-12 border-t border-purple-100 pt-7">
      <div className="mb-4 flex items-end justify-between gap-3">
        <div><p className="text-[10px] font-bold uppercase tracking-[.16em] text-purple-700">Dalsze inspiracje</p><h2 className="mt-1 text-xl font-bold text-[#181126]">{title}</h2></div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{items.map((product) => <ProductCard key={product.id} product={product} />)}</div>
    </section>
  );
}

function formatPrice(price: number) {
  return new Intl.NumberFormat("pl-PL", { style: "currency", currency: "PLN", maximumFractionDigits: 0 }).format(price);
}

function plural(count: number, singular: string, pluralNominative: string, pluralGenitive: string) {
  if (count === 1) return singular;
  return count % 10 >= 2 && count % 10 <= 4 && (count % 100 < 12 || count % 100 > 14) ? pluralNominative : pluralGenitive;
}
