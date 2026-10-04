import type { Metadata } from "next";
import { connection } from "next/server";
import { notFound } from "next/navigation";
import CatalogListing from "@/components/catalog/catalog-listing";
import { CatalogUnavailable } from "@/components/catalog/catalog-unavailable";
import {
  getCategoryBySlug,
  getProductsForCategory,
} from "@/lib/catalog-repository";

type CategoryPageProps = {
  params: Promise<{ categorySlug: string }>;
  searchParams: Promise<{
    q?: string | string[];
    sort?: string | string[];
  }>;
};

export async function generateMetadata({ params }: CategoryPageProps): Promise<Metadata> {
  await connection();
  const { categorySlug } = await params;
  try {
    const category = await getCategoryBySlug(categorySlug);
    return { title: category?.name ?? "Kategoria", description: category?.description };
  } catch {
    return { title: "Kategoria AGD" };
  }
}

export default async function CategoryPage({ params, searchParams }: CategoryPageProps) {
  await connection();
  const [{ categorySlug }, queryParams] = await Promise.all([params, searchParams]);
  let category;
  let products;
  try {
    category = await getCategoryBySlug(categorySlug);
    if (category) products = await getProductsForCategory(category.slug);
  } catch (error) {
    console.error("Category listing query failed", error);
    return <CatalogUnavailable />;
  }
  if (!category) notFound();

  return (
    <main
      className="flex-1 bg-surface-muted"
    >
      <CatalogListing
        key={`${queryParams.q ?? ""}-${queryParams.sort ?? ""}`}
        category={category}
        products={products ?? []}
        initialQuery={(Array.isArray(queryParams.q) ? queryParams.q[0] : queryParams.q)?.trim() ?? ""}
        initialSort={parseSortParam(queryParams.sort)}
      />
    </main>
  );
}

function parseSortParam(value: string | string[] | undefined): "price_asc" | "price_desc" | null {
  const sort = Array.isArray(value) ? value[0] : value;
  return sort === "price_asc" || sort === "price_desc" ? sort : null;
}
