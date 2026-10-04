"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { BehaviorAnalyticsToggle } from "@/components/behavior-analytics-toggle";
import { trackCatalogEvent } from "@/lib/assistant-events";
import { CLEAR_GLOBAL_SEARCH_EVENT } from "@/lib/catalog-ui-events";
import type { Category } from "@/lib/catalog-types";

export default function SiteHeader({ categories }: { categories: Category[] }) {
  const pathname = usePathname();
  const router = useRouter();
  const [query, setQuery] = useState("");
  const pathParts = pathname.split("/").filter(Boolean);
  const categorySlug = pathParts[0] === "katalog" && pathParts[1] ? pathParts[1] : null;

  useEffect(() => {
    const clearGlobalSearch = () => setQuery("");
    window.addEventListener(CLEAR_GLOBAL_SEARCH_EVENT, clearGlobalSearch);
    return () => window.removeEventListener(CLEAR_GLOBAL_SEARCH_EVENT, clearGlobalSearch);
  }, []);

  function search(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalizedQuery = query.trim();
    trackCatalogEvent({ type: "search_changed", categorySlug, query: normalizedQuery });
    const destination = categorySlug ? `/katalog/${categorySlug}` : "/katalog";
    router.push(`${destination}?q=${encodeURIComponent(normalizedQuery)}`);
  }

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-white/95 backdrop-blur">
      <div className="mx-auto flex w-full max-w-[1440px] flex-wrap items-center gap-x-9 gap-y-3 px-5 py-4 lg:px-10">
        <Link href="/" className="flex shrink-0 items-center gap-2 text-[21px] font-extrabold tracking-[-0.06em] text-catalog-primary">
          dobre<span className="text-price">.</span>agd
          <span className="hidden rounded-full bg-badge-muted px-2 py-1 text-[9px] font-bold uppercase tracking-[0.12em] text-badge-muted-text sm:inline-flex">dom i kuchnia</span>
        </Link>

        <form onSubmit={search} role="search" className="order-3 flex w-full flex-1 sm:order-none sm:min-w-[240px]">
          <label className="sr-only" htmlFor="site-search">Szukaj produktów</label>
          <div className="flex w-full items-center gap-3 rounded-xl border border-border-strong bg-surface-muted px-4 transition focus-within:border-catalog-focus focus-within:bg-white focus-within:ring-2 focus-within:ring-catalog-primary/10">
            <svg aria-hidden="true" viewBox="0 0 24 24" className="h-[18px] w-[18px] shrink-0 text-icon" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="10.8" cy="10.8" r="6.3" /><path d="m16 16 4.1 4.1" /></svg>
            <input id="site-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Czego szukasz? Np. lodówka do małej kuchni" className="h-11 min-w-0 flex-1 bg-transparent text-sm text-catalog-primary outline-none placeholder:text-placeholder" />
            <button type="submit" className="hidden rounded-lg bg-catalog-primary px-4 py-2 text-xs font-semibold text-white transition hover:bg-catalog-primary-hover sm:block">Szukaj</button>
          </div>
          <button type="submit" aria-label="Szukaj" className="ml-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-catalog-primary text-white sm:hidden">
            <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="10.8" cy="10.8" r="6.3" /><path d="m16 16 4.1 4.1" /></svg>
          </button>
        </form>

        <div className="order-2 ml-auto flex shrink-0 items-center gap-2 sm:order-none">
          <BehaviorAnalyticsToggle />
        </div>

        <Link href="/katalog" className="hidden shrink-0 items-center gap-2 text-sm font-semibold text-nav transition hover:text-catalog-primary md:flex">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-surface text-catalog-focus" aria-hidden="true">⌕</span>
          Wszystkie kategorie
        </Link>
      </div>
      <nav aria-label="Kategorie produktów" className="border-t border-nav-divider">
        <div className="mx-auto flex w-full max-w-[1440px] items-center gap-7 overflow-x-auto px-5 py-2.5 text-[13px] font-medium text-label lg:px-10">
          <span className="hidden shrink-0 text-[10px] font-bold uppercase tracking-[0.13em] text-faint sm:inline">Popularne</span>
          {categories.map((category) => (
            <Link key={category.slug} href={`/katalog/${category.slug}`} className={`shrink-0 transition hover:text-catalog-primary ${categorySlug === category.slug ? "relative font-semibold text-catalog-primary after:absolute after:-bottom-[11px] after:left-0 after:right-0 after:h-0.5 after:rounded-full after:bg-catalog-primary" : ""}`}>
              {category.name}
            </Link>
          ))}
        </div>
      </nav>
    </header>
  );
}
