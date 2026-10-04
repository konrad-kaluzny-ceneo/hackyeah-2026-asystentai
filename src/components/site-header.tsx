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
    <header className="sticky top-0 z-40 border-b border-purple-100/80 bg-white/90 backdrop-blur-md shadow-[0_1px_8px_rgba(124,58,237,0.03)] transition-all">
      <div className="mx-auto flex w-full max-w-[1440px] flex-wrap items-center gap-x-9 gap-y-3 px-5 py-3.5 lg:px-10">
        <Link href="/" className="flex shrink-0 items-center gap-2 text-[21px] font-extrabold tracking-[-0.06em] text-[#240e4a] group">
          dobre<span className="text-[#7c3aed] transition-transform duration-300 group-hover:scale-125 inline-block">.</span>agd
          <span className="hidden rounded-full border border-purple-200/60 bg-purple-50/80 px-2.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.14em] text-purple-700 sm:inline-flex">dom i kuchnia</span>
        </Link>

        <form onSubmit={search} role="search" className="order-3 flex w-full flex-1 sm:order-none sm:min-w-[240px]">
          <label className="sr-only" htmlFor="site-search">Szukaj produktów</label>
          <div className="flex w-full items-center gap-3 rounded-xl border border-purple-100 bg-purple-50/40 px-4 transition focus-within:border-purple-400 focus-within:bg-white focus-within:ring-3 focus-within:ring-purple-500/15">
            <svg aria-hidden="true" viewBox="0 0 24 24" className="h-[18px] w-[18px] shrink-0 text-purple-400" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="10.8" cy="10.8" r="6.3" /><path d="m16 16 4.1 4.1" /></svg>
            <input id="site-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Czego szukasz? Np. lodówka do małej kuchni" className="h-11 min-w-0 flex-1 bg-transparent text-sm text-[#181126] outline-none placeholder:text-purple-400/80" />
            <button type="submit" className="hidden rounded-lg bg-gradient-to-r from-purple-700 to-purple-600 px-4 py-2 text-xs font-semibold text-white shadow-xs transition hover:from-purple-800 hover:to-purple-700 active:scale-[0.98] sm:block">Szukaj</button>
          </div>
          <button type="submit" aria-label="Szukaj" className="ml-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-purple-700 text-white shadow-xs hover:bg-purple-800 active:scale-[0.98] sm:hidden">
            <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="10.8" cy="10.8" r="6.3" /><path d="m16 16 4.1 4.1" /></svg>
          </button>
        </form>

        <div className="order-2 ml-auto flex shrink-0 items-center gap-2 sm:order-none">
          <BehaviorAnalyticsToggle />
        </div>

        <Link href="/katalog" className="hidden shrink-0 items-center gap-2 text-sm font-semibold text-purple-950/80 transition hover:text-purple-700 md:flex">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-purple-100/70 text-purple-700" aria-hidden="true">⌕</span>
          Wszystkie kategorie
        </Link>
      </div>
      <nav aria-label="Kategorie produktów" className="border-t border-purple-50 bg-white/60">
        <div className="mx-auto flex w-full max-w-[1440px] items-center gap-7 overflow-x-auto px-5 py-2.5 text-[13px] font-medium text-[#6b617a] lg:px-10">
          <span className="hidden shrink-0 text-[10px] font-bold uppercase tracking-[0.14em] text-purple-400 sm:inline">Popularne</span>
          {categories.map((category) => (
            <Link key={category.slug} href={`/katalog/${category.slug}`} className={`shrink-0 transition hover:text-purple-700 ${categorySlug === category.slug ? "font-semibold text-purple-700 relative after:absolute after:-bottom-[11px] after:left-0 after:right-0 after:h-[2px] after:rounded-full after:bg-purple-600" : ""}`}>
              {category.name}
            </Link>
          ))}
        </div>
      </nav>
    </header>
  );
}
