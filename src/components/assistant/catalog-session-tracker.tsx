"use client";

import { Suspense, useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { trackCatalogEvent } from "@/lib/assistant-events";
import { CATALOG_PRODUCT_VIEW_EVENT } from "@/lib/catalog-ui-events";

type RouteInfo =
  | { type: "listing"; categorySlug: string; categoryId: string }
  | {
      type: "product";
      productSlug: string;
      productId: string;
      categorySlug: string;
      categoryId: string;
      brandId: string;
    }
  | null;

function routeInfo(pathname: string): RouteInfo {
  const listingMatch = pathname.match(/^\/katalog\/([^/]+)\/?$/);
  const catalogContext = document.querySelector<HTMLElement>("[data-catalog-context]");
  if (listingMatch) {
    const categoryId = catalogContext?.dataset.catalogCategoryId;
    if (!categoryId) return null;
    return {
      type: "listing",
      categorySlug: decodeURIComponent(listingMatch[1]),
      categoryId,
    };
  }

  const productMatch = pathname.match(/^\/produkt\/([^/]+)\/?$/);
  if (productMatch) {
    const productSlug = decodeURIComponent(productMatch[1]);
    const productId = catalogContext?.dataset.catalogProductId;
    const categoryId = catalogContext?.dataset.catalogCategoryId;
    const categorySlug = catalogContext?.dataset.catalogCategorySlug;
    const brandId = catalogContext?.dataset.catalogBrandId;
    return productId && categoryId && categorySlug && brandId
      ? { type: "product", productSlug, productId, categorySlug, categoryId, brandId }
      : null;
  }

  return null;
}

function TrackerOnClient() {
  const pathname = usePathname();
  const previousRoute = useRef<RouteInfo>(null);

  useEffect(() => {
    if (!pathname) return;

    let productViewTimer: number | undefined;
    const nextRoute = routeInfo(pathname);
    const previous = previousRoute.current;

    if (nextRoute?.type === "listing") {
      if (previous?.type === "product" && previous.categorySlug === nextRoute.categorySlug) {
        trackCatalogEvent({
          type: "return_to_listing",
          categorySlug: nextRoute.categorySlug,
          categoryId: nextRoute.categoryId,
        });
      }
      trackCatalogEvent({
        type: "listing_view",
        categorySlug: nextRoute.categorySlug,
        categoryId: nextRoute.categoryId,
      });
    } else if (nextRoute?.type === "product") {
      trackCatalogEvent({
        type: "product_view",
        categorySlug: nextRoute.categorySlug,
        productSlug: nextRoute.productSlug,
        productId: nextRoute.productId,
        categoryId: nextRoute.categoryId,
        brandId: nextRoute.brandId,
      });
      productViewTimer = window.setTimeout(() => {
        window.dispatchEvent(
          new CustomEvent(CATALOG_PRODUCT_VIEW_EVENT, {
            detail: {
              productId: nextRoute.productId,
              categoryId: nextRoute.categoryId,
              brandId: nextRoute.brandId,
            },
          }),
        );
      }, 0);
    }

    previousRoute.current = nextRoute;
    return () => {
      if (productViewTimer !== undefined) window.clearTimeout(productViewTimer);
    };
  }, [pathname]);

  return null;
}

/** Add once in the shared layout to record only catalog listing and product routes. */
export function CatalogSessionTracker() {
  return (
    <Suspense fallback={null}>
      <TrackerOnClient />
    </Suspense>
  );
}
