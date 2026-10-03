"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
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
    <header className="sticky top-0 z-40 border-b border-[#e2e7e3] bg-white/95 backdrop-blur">
      <div className="mx-auto flex w-full max-w-[1440px] flex-wrap items-center gap-x-9 gap-y-3 px-5 py-4 lg:px-10">
        <Link href="/" className="flex shrink-0 items-center gap-2 text-[21px] font-extrabold tracking-[-0.06em] text-[#193b35]">
          dobre<span className="text-[#bd542e]">.</span>agd
          <span className="hidden rounded-full bg-[#f0f3ef] px-2 py-1 text-[9px] font-bold uppercase tracking-[0.12em] text-[#758079] sm:inline-flex">dom i kuchnia</span>
        </Link>

        <form onSubmit={search} role="search" className="order-3 flex w-full flex-1 sm:order-none sm:min-w-[240px]">
          <label className="sr-only" htmlFor="site-search">Szukaj produktów</label>
          <div className="flex w-full items-center gap-3 rounded-xl border border-[#dce3de] bg-[#f7f9f7] px-4 transition focus-within:border-[#52776c] focus-within:bg-white focus-within:ring-2 focus-within:ring-[#193b35]/10">
            <svg aria-hidden="true" viewBox="0 0 24 24" className="h-[18px] w-[18px] shrink-0 text-[#6c7c75]" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="10.8" cy="10.8" r="6.3" /><path d="m16 16 4.1 4.1" /></svg>
            <input id="site-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Czego szukasz? Np. lodówka do małej kuchni" className="h-11 min-w-0 flex-1 bg-transparent text-sm text-[#193b35] outline-none placeholder:text-[#8a9690]" />
            <button type="submit" className="hidden rounded-lg bg-[#193b35] px-4 py-2 text-xs font-semibold text-white transition hover:bg-[#28554c] sm:block">Szukaj</button>
          </div>
          <button type="submit" aria-label="Szukaj" className="ml-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#193b35] text-white sm:hidden">
            <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="10.8" cy="10.8" r="6.3" /><path d="m16 16 4.1 4.1" /></svg>
          </button>
        </form>

        <Link href="/katalog" className="ml-auto hidden shrink-0 items-center gap-2 text-sm font-semibold text-[#42524b] transition hover:text-[#193b35] md:flex">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#f0f3ef] text-[#47665c]" aria-hidden="true">⌕</span>
          Wszystkie kategorie
        </Link>
      </div>
      <nav aria-label="Kategorie produktów" className="border-t border-[#f0f2f0]">
        <div className="mx-auto flex w-full max-w-[1440px] items-center gap-7 overflow-x-auto px-5 py-2.5 text-[13px] font-medium text-[#65716b] lg:px-10">
          <span className="hidden shrink-0 text-[10px] font-bold uppercase tracking-[0.13em] text-[#98a19c] sm:inline">Popularne</span>
          {categories.map((category) => (
            <Link key={category.slug} href={`/katalog/${category.slug}`} className={`shrink-0 transition hover:text-[#193b35] ${categorySlug === category.slug ? "font-semibold text-[#193b35]" : ""}`}>
              {category.name}
            </Link>
          ))}
        </div>
      </nav>
    </header>
  );
}
