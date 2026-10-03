import type { Metadata } from "next";
import { notFound } from "next/navigation";
import CatalogListing from "@/components/catalog/catalog-listing";
import { categories, getCategory, getProductsForCategory } from "@/lib/catalog-data";

type CategoryPageProps = {
  params: Promise<{ categorySlug: string }>;
  searchParams: Promise<{ q?: string | string[] }>;
};

export function generateStaticParams() {
  return categories.map(({ slug }) => ({ categorySlug: slug }));
}

export async function generateMetadata({ params }: CategoryPageProps): Promise<Metadata> {
  const { categorySlug } = await params;
  const category = getCategory(categorySlug);
  return { title: category?.name ?? "Kategoria", description: category?.description };
}

export default async function CategoryPage({ params, searchParams }: CategoryPageProps) {
  const [{ categorySlug }, queryParams] = await Promise.all([params, searchParams]);
  const category = getCategory(categorySlug);
  if (!category) notFound();

  return (
    <main className="flex-1 bg-[#f7f8f6]">
      <CatalogListing
        category={category}
        products={getProductsForCategory(category.slug)}
        initialQuery={(Array.isArray(queryParams.q) ? queryParams.q[0] : queryParams.q)?.trim() ?? ""}
      />
    </main>
  );
}
