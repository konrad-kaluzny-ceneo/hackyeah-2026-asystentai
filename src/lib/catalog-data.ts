import categoriesJson from "../../data/categories.json";
import productsJson from "../../data/products.json";
import type { Category, Product } from "@/lib/catalog-types";

export const categories = categoriesJson as unknown as Category[];
export const products = productsJson as unknown as Product[];

export function getCategory(slug: string): Category | undefined {
  return categories.find((category) => category.slug === slug);
}

export function getProduct(slug: string): Product | undefined {
  return products.find((product) => product.slug === slug);
}

export function getProductsForCategory(categorySlug: string): Product[] {
  return products.filter((product) => product.categorySlug === categorySlug);
}

export function getSimilarProducts(product: Product, limit = 4): Product[] {
  return getProductsForCategory(product.categorySlug)
    .filter((candidate) => candidate.slug !== product.slug)
    .slice(0, limit);
}
