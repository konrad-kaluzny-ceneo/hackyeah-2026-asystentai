import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import { connection } from "next/server";
import { notFound } from "next/navigation";
import { AssistantProposalWidget } from "@/components/assistant/assistant-proposal-widget";
import { ProductCard } from "@/components/catalog/catalog-listing";
import { CatalogUnavailable } from "@/components/catalog/catalog-unavailable";
import {
  getCategoryBySlug,
  getProductBySlug,
  getSimilarProducts,
} from "@/lib/catalog-repository";
import type { Category, Product } from "@/lib/catalog-types";

type ProductPageProps = { params: Promise<{ productSlug: string }> };

export async function generateMetadata({ params }: ProductPageProps): Promise<Metadata> {
  await connection();
  const { productSlug } = await params;
  try {
    const product = await getProductBySlug(productSlug);
    return { title: product?.name ?? "Produkt", description: product?.shortDescription };
  } catch {
    return { title: "Produkt AGD" };
  }
}

export default async function ProductPage({ params }: ProductPageProps) {
  await connection();
  const { productSlug } = await params;
  let product: Product | undefined;
  let category: Category | undefined;
  let similarProducts: Product[] = [];
  try {
    product = await getProductBySlug(productSlug);
    if (product) {
      [category, similarProducts] = await Promise.all([
        getCategoryBySlug(product.categorySlug),
        getSimilarProducts(product, 4),
      ]);
    }
  } catch (error) {
    console.error("Product detail query failed", error);
    return <CatalogUnavailable />;
  }
  if (!product) notFound();

  return (
    <main
      data-catalog-context=""
      data-route-template="/produkt/[productSlug]"
      data-catalog-category-id={product.categoryId}
      data-catalog-category-slug={product.categorySlug}
      data-catalog-product-id={product.id}
      data-catalog-brand-id={product.brandId}
      data-active-filters="[]"
      data-element-id="product-detail"
      data-subject-product-id={product.id}
      data-subject-category-id={product.categoryId}
      data-subject-brand-id={product.brandId}
      className="mx-auto w-full max-w-7xl flex-1 px-5 pb-16 pt-6 sm:px-8"
    >
      <div className="mb-6 flex flex-wrap items-center gap-2 text-xs text-[#819087]">
        <Link href="/" className="hover:text-[#345743]">Strona główna</Link><span>/</span>
        <Link href="/katalog" className="hover:text-[#345743]">Katalog</Link><span>/</span>
        {category && <><Link href={`/katalog/${category.slug}`} className="hover:text-[#345743]">{category.name}</Link><span>/</span></>}
        <span className="text-[#314638]">{product.model}</span>
      </div>

      <section className="grid gap-8 md:grid-cols-[1.05fr_.95fr] md:gap-10 lg:gap-14">
        <div className="relative aspect-square overflow-hidden rounded-3xl bg-[#eef2ee] sm:aspect-[1.15/1]">
          <Image src={product.imageUrl} alt={product.name} fill preload sizes="(max-width: 768px) 100vw, 55vw" className="max-h-full max-w-full object-contain" />
          <span className="absolute left-5 top-5 rounded-full bg-white/90 px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-[#52675a]">{product.brand}</span>
        </div>
        <div className="flex flex-col py-1 md:py-5">
          <p className="text-xs font-bold uppercase tracking-[.16em] text-[#7f9185]">{product.model} · {category?.name ?? "Sprzęt AGD"}</p>
          <h1 className="mt-3 text-3xl font-semibold leading-tight tracking-[-.035em] sm:text-4xl">{product.name}</h1>
          <p className="mt-4 text-base leading-7 text-[#718078]">{product.shortDescription}</p>
          <div data-element-id="product-price" className="mt-7 border-y border-[#e5eae6] py-5">
            <p className="text-xs font-semibold uppercase tracking-wider text-[#8b9890]">Cena demonstracyjna</p>
            <p className="mt-1 text-4xl font-bold tracking-tight text-[#243f31]">{formatPrice(product.price)}</p>
          </div>
          <div className="mt-6">
            <AssistantProposalWidget />
          </div>
          <div className="mt-6 rounded-2xl border border-[#dce7de] bg-[#eef4ef] p-4">
            <p className="text-sm font-semibold text-[#304b38]">Szukasz modelu do konkretnych potrzeb?</p>
            <p className="mt-1 text-sm leading-6 text-[#66776b]">Wróć do listy, aby sprawdzić pozostałe urządzenia i dopasować parametry.</p>
            {category && <Link href={`/katalog/${category.slug}`} className="mt-3 inline-flex text-sm font-semibold text-[#365840] hover:underline">Zobacz kategorię →</Link>}
          </div>
          <p className="mt-4 text-xs leading-5 text-[#9aa49d]">Produkt demonstracyjny. Ceny i opisy służą wyłącznie prezentacji katalogu.</p>
        </div>
      </section>

      <section className="mt-12 grid gap-8 border-t border-[#e4e9e5] pt-9 lg:grid-cols-[.8fr_1.2fr]">
        <div
          data-element-id="product-description"
          data-subject-product-id={product.id}
          data-subject-category-id={product.categoryId}
          data-subject-brand-id={product.brandId}
        >
          <p className="text-xs font-bold uppercase tracking-[.16em] text-[#829389]">Opis produktu</p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight">Codzienna wygoda</h2>
          <p className="mt-4 text-sm leading-7 text-[#65736a]">{product.description}</p>
        </div>
        <div>
          <div className="flex items-end justify-between gap-4">
            <div><p className="text-xs font-bold uppercase tracking-[.16em] text-[#829389]">Dane techniczne</p><h2 className="mt-2 text-2xl font-semibold tracking-tight">Specyfikacja</h2></div>
            <span className="text-xs text-[#9aa49d]">{Object.keys(product.specifications).length} parametrów</span>
          </div>
          <dl className="mt-5 divide-y divide-[#e8ece9] rounded-2xl border border-[#e3e9e4] bg-white px-4">
            {Object.entries(product.specifications).map(([key, value]) => (
              <div data-element-id="product-specification" data-spec-key={key} key={key} className="grid grid-cols-[1fr_auto] gap-4 py-3 text-sm">
                <dt className="text-[#748178]">{specLabel(key)}</dt>
                <dd className="text-right font-medium text-[#314238]">{formatSpec(value, key)}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {similarProducts.length > 0 && (
        <section className="mt-14 border-t border-[#e4e9e5] pt-8">
          <div className="mb-5"><p className="text-xs font-bold uppercase tracking-[.16em] text-[#829389]">Podobne w tej kategorii</p><h2 className="mt-2 text-2xl font-semibold tracking-tight">Zobacz też</h2></div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{similarProducts.map((item) => <ProductCard key={item.id} product={item} />)}</div>
        </section>
      )}
    </main>
  );
}

function formatPrice(price: number) {
  return new Intl.NumberFormat("pl-PL", { style: "currency", currency: "PLN", maximumFractionDigits: 0 }).format(price);
}

const SPEC_LABELS: Record<string, string> = {
  capacityLiters: "Pojemność", heightCm: "Wysokość", widthCm: "Szerokość", depthCm: "Głębokość",
  energyClass: "Klasa energetyczna", installationType: "Typ montażu", noiseDb: "Poziom hałasu",
  freezerCapacityLiters: "Pojemność zamrażarki", noFrost: "System No Frost", shelves: "Liczba półek",
  doorReversible: "Przekładane drzwi", loadKg: "Wsad", spinRpm: "Prędkość wirowania",
  noiseWashDb: "Głośność prania", noiseSpinDb: "Głośność wirowania", programs: "Liczba programów",
  steam: "Pranie parowe", quickWashMinutes: "Czas szybkiego programu", waterPerCycleLiters: "Zużycie wody na cykl",
  steamFunction: "Funkcja pary", drumVolumeLiters: "Pojemność bębna",
  placeSettings: "Liczba kompletów", drying: "Suszenie", cutleryTray: "Szuflada na sztućce",
  waterConsumptionLiters: "Zużycie wody", autoOpen: "Automatyczne uchylanie", panelType: "Rodzaj panelu",
};

function specLabel(key: string) {
  return SPEC_LABELS[key] ?? key.replace(/([A-Z])/g, " $1").replace(/^./, (char) => char.toUpperCase());
}

function formatSpec(value: string | number | boolean, key: string) {
  if (typeof value === "boolean") return value ? "Tak" : "Nie";
  const unit = key.endsWith("Liters") ? " l" : key.endsWith("Cm") ? " cm" : key.endsWith("Kg") ? " kg" : key.endsWith("Rpm") ? " obr./min" : key.endsWith("Db") ? " dB" : key.endsWith("Minutes") ? " min" : key === "placeSettings" ? " kompletów" : key === "shelves" ? " szt." : "";
  return `${value}${unit}`;
}
