import "server-only";

import { asc, eq } from "drizzle-orm";

import { getDb } from "@/lib/db/client";
import { brands, categories, products } from "@/lib/db/schema";
import type { Category, Product } from "@/lib/catalog-types";

function mapCategory(row: typeof categories.$inferSelect): Category {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    description: row.description ?? "",
    imageUrl: row.imageUrl ?? "",
    specFilters: row.specFilters ?? [],
  };
}

function mapProduct(
  row: typeof products.$inferSelect,
  categorySlug: string,
  brand: typeof brands.$inferSelect,
): Product {
  return {
    id: row.id,
    slug: row.slug,
    categorySlug,
    categoryId: row.categoryId,
    brandId: brand.id,
    brand: brand.name,
    model: row.model,
    name: row.name,
    price: row.price,
    shortDescription: row.shortDescription ?? "",
    description: row.description ?? "",
    imageUrl: row.imageUrl ?? "",
    specifications: row.specifications ?? {},
  };
}

export async function getCategories(): Promise<Category[]> {
  const [rows, exampleImages] = await Promise.all([
    getDb()
      .select()
      .from(categories)
      .orderBy(asc(categories.id), asc(categories.slug)),
    getDb()
      .select({ categoryId: products.categoryId, imageUrl: products.imageUrl })
      .from(products)
      .orderBy(asc(products.categoryId), asc(products.id), asc(products.slug)),
  ]);
  const imageByCategory = new Map<string, string>();
  for (const { categoryId, imageUrl } of exampleImages) {
    if (!imageByCategory.has(categoryId)) imageByCategory.set(categoryId, imageUrl);
  }

  return rows.map((row) => ({
    ...mapCategory(row),
    imageUrl: imageByCategory.get(row.id) ?? row.imageUrl,
  }));
}

export async function getProducts(): Promise<Product[]> {
  const rows = await getDb()
    .select({ product: products, categorySlug: categories.slug, brand: brands })
    .from(products)
    .innerJoin(categories, eq(products.categoryId, categories.id))
    .innerJoin(brands, eq(products.brandId, brands.id))
    .orderBy(asc(products.id), asc(products.slug));

  return rows.map(({ product, categorySlug, brand }) =>
    mapProduct(product, categorySlug, brand),
  );
}

export async function getCategoryBySlug(
  slug: string,
): Promise<Category | undefined> {
  const [row] = await getDb()
    .select()
    .from(categories)
    .where(eq(categories.slug, slug))
    .limit(1);

  return row === undefined ? undefined : mapCategory(row);
}

export async function getProductBySlug(
  slug: string,
): Promise<Product | undefined> {
  const [row] = await getDb()
    .select({ product: products, categorySlug: categories.slug, brand: brands })
    .from(products)
    .innerJoin(categories, eq(products.categoryId, categories.id))
    .innerJoin(brands, eq(products.brandId, brands.id))
    .where(eq(products.slug, slug))
    .limit(1);

  return row === undefined
    ? undefined
    : mapProduct(row.product, row.categorySlug, row.brand);
}

export async function getProductsForCategory(
  categorySlug: string,
): Promise<Product[]> {
  const rows = await getDb()
    .select({ product: products, categorySlug: categories.slug, brand: brands })
    .from(products)
    .innerJoin(categories, eq(products.categoryId, categories.id))
    .innerJoin(brands, eq(products.brandId, brands.id))
    .where(eq(categories.slug, categorySlug))
    .orderBy(asc(products.id), asc(products.slug));

  return rows.map(({ product, categorySlug: slug, brand }) =>
    mapProduct(product, slug, brand),
  );
}

export async function getSimilarProducts(
  product: Product,
  limit = 4,
): Promise<Product[]> {
  if (!Number.isInteger(limit) || limit <= 0) {
    return [];
  }

  const rows = await getDb()
    .select({ product: products, categorySlug: categories.slug, brand: brands })
    .from(products)
    .innerJoin(categories, eq(products.categoryId, categories.id))
    .innerJoin(brands, eq(products.brandId, brands.id))
    .where(eq(categories.slug, product.categorySlug))
    .orderBy(asc(products.id), asc(products.slug))
    .limit(limit + 1);

  return rows
    .filter(({ product: candidate }) => candidate.slug !== product.slug)
    .slice(0, limit)
    .map(({ product: candidate, categorySlug, brand }) =>
      mapProduct(candidate, categorySlug, brand),
    );
}
