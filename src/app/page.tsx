import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import { connection } from "next/server";
import { CatalogSearchForm } from "@/components/catalog/catalog-search-form";
import { AssistantProposalWidget } from "@/components/assistant/assistant-proposal-widget";
import { CatalogUnavailable } from "@/components/catalog/catalog-unavailable";
import { getCategories, getProducts } from "@/lib/catalog-repository";
import type { Category, Product } from "@/lib/catalog-types";

export const metadata: Metadata = {
  title: "Katalog AGD",
  description: "Znajdź sprzęt AGD dopasowany do swojej kuchni i codziennych potrzeb.",
};

export default async function Home() {
  await connection();
  let categories: Category[];
  let products: Product[];
  try {
    [categories, products] = await Promise.all([getCategories(), getProducts()]);
  } catch (error) {
    console.error("Catalog home query failed", error);
    return <CatalogUnavailable />;
  }
  const featuredProducts = products.slice(0, 4);

  return (
    <main data-catalog-context="" data-route-template="/" className="flex-1 bg-surface-muted text-foreground">
      <section className="mx-auto grid w-full max-w-7xl gap-12 px-5 py-12 sm:px-8 lg:grid-cols-[1.1fr_.9fr] lg:items-center lg:py-20">
        <div className="max-w-2xl">
          <p className="mb-5 inline-flex items-center gap-2 rounded-full border border-border-strong bg-white px-3 py-1.5 text-xs font-semibold uppercase tracking-[.16em] text-catalog-primary">
            <span className="h-2 w-2 rounded-full bg-catalog-focus" />
            Domowe wybory, prostsze
          </p>
          <h1 className="text-4xl font-semibold leading-[1.08] tracking-[-.04em] sm:text-6xl">
            Wybierz sprzęt, który <span className="text-catalog-link">pasuje do Ciebie.</span>
          </h1>
          <p className="mt-6 max-w-xl text-base leading-7 text-muted sm:text-lg">
            Odkryj lodówki, pralki i zmywarki. Przejrzyste parametry pomogą Ci szybko znaleźć model do Twojego domu.
          </p>
          <CatalogSearchForm className="mt-8 flex max-w-xl gap-2 rounded-2xl border border-border-strong bg-white p-2 shadow-[0_12px_35px_rgba(30,54,38,.08)]" placeholder="Np. cicha pralka do małej łazienki" />
          <p className="mt-3 text-xs text-subtle">Katalog demonstracyjny · marki i produkty mają charakter przykładowy</p>
        </div>

        <div className="relative mx-auto w-full max-w-lg">
          <div className="absolute -inset-5 rounded-[2.5rem] bg-hero-outer" />
          <div className="relative overflow-hidden rounded-[2rem] bg-hero-inner p-4 sm:p-6">
            <div className="grid grid-cols-2 gap-3">
              {categories.map((category, index) => (
                <Link
                  key={category.id}
                  href={`/katalog/${category.slug}`}
                  className={`group relative overflow-hidden rounded-2xl bg-white ${index === 0 ? "col-span-2 aspect-[2.15/1]" : "aspect-square"}`}
                >
                  <Image src={category.imageUrl} alt="" fill loading={index === 0 ? "eager" : "lazy"} sizes="(max-width: 640px) 80vw, 360px" className="max-h-full max-w-full object-contain transition duration-500" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/5 to-transparent" />
                  <div className="absolute inset-x-4 bottom-4 flex items-end justify-between gap-2 text-white">
                    <span className="text-lg font-semibold">{category.name}</span>
                    <span aria-hidden="true" className="grid h-8 w-8 place-items-center rounded-full bg-white/20 backdrop-blur">↗</span>
                  </div>
                </Link>
              ))}
            </div>
            <div className="mx-1 mt-4 flex items-center justify-between rounded-2xl bg-white/75 px-4 py-3 text-sm text-nav">
              <span>Wybrane urządzenia do domu</span>
              <span className="font-semibold">{products.length} modeli</span>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto w-full max-w-7xl px-5 pb-16 sm:px-8">
        <AssistantProposalWidget />
        <div className="mb-6 flex items-end justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[.16em] text-label">Na początek</p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight">Poznaj wybrane modele</h2>
          </div>
          <Link href="/katalog" className="text-sm font-semibold text-catalog-primary hover:underline">Cały katalog →</Link>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {featuredProducts.map((product) => (
            <Link key={product.id} href={`/produkt/${product.slug}`} className="group rounded-2xl border border-border-divider bg-white p-3 transition hover:-translate-y-0.5 hover:shadow-lg">
              <div className="relative aspect-[1.15/1] overflow-hidden rounded-xl bg-surface-subtle">
                <Image src={product.imageUrl} alt={product.name} fill sizes="(max-width: 640px) 90vw, 280px" className="max-h-full max-w-full object-contain" />
              </div>
              <p className="mt-4 text-xs font-medium text-subtle">{product.brand}</p>
              <h3 className="mt-1 line-clamp-2 min-h-10 text-sm font-semibold leading-5">{product.name}</h3>
              <p className="mt-3 text-lg font-bold">{formatPrice(product.price)}</p>
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}

function formatPrice(price: number) {
  return new Intl.NumberFormat("pl-PL", { style: "currency", currency: "PLN", maximumFractionDigits: 0 }).format(price);
}
