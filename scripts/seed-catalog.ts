import { readFile } from "node:fs/promises";
import path from "node:path";
import { loadEnvConfig } from "@next/env";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { z } from "zod";
import { brands, categories, products } from "@/lib/db/schema";

const nonEmptyString = z.string().trim().min(1);
const specFilterSchema = z.discriminatedUnion("kind", [
  z.object({
    key: nonEmptyString,
    label: nonEmptyString,
    unit: z.string(),
    kind: z.literal("range"),
    min: z.number().finite(),
    max: z.number().finite(),
  }).strict().refine(({ min, max }) => min <= max, "min must be less than or equal to max"),
  z.object({
    key: nonEmptyString,
    label: nonEmptyString,
    unit: z.string(),
    kind: z.literal("select"),
    options: z.array(nonEmptyString).min(1),
  }).strict(),
]);

const categorySchema = z.object({
  id: nonEmptyString,
  slug: nonEmptyString,
  name: nonEmptyString,
  description: nonEmptyString,
  imageUrl: nonEmptyString,
  specFilters: z.array(specFilterSchema),
}).strict();

const productSchema = z.object({
  id: nonEmptyString,
  slug: nonEmptyString,
  categorySlug: nonEmptyString,
  brand: nonEmptyString,
  model: nonEmptyString,
  name: nonEmptyString,
  price: z.number().finite().nonnegative(),
  shortDescription: nonEmptyString,
  description: nonEmptyString,
  imageUrl: nonEmptyString,
  specifications: z.record(z.string(), z.union([
    z.string(), z.number().finite(), z.boolean(),
  ])),
}).strict();

function ensureUnique(values: string[], label: string): void {
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const value of values) {
    if (seen.has(value)) duplicates.add(value);
    seen.add(value);
  }
  if (duplicates.size > 0) {
    throw new Error(`${label} must be unique; duplicate value(s): ${[...duplicates].join(", ")}`);
  }
}

function brandIdFor(name: string): string {
  const id = name
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  if (!id) throw new Error(`Brand name ${JSON.stringify(name)} does not produce a valid ID`);
  return id;
}

async function readJson(filename: string): Promise<unknown> {
  const fullPath = path.join(process.cwd(), "data", filename);
  try {
    return JSON.parse(await readFile(fullPath, "utf8")) as unknown;
  } catch (error) {
    throw new Error(`Could not read or parse ${fullPath}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

async function main(): Promise<void> {
  loadEnvConfig(process.cwd());
  const [rawCategories, rawProducts] = await Promise.all([
    readJson("categories.json"),
    readJson("products.json"),
  ]);
  const parsedCategories = z.array(categorySchema).min(1).safeParse(rawCategories);
  const parsedProducts = z.array(productSchema).min(1).safeParse(rawProducts);
  if (!parsedCategories.success || !parsedProducts.success) {
    const details = [
      !parsedCategories.success ? `categories.json: ${parsedCategories.error.message}` : "",
      !parsedProducts.success ? `products.json: ${parsedProducts.error.message}` : "",
    ].filter(Boolean).join("\n");
    throw new Error(`Catalog seed validation failed:\n${details}`);
  }

  const categoryRows = parsedCategories.data;
  const productRows = parsedProducts.data;
  ensureUnique(categoryRows.map(({ id }) => id), "Category IDs");
  ensureUnique(categoryRows.map(({ slug }) => slug), "Category slugs");
  ensureUnique(productRows.map(({ id }) => id), "Product IDs");
  ensureUnique(productRows.map(({ slug }) => slug), "Product slugs");

  const categoryIdBySlug = new Map(categoryRows.map(({ id, slug }) => [slug, id]));
  const unknownCategorySlugs = [...new Set(productRows
    .map(({ categorySlug }) => categorySlug)
    .filter((slug) => !categoryIdBySlug.has(slug)))];
  if (unknownCategorySlugs.length > 0) {
    throw new Error(`Products reference unknown category slug(s): ${unknownCategorySlugs.join(", ")}`);
  }

  const brandNameById = new Map<string, string>();
  for (const { brand } of productRows) {
    const id = brandIdFor(brand);
    const existingName = brandNameById.get(id);
    if (existingName && existingName !== brand) {
      throw new Error(`Brand ID collision: ${JSON.stringify(existingName)} and ${JSON.stringify(brand)} both normalize to ${JSON.stringify(id)}.`);
    }
    brandNameById.set(id, brand);
  }
  if (brandNameById.size === 0) throw new Error("Catalog seed must contain at least one nonempty brand.");

  // Finish all mapping before opening a transaction, so invalid input never writes partial data.
  const categoryInserts = categoryRows.map(({ id, slug, name, description, imageUrl, specFilters }) => ({
    id, slug, name, description, imageUrl, specFilters,
  }));
  const brandInserts = [...brandNameById].map(([id, name]) => ({ id, name }));
  const productInserts = productRows.map(({ categorySlug, brand, ...product }) => ({
    ...product,
    categoryId: categoryIdBySlug.get(categorySlug)!,
    brandId: brandIdFor(brand),
  }));

  const connectionString = process.env.MIGRATION_DATABASE_URL;
  if (!connectionString) {
    throw new Error("MIGRATION_DATABASE_URL is required. Set it to a direct or session PostgreSQL connection URL; DATABASE_URL is not used.");
  }
  let databaseUrl: URL;
  try {
    databaseUrl = new URL(connectionString);
  } catch {
    throw new Error("MIGRATION_DATABASE_URL must be a valid PostgreSQL URL (postgres:// or postgresql://).");
  }
  if (!["postgres:", "postgresql:"].includes(databaseUrl.protocol) || !databaseUrl.hostname || !databaseUrl.pathname || databaseUrl.pathname === "/") {
    throw new Error("MIGRATION_DATABASE_URL must be a valid PostgreSQL URL (postgres:// or postgresql://) with a host and database name.");
  }

  const pool = new Pool({ connectionString });
  try {
    const db = drizzle(pool);
    await db.transaction(async (tx) => {
      for (const row of categoryInserts) {
        await tx.insert(categories).values(row).onConflictDoUpdate({
          target: categories.id,
          set: { slug: row.slug, name: row.name, description: row.description, imageUrl: row.imageUrl, specFilters: row.specFilters },
        });
      }
      for (const row of brandInserts) {
        await tx.insert(brands).values(row).onConflictDoUpdate({
          target: brands.id,
          set: { name: row.name },
        });
      }
      for (const row of productInserts) {
        await tx.insert(products).values(row).onConflictDoUpdate({
          target: products.id,
          set: {
            slug: row.slug,
            categoryId: row.categoryId,
            brandId: row.brandId,
            model: row.model,
            name: row.name,
            price: row.price,
            shortDescription: row.shortDescription,
            description: row.description,
            imageUrl: row.imageUrl,
            specifications: row.specifications,
          },
        });
      }
    });
    console.log(`Seeded ${categoryInserts.length} categories, ${brandInserts.length} brands, and ${productInserts.length} products.`);
  } finally {
    await pool.end();
  }
}

main().catch((error: unknown) => {
  console.error(`Catalog seed failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
