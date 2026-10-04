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
    <main data-catalog-context="" data-route-template="/" className="relative flex-1 bg-gradient-to-b from-[#faf8fd] via-white to-[#f7f4fc] text-[#181126] overflow-hidden">
      <div className="pointer-events-none absolute -top-40 left-1/2 -translate-x-1/2 h-[500px] w-full max-w-7xl bg-[radial-gradient(ellipse_at_top,_rgba(168,85,247,0.14),_transparent_65%)]" />

      <section className="relative mx-auto grid w-full max-w-7xl gap-12 px-5 py-12 sm:px-8 lg:grid-cols-[1.1fr_.9fr] lg:items-center lg:py-20">
        <div className="max-w-2xl">
          <p className="mb-5 inline-flex items-center gap-2 rounded-full border border-purple-200/80 bg-white/80 px-3.5 py-1.5 text-xs font-semibold uppercase tracking-[.16em] text-purple-700 shadow-xs backdrop-blur-xs">
            <span className="h-2 w-2 rounded-full bg-purple-600 ring-4 ring-purple-100" />
            Domowe wybory, prostsze
          </p>
          <h1 className="text-4xl font-semibold leading-[1.08] tracking-[-.04em] text-[#181126] sm:text-6xl">
            Wybierz sprzęt, który <span className="bg-gradient-to-r from-purple-700 to-violet-600 bg-clip-text text-transparent">pasuje do Ciebie.</span>
          </h1>
          <p className="mt-6 max-w-xl text-base leading-7 text-[#6b617a] sm:text-lg">
            Odkryj lodówki, pralki i zmywarki. Przejrzyste parametry pomogą Ci szybko znaleźć model do Twojego domu.
          </p>
          <CatalogSearchForm className="mt-8 flex max-w-xl gap-2 rounded-2xl border border-purple-100 bg-white p-2 shadow-[0_16px_40px_rgba(109,40,217,0.08)] transition focus-within:border-purple-300 focus-within:ring-4 focus-within:ring-purple-500/10" placeholder="Np. cicha pralka do małej łazienki" />
          <p className="mt-3 text-xs text-purple-400/80">Katalog demonstracyjny · marki i produkty mają charakter przykładowy</p>
        </div>

        <div className="relative mx-auto w-full max-w-lg">
          <div className="absolute -inset-5 rounded-[2.5rem] bg-gradient-to-tr from-purple-200/50 via-violet-100/40 to-purple-100/60 blur-xl opacity-75" />
          <div className="relative overflow-hidden rounded-[2rem] border border-purple-100/80 bg-gradient-to-br from-purple-50/70 via-purple-100/40 to-violet-50/60 p-4 sm:p-6 shadow-[0_12px_36px_rgba(109,40,217,0.07)] backdrop-blur-sm">
            <div className="grid grid-cols-2 gap-3">
              {categories.map((category, index) => (
                <Link
                  key={category.id}
                  href={`/katalog/${category.slug}`}
                  className={`group relative overflow-hidden rounded-2xl bg-white shadow-xs transition-all duration-300 hover:shadow-md ${index === 0 ? "col-span-2 aspect-[2.15/1]" : "aspect-square"}`}
                >
                  <Image src={category.imageUrl} alt="" fill loading={index === 0 ? "eager" : "lazy"} sizes="(max-width: 640px) 80vw, 360px" className="max-h-full max-w-full object-contain transition duration-500 group-hover:scale-105" />
                  <div className="absolute inset-0 bg-gradient-to-t from-purple-950/80 via-purple-950/20 to-transparent" />
                  <div className="absolute inset-x-4 bottom-4 flex items-end justify-between gap-2 text-white">
                    <span className="text-lg font-semibold tracking-tight">{category.name}</span>
                    <span aria-hidden="true" className="grid h-8 w-8 place-items-center rounded-full bg-white/20 backdrop-blur-sm transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5">↗</span>
                  </div>
                </Link>
              ))}
            </div>
            <div className="mx-1 mt-4 flex items-center justify-between rounded-2xl border border-purple-100/80 bg-white/85 px-4 py-3 text-sm text-purple-950/80 shadow-xs backdrop-blur-sm">
              <span>Wybrane urządzenia do domu</span>
              <span className="font-bold text-purple-700">{products.length} modeli</span>
            </div>
          </div>
        </div>
      </section>

      <section className="relative mx-auto w-full max-w-7xl px-5 pb-16 sm:px-8">
        <AssistantProposalWidget />
        <div className="mb-6 flex items-end justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[.16em] text-purple-700">Na początek</p>
            <h2 className="mt-2 text-2xl font-bold tracking-tight text-[#181126]">Poznaj wybrane modele</h2>
          </div>
          <Link href="/katalog" className="group inline-flex items-center gap-1 text-sm font-semibold text-purple-700 hover:text-purple-900">
            Cały katalog <span aria-hidden="true" className="transition-transform group-hover:translate-x-0.5">→</span>
          </Link>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {featuredProducts.map((product) => (
            <Link key={product.id} href={`/produkt/${product.slug}`} className="group rounded-2xl border border-purple-100/80 bg-white p-3.5 transition-all duration-300 hover:-translate-y-1 hover:border-purple-200 hover:shadow-[0_16px_36px_rgba(109,40,217,0.08)]">
              <div className="relative aspect-[1.15/1] overflow-hidden rounded-xl bg-gradient-to-b from-purple-50/40 to-purple-50/80">
                <Image src={product.imageUrl} alt={product.name} fill sizes="(max-width: 640px) 90vw, 280px" className="max-h-full max-w-full object-contain transition duration-500 group-hover:scale-105" />
              </div>
              <p className="mt-4 text-[11px] font-bold uppercase tracking-wider text-purple-400">{product.brand}</p>
              <h3 className="mt-1 line-clamp-2 min-h-10 text-sm font-semibold leading-5 text-[#181126] transition-colors group-hover:text-purple-700">{product.name}</h3>
              <p className="mt-3 text-lg font-bold text-purple-950">{formatPrice(product.price)}</p>
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
