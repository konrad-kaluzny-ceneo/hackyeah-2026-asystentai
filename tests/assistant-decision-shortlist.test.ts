import { describe, expect, it } from "vitest";

import {
  buildDecisionShortlist,
  buildSessionSummary,
} from "@/lib/assistant-decision-shortlist";
import type { CatalogEvent, Category, Product } from "@/lib/catalog-types";

const category: Category = {
  id: "cat-pralki",
  slug: "pralki",
  name: "Pralki",
  description: "",
  imageUrl: "/x.png",
  specFilters: [
    {
      key: "capacity",
      label: "Pojemność",
      unit: "kg",
      kind: "range",
      min: 5,
      max: 12,
    },
  ],
};

function product(slug: string, price: number, capacity: number): Product {
  return {
    id: slug,
    slug,
    categorySlug: "pralki",
    categoryId: "cat-pralki",
    brandId: "brand-a",
    brand: "BrandA",
    model: slug,
    name: `Pralka ${slug}`,
    price,
    shortDescription: "",
    description: "",
    imageUrl: "/p.png",
    specifications: { capacity },
  };
}

function productView(slug: string, at: string): CatalogEvent {
  return {
    id: `ev-${slug}-${at}`,
    timestamp: at,
    type: "product_view",
    categorySlug: "pralki",
    productSlug: slug,
    productId: slug,
    categoryId: "cat-pralki",
    brandId: "brand-a",
  };
}

describe("buildDecisionShortlist", () => {
  it("prefers viewed products and fills by lowest price", () => {
    const products = [
      product("cheap", 1000, 7),
      product("mid", 2000, 8),
      product("viewed-a", 2500, 9),
      product("viewed-b", 2600, 9),
      product("premium", 4000, 10),
    ];
    const events = [
      productView("viewed-a", "2026-10-04T10:00:00.000Z"),
      productView("viewed-b", "2026-10-04T10:05:00.000Z"),
    ];

    const shortlist = buildDecisionShortlist({
      products,
      events,
      category,
      categorySlug: "pralki",
    });

    expect(shortlist?.items.map((item) => item.product.slug)).toEqual([
      "viewed-b",
      "viewed-a",
      "cheap",
    ]);
    expect(shortlist?.items[0].badge).toBe("Najlepszy wybór");
    expect(shortlist?.items[2].badge).toBe("Najniższa cena z trójki");
  });

  it("builds session summary from viewed products and elapsed minutes", () => {
    const events = [
      productView("viewed-a", "2026-10-04T10:00:00.000Z"),
      productView("viewed-b", "2026-10-04T10:12:00.000Z"),
      productView("viewed-a", "2026-10-04T10:14:00.000Z"),
    ];

    expect(buildSessionSummary(events, category)).toBe(
      "Przejrzałeś już 2 pralki w ciągu 14 minut.",
    );
  });
});
