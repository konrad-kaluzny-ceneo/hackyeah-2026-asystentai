"use client";

import { useEffect } from "react";

import { initBehaviorTracker } from "@/behavior/initializer";
import {
  CATALOG_PRODUCT_VIEW_EVENT,
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
    window.addEventListener(CATALOG_PRODUCT_VIEW_EVENT, onCatalogProductView);
    return () => {
      window.removeEventListener(CATALOG_PRODUCT_VIEW_EVENT, onCatalogProductView);
      void handle.destroy();
    };
  }, []);
  return null;
}
