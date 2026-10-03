/**
 * Shared contract for the client behavior pipeline and the
 * `/api/meta-events` endpoint. Pure types — no runtime code here.
 *
 * Privacy rules (AGENTS.md + PRD):
 * - Raw events NEVER leave the browser; only MetaEvents are POSTed.
 * - No full HTML, DOM snapshots, form values, or free text are collected.
 * - `add_to_cart`, `compare_added`, `compare_removed`, `favorite_added`
 *   exist in the type contract for EXTERNAL consumers of this module, but
 *   the demo application never emits them (PRD Non-Goals).
 */

/** Schema version of the MetaEvent contract. Bump on breaking change. */
export const META_EVENT_SCHEMA_VERSION = "1.0" as const;
export type MetaEventSchemaVersion = typeof META_EVENT_SCHEMA_VERSION;

/** Schema version of the client-side raw-event buffer snapshot. */
export const RAW_EVENT_BUFFER_SCHEMA_VERSION = 1;

/** Algorithm version stamped into every MetaEvent (detector heuristics). */
export const DETECTOR_ALGORITHM_VERSION = "1.0" as const;

// ---------------------------------------------------------------------------
// Page classification
// ---------------------------------------------------------------------------

export const PAGE_TYPES = [
  "home",
  "catalog",
  "search",
  "category",
  "product",
  "offer",
  "cart",
  "checkout",
  "account",
  "unknown",
] as const;
export type PageType = (typeof PAGE_TYPES)[number];

// ---------------------------------------------------------------------------
// Subject kinds a MetaEvent can be about
// ---------------------------------------------------------------------------

export const SUBJECT_TYPES = [
  "product",
  "category",
  "offer",
  "search",
  "form",
] as const;
export type SubjectType = (typeof SUBJECT_TYPES)[number];

// ---------------------------------------------------------------------------
// Raw events (collected client-side only; never uploaded)
// ---------------------------------------------------------------------------

export const RAW_EVENT_NAMES = [
  "page_enter",
  "page_leave",
  "url_changed",
  "element_click",
  "element_exposure_started",
  "element_exposure_ended",
  "scroll_summary",
  "scroll_burst",
  "idle_started",
  "idle_ended",
  "filter_added",
  "filter_removed",
  "sort_changed",
  "search_submitted",
  "form_validation_failed",
  "ui_state_changed",
  "client_error",
  "request_failed",
  "product_viewed",
  "offer_viewed",
  // RESERVED for future use; the demo collector does NOT emit these.
  // See PRD Non-Goals / AGENTS.md "Behavior-tracking rules".
  "add_to_cart",
  "compare_added",
  "compare_removed",
  "favorite_added",
] as const;
export type RawEventName = (typeof RAW_EVENT_NAMES)[number];

export type EcommerceRawContext = Readonly<{
  categoryId?: string;
  productId?: string;
  offerId?: string;
  brandId?: string;
  filterId?: string;
  filterValueId?: string;
  sortingType?: string;
  /** Number of search/category results, bucketed (e.g. "0", "1-5", "6-20", "21+"). */
  resultsCountBucket?: string;
}>;

export type RawEvent = Readonly<{
  id: string;
  name: RawEventName;
  /** Epoch milliseconds (client clock; treated as untrusted by the server). */
  timestamp: number;
  /** Monotonic counter within the session, gap-tolerant. */
  sequenceNumber: number;
  sessionId: string;
  pageViewId: string;
  pageType: PageType;
  pathname: string;
  /**
   * Semantic identifier of the source element (from `data-element-id`
   * or a sanitized aria-label/role hash). Never raw text content.
   */
  elementId?: string;
  subject?: EcommerceRawContext;
  ecommerce?: EcommerceRawContext;
  /**
   * Optional small metadata (e.g. validation error CODE, scroll depth
   * bucket). Strings are coerced to known identifiers only — no user text.
   */
  data?: Readonly<Record<string, string | number | boolean>>;
}>;

// ---------------------------------------------------------------------------
// Client-side ecommerce context snapshot
// ---------------------------------------------------------------------------

export type ActiveFilter = Readonly<{
  id: string;
  valueIds?: readonly string[];
}>;

export type EcommerceContext = Readonly<{
  pageType: PageType;
  /** Sanitized pathname without query string. */
  pathname?: string;
  /** Safe route template (e.g. `/product/[id]`), never raw URL with PII. */
  routeTemplate?: string;
  categoryId?: string;
  productId?: string;
  offerId?: string;
  brandId?: string;
  activeFilters: readonly ActiveFilter[];
  activeFiltersCount: number;
  sortingType?: string;
  resultsCountBucket?: string;
  priceBucket?: string;
  deliveryCostBucket?: string;
  availability?: string;
  priceVisible?: boolean;
  deliveryVisible?: boolean;
  availabilityVisible?: boolean;
  viewportClass?: string;
  deviceClass?: string;
  experimentId?: string;
  experimentVariant?: string;
  currentJourneyStage?: string;
  previousPageType?: PageType;
}>;

/**
 * Implemented per-application. The default demo provider
 * (src/behavior/context-provider/demo.ts) returns a mostly-empty snapshot
 * until the F-02 mock catalog lands.
 */
export interface EcommerceContextProvider {
  getContext(): EcommerceContext;
}

// ---------------------------------------------------------------------------
// Meta events (uploaded to /api/meta-events)
// ---------------------------------------------------------------------------

