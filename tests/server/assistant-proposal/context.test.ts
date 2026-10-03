import { beforeEach, describe, expect, it, vi } from "vitest";

const catalogRepository = vi.hoisted(() => ({
  getCategoryBySlug: vi.fn(),
  getProductBySlug: vi.fn(),
}));

vi.mock("@/lib/catalog-repository", () => catalogRepository);

import type { Product } from "@/lib/catalog-types";
import { buildAssistantProposalContext } from "@/server/assistant-proposal/context";
import { category, requestBody } from "./fixtures";

function product(slug: string, id: string, brandId: string): Product {
  return {
    id,
    slug,
    categorySlug: category.slug,
    categoryId: category.id,
    brandId,
    brand: brandId,
    model: id,
    name: id,
    price: 1000,
    shortDescription: "Demo product",
    description: "Demo product",
    imageUrl: "",
    specifications: { capacityLiters: 250 },
  };
}

describe("buildAssistantProposalContext", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    catalogRepository.getCategoryBySlug.mockResolvedValue(category);
    catalogRepository.getProductBySlug.mockImplementation(async (slug: string) => {
      const id = slug === "lodowka-a" ? "product-a" : "product-b";
      const brandId = slug === "lodowka-a" ? "brand-a" : "brand-b";
      return product(slug, id, brandId);
    });
  });

  it("loads the active category and resolves only viewed products from that category", async () => {
    const context = await buildAssistantProposalContext(requestBody);

    expect(catalogRepository.getCategoryBySlug).toHaveBeenCalledWith("lodowki");
    expect(catalogRepository.getProductBySlug).toHaveBeenCalledTimes(3);
    expect(context.category).toEqual(category);
    expect(context.viewedProducts.map(({ slug }) => slug)).toEqual(["lodowka-a", "lodowka-b"]);
  });

  it("ignores product view claims whose catalog IDs do not match", async () => {
    const alteredRequest = {
      ...requestBody,
      events: requestBody.events.map((event) =>
        event.type === "product_view" && event.productSlug === "lodowka-a"
          ? { ...event, productId: "spoofed-product" }
          : event,
      ),
    };

    const context = await buildAssistantProposalContext(alteredRequest);
    expect(context.viewedProducts.map(({ slug }) => slug)).toEqual(["lodowka-b"]);
  });
});
