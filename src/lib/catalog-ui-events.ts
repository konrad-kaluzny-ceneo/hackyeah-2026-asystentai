export const CLEAR_GLOBAL_SEARCH_EVENT = "dobre-agd:clear-global-search";
export const CATALOG_PRODUCT_VIEW_EVENT = "dobre-agd:catalog-product-view";
export const CATALOG_SEARCH_SUBMITTED_EVENT = "dobre-agd:catalog-search-submitted";

export type CatalogProductViewDetail = Readonly<{
  productId: string;
  categoryId: string;
  brandId: string;
}>;
