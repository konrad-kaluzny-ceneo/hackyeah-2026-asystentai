import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import { connection } from "next/server";
import CatalogListing from "@/components/catalog/catalog-listing";
import { AssistantProposalWidget } from "@/components/assistant/assistant-proposal-widget";
import { CatalogUnavailable } from "@/components/catalog/catalog-unavailable";
import { getCategories, getProducts } from "@/lib/catalog-repository";
import type { Category, Product } from "@/lib/catalog-types";

export const metadata: Metadata = {
  title: "Katalog AGD",
  description: "Wybierz kategorię i znajdź urządzenie AGD dla swojego domu.",
};

type CatalogPageProps = {
  searchParams: Promise<{
    q?: string | string[];
    sort?: string | string[];
  }>;
};

export default async function CatalogPage({
  searchParams,
}: CatalogPageProps) {
  await connection();
  const params = await searchParams;
  const query = (Array.isArray(params.q) ? params.q[0] : params.q)?.trim() ?? "";

  let categories: Category[] = [];
  let products: Product[] = [];
  let unavailable = false;
  try {
    if (query) products = await getProducts();
    else categories = await getCategories();
  } catch (error) {
    console.error("Catalog index query failed", error);
    unavailable = true;
  }
  if (unavailable) return <CatalogUnavailable />;
  if (query) {
    return (
      <CatalogListing
        key={`${params.q ?? ""}-${params.sort ?? ""}`}
        category={null}
        products={products}
        initialQuery={query}
        initialSort={parseSortParam(params.sort)}
      />
    );
  }

  return (
      <main data-catalog-context="" data-route-template="/katalog" className="mx-auto w-full max-w-7xl flex-1 px-5 pb-16 pt-10 sm:px-8">
        <div className="mb-9 max-w-2xl">
          <p className="text-xs font-bold uppercase tracking-[.16em] text-[#718779]">Wybierz dział</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-[-.035em] sm:text-4xl">Katalog sprzętu AGD</h1>
          <p className="mt-3 text-sm leading-6 text-[#718078]">Przejdź do wybranej kategorii, aby zobaczyć modele i zawęzić wyniki według parametrów.</p>
        </div>
        <AssistantProposalWidget />
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {categories.map((category, index) => (
            <Link key={category.id} href={`/katalog/${category.slug}`} className="group relative min-h-72 overflow-hidden rounded-3xl bg-[#e3ebe4]">
              <Image src={category.imageUrl} alt="" fill sizes="(max-width: 640px) 95vw, (max-width: 1024px) 45vw, 380px" className="max-h-full max-w-full object-contain transition duration-700" />
              <div className="absolute inset-0 bg-gradient-to-t from-[#10271c]/75 via-[#10271c]/10 to-transparent" />
              <div className="absolute inset-x-6 bottom-6 text-white">
                <p className="text-xs font-semibold uppercase tracking-[.15em] text-white/70">Kategoria 0{index + 1}</p>
                <h2 className="mt-2 text-2xl font-semibold tracking-tight">{category.name}</h2>
                <p className="mt-1 max-w-sm text-sm leading-5 text-white/80">{category.description}</p>
                <span className="mt-4 inline-flex items-center gap-2 text-sm font-semibold">Przeglądaj <span aria-hidden="true" className="transition group-hover:translate-x-1">→</span></span>
              </div>
            </Link>
          ))}
        </div>
      </main>
  );
}

function parseSortParam(value: string | string[] | undefined): "price_asc" | "price_desc" | null {
  const sort = Array.isArray(value) ? value[0] : value;
  return sort === "price_asc" || sort === "price_desc" ? sort : null;
}
