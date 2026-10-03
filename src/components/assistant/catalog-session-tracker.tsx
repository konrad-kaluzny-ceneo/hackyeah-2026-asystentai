"use client";

import { Suspense, useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { getProduct } from "@/lib/catalog-data";
import { trackCatalogEvent } from "@/lib/assistant-events";

type RouteInfo =
  | { type: "listing"; categorySlug: string }
  | { type: "product"; productSlug: string; categorySlug: string }
  | null;

function routeInfo(pathname: string): RouteInfo {
  const listingMatch = pathname.match(/^\/katalog\/([^/]+)\/?$/);
  if (listingMatch) {
    return {
      type: "listing",
      categorySlug: decodeURIComponent(listingMatch[1]),
    };
  }

  const productMatch = pathname.match(/^\/produkt\/([^/]+)\/?$/);
  if (productMatch) {
    const productSlug = decodeURIComponent(productMatch[1]);
    const product = getProduct(productSlug);
    return product
      ? { type: "product", productSlug, categorySlug: product.categorySlug }
      : null;
  }

  return null;
}

function TrackerOnClient() {
  const pathname = usePathname();
  const previousRoute = useRef<RouteInfo>(null);

  useEffect(() => {
    if (!pathname) return;

    const nextRoute = routeInfo(pathname);
    const previous = previousRoute.current;

    if (nextRoute?.type === "listing") {
      if (previous?.type === "product" && previous.categorySlug === nextRoute.categorySlug) {
        trackCatalogEvent({
          type: "return_to_listing",
          categorySlug: nextRoute.categorySlug,
        });
      }
      trackCatalogEvent({ type: "listing_view", categorySlug: nextRoute.categorySlug });
    } else if (nextRoute?.type === "product") {
      trackCatalogEvent({
        type: "product_view",
        categorySlug: nextRoute.categorySlug,
        productSlug: nextRoute.productSlug,
      });
    }

    previousRoute.current = nextRoute;
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
