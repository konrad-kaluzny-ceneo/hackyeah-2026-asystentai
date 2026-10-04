import type { ImplementedSignalKind } from "@/domain/shopping-signal";
import type { AssistantProposalIllustration } from "@/lib/assistant-proposal-api";

export type AssistantAction =
  | "narrow-choice"
  | "clear-search-and-filters"
  | "go-to-product"
  | "sort-by-price"
  | "set-budget"
  | "choose-brand"
  | "browse-category"
  | "explain-choice"
  | "none";

export type AssistantActionData = {
  target: "filters" | "catalog" | "product";
  filterKeys: string[];
  productSlug?: string;
  categorySlug?: string;
  sort?: "price_asc" | "price_desc";
  illustration?: AssistantProposalIllustration;
};

export type CategoryFilter = {
  key: string;
  label: string;
  unit?: string;
  kind: "range" | "select";
  min?: number;
  max?: number;
  options?: string[];
};

export type Category = {
  id: string;
  slug: string;
  name: string;
  description: string;
  imageUrl: string;
  specFilters: CategoryFilter[];
};

export type Product = {
  id: string;
  slug: string;
  categorySlug: string;
  categoryId: string;
  brandId: string;
  brand: string;
  model: string;
  name: string;
  price: number;
  shortDescription: string;
  description: string;
  imageUrl: string;
  specifications: Record<string, string | number | boolean>;
};

type EventBase = { id: string; timestamp: string };

export type CatalogEvent =
  | (EventBase & { type: "listing_view"; categorySlug: string; categoryId: string })
  | (EventBase & {
      type: "product_view";
      categorySlug: string;
      productSlug: string;
      productId: string;
      categoryId: string;
      brandId: string;
    })
  | (EventBase & { type: "return_to_listing"; categorySlug: string; categoryId: string })
  | (EventBase & {
      type: "search_changed";
      categorySlug: string | null;
      query: string;
    })
  | (EventBase & {
      type: "filters_changed";
      categorySlug: string;
      filters: Record<string, string>;
    });

export type CatalogEventInput = CatalogEvent extends infer Event
  ? Event extends CatalogEvent
    ? Omit<Event, keyof EventBase>
    : never
  : never;

export type CatalogState = {
  categorySlug: string | null;
  query: string;
  filters: Record<string, string>;
  resultCount: number;
  page: number;
};

export type AssistantProposal = {
  id: string;
  kind: ImplementedSignalKind | "jev_proposal";
  title: string;
  message: string;
  actionLabel: string;
  action: AssistantAction;
  data: AssistantActionData;
  createdAt: string;
};
