"use client";

import { useEffect } from "react";

import { initBehaviorTracker } from "@/behavior/initializer";
import {
  CATALOG_PRODUCT_VIEW_EVENT,
  CATALOG_SEARCH_SUBMITTED_EVENT,
  type CatalogProductViewDetail,
} from "@/lib/catalog-ui-events";

/**
 * Mounts the behavior tracker for the lifetime of the root layout. Renders
 * nothing — it's purely a side-effect wrapper. The tracker no-ops when the
 * feature flag is off (NEXT_PUBLIC_BEHAVIOR_TRACKING !== "true").
 */
export function BehaviorTracker() {
  useEffect(() => {
    const handle = initBehaviorTracker();
    if (handle === null) {
      return undefined;
    }
    const onCatalogProductView = (event: Event) => {
      const detail = (event as CustomEvent<CatalogProductViewDetail>).detail;
      if (!detail) return;
      handle.collector.emit("product_viewed", {
        elementId: "product-detail",
        subject: {
          productId: detail.productId,
          categoryId: detail.categoryId,
          brandId: detail.brandId,
        },
      });
    };
    const onCatalogSearchSubmitted = () => {
      handle.collector.emit("search_submitted", {
        elementId: "catalog-search",
      });
    };
    window.addEventListener(CATALOG_PRODUCT_VIEW_EVENT, onCatalogProductView);
    window.addEventListener(CATALOG_SEARCH_SUBMITTED_EVENT, onCatalogSearchSubmitted);
    return () => {
      window.removeEventListener(CATALOG_PRODUCT_VIEW_EVENT, onCatalogProductView);
      window.removeEventListener(CATALOG_SEARCH_SUBMITTED_EVENT, onCatalogSearchSubmitted);
      void handle.destroy();
    };
  }, []);
  return null;
}