export const META_EVENT_NAMES = [
  "rage_click",
  "dead_click_cluster",
  "repeated_validation_failure",
  "technical_friction",
  "navigation_loop",
  "no_progress_window",
  "rapid_filter_churn",
  "product_revisit",
  "comparison_oscillation",
  "category_interest",
  "filter_engagement",
  "hesitation_dwell",
  "rapid_scroll_burst",
  "price_focus",
  "search_refinement_loop",
  "assistant_proposal_dismissed",
  "delivery_information_seeking",
  "availability_information_seeking",
  "sustained_product_interest",
] as const;
export type MetaEventName = (typeof META_EVENT_NAMES)[number];

/** Allowlisted metric keys per meta event name. */
export const META_EVENT_METRICS_ALLOWLIST = {
  rage_click: ["clickCount", "windowMs", "elementId"] as const,
  dead_click_cluster: ["clickCount", "windowMs", "elementId"] as const,
  repeated_validation_failure: ["failureCount", "errorCode", "fieldType"] as const,
  technical_friction: ["retryCount", "errorKind", "waitMs"] as const,
  navigation_loop: ["cycleLength", "repeatCount", "pageTypes"] as const,
  no_progress_window: ["activeMs", "clickCount", "scrollCount", "filterChanges"] as const,
  rapid_filter_churn: ["filterChanges", "windowMs", "undoneCount"] as const,
  product_revisit: ["revisitCount", "distinctIntermediates", "productId"] as const,
  comparison_oscillation: ["candidateCount", "transitionCount"] as const,
  category_interest: ["categoryId", "dwellMs", "uniqueProducts"] as const,
  filter_engagement: ["filterCount", "filterIds", "windowMs", "retainedCount"] as const,
  hesitation_dwell: ["idleMs", "pageType"] as const,
  rapid_scroll_burst: ["burstCount", "distanceRatioBucket", "reversalCount"] as const,
  price_focus: ["dwellMs", "exposureCount", "productId"] as const,
  search_refinement_loop: ["searchCount", "windowMs"] as const,
  assistant_proposal_dismissed: ["pageType"] as const,
  delivery_information_seeking: ["exposureCount", "interactionCount"] as const,
  availability_information_seeking: ["exposureCount", "interactionCount"] as const,
  sustained_product_interest: ["sectionCount", "dwellMs", "sectionIds", "productId", "exposureCount"] as const,
} as const satisfies Record<MetaEventName, readonly string[]>;

export type Subject = Readonly<{
  type: SubjectType;
  id?: string;
  categoryId?: string;
  brandId?: string;
}>;

export type MetaEventQuality = Readonly<{
  /**
   * Normalized 0-1 detector confidence.
   * Not shopping-signal strength (FR-002). That reading lives in
   * `src/domain/shopping-signal.ts` and is not classified here.
   */
  strength: number;
  /** Number of raw events backing this meta event. */
  evidenceCount: number;
  algorithmVersion: string;
  /** True when the underlying buffer was pruned mid-window. */
  partialData: boolean;
}>;

export type MetaEventPrivacy = Readonly<{
  consentVersion?: string;
  containsFreeText: false;
  rawDataUploaded: false;
}>;

export type MetaEvent = Readonly<{
  schemaVersion: MetaEventSchemaVersion;
  eventId: string;
  name: MetaEventName;
  /** ISO-8601 timestamp set by the detector (client clock; untrusted). */
  detectedAt: string;
  window: Readonly<{
    startedAt: string;
    endedAt: string;
    durationMs: number;
  }>;
  identity: Readonly<{
    sessionId: string;
    pageViewId: string;
    journeyId?: string;
  }>;
  page: Readonly<{
    type: PageType;
    pathname?: string;
    routeTemplate?: string;
    previousPageType?: PageType;
  }>;
  subject?: Subject;
  ecommerce: Readonly<{
    activeFilters: readonly Readonly<{ id: string; valueIds?: readonly string[] }>[];
    activeFiltersCount: number;
    sortingType?: string;
    resultsCountBucket?: string;
    priceBucket?: string;
    deliveryCostBucket?: string;
    availability?: string;
    priceVisible?: boolean;
    deliveryVisible?: boolean;
    availabilityVisible?: boolean;
  }>;
  metrics: Readonly<Record<string, string | number | boolean>>;
  quality: MetaEventQuality;
  privacy: MetaEventPrivacy;
}>;

export type MetaEventBatchPayload = Readonly<{
  schemaVersion: MetaEventSchemaVersion;
  batchId: string;
  sentAt: string;
  events: readonly MetaEvent[];
}>;

// ---------------------------------------------------------------------------
// Analysis input to detectors
// ---------------------------------------------------------------------------

export type AnalysisContext = Readonly<{
  /** Events to analyze, in ascending timestamp order for the active window. */
  events: readonly RawEvent[];
  window: Readonly<{ startedAt: number; endedAt: number }>;
  sessionId: string;
  pageViewId: string;
  pageType: PageType;
  pathname: string;
  previousPageType?: PageType;
  ecommerce: EcommerceContext;
  /** Injectable clock for deterministic tests. */
  now: () => number;
}>;

/**
 * Implemented by every detector. Detectors are pure: they emit MetaEvents
 * from a snapshot of raw events and never touch the DOM, network, or storage.
 */
export interface MetaEventDetector {
  readonly name: MetaEventName;
  analyze(context: AnalysisContext): readonly MetaEvent[];
}

// ---------------------------------------------------------------------------
// Server-side response shape (documented so client + tests share the type)
// ---------------------------------------------------------------------------

export type BatchAcceptedResponse = Readonly<{
  batchId: string;
  acceptedEventIds: readonly string[];
  rejected: readonly Readonly<{
    eventId: string | null;
    reason:
      | "invalid_payload"
      | "unknown_event_name"
      | "duplicate"
      | "validation_failed";
  }>[];
}>;
