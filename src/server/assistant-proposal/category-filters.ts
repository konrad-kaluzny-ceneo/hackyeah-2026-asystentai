import { eq } from "drizzle-orm";

import type { CategoryFilter } from "@/lib/catalog-types";
import { getDb } from "@/lib/db/client";
import { categories } from "@/lib/db/schema";

export async function getCategoryFilters(
  categorySlug: string,
): Promise<CategoryFilter[]> {
  const [row] = await getDb()
    .select({ specFilters: categories.specFilters })
    .from(categories)
    .where(eq(categories.slug, categorySlug))
    .limit(1);

  return row?.specFilters ?? [];
}

export async function getCategoryFiltersById(
  categoryId: string,
): Promise<CategoryFilter[]> {
  const [row] = await getDb()
    .select({ specFilters: categories.specFilters })
    .from(categories)
    .where(eq(categories.id, categoryId))
    .limit(1);

  return row?.specFilters ?? [];
}
