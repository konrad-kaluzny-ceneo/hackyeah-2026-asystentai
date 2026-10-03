import {
  getCategoryBySlug,
  getProductBySlug,
} from "@/lib/catalog-repository";
import type { CatalogAssistantProposalRequest } from "@/lib/assistant-proposal-api";
import type { Category, Product } from "@/lib/catalog-types";

const MAX_VIEWED_PRODUCTS = 5;

export type AssistantProposalContext = {
  readonly request: CatalogAssistantProposalRequest;
  readonly category: Category | null;
  readonly viewedProducts: readonly Product[];
};

export async function buildAssistantProposalContext(
  request: CatalogAssistantProposalRequest,
): Promise<AssistantProposalContext> {
  const categorySlug = request.state.categorySlug;
  if (categorySlug === null) {
    return { request, category: null, viewedProducts: [] };
  }

  const category = await getCategoryBySlug(categorySlug);
  if (category === undefined) {
    return { request, category: null, viewedProducts: [] };
  }

  const latestProductViews = new Map<
    string,
    Extract<CatalogAssistantProposalRequest["events"][number], { type: "product_view" }>
  >();
  for (const event of request.events) {
    if (event.type === "product_view" && event.categorySlug === categorySlug) {
      latestProductViews.set(event.productSlug, event);
    }
  }

  const eventsToResolve = [...latestProductViews.values()].slice(-MAX_VIEWED_PRODUCTS);
  const resolvedViews = await Promise.all(
    eventsToResolve.map(async (event) => ({
      event,
      product: await getProductBySlug(event.productSlug),
    })),
  );

  const viewedProducts = resolvedViews.flatMap(({ event, product }) => {
    if (
      product === undefined ||
      product.categorySlug !== categorySlug ||
      product.id !== event.productId ||
      product.categoryId !== event.categoryId ||
      product.brandId !== event.brandId ||
      category.id !== event.categoryId
    ) {
      return [];
    }
    return [product];
  });

  return { request, category, viewedProducts };
}
