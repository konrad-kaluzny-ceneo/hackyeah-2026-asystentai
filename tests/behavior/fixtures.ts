import {
  META_EVENT_SCHEMA_VERSION,
  DETECTOR_ALGORITHM_VERSION,
  type AnalysisContext,
  type EcommerceContext,
  type MetaEvent,
  type MetaEventName,
  type PageType,
  type RawEvent,
  type RawEventName,
} from "@/behavior/types";

/**
 * Deterministic test helpers. Every factory takes a Clock so detectors can be
 * exercised with vi.useFakeTimers() without ever hitting real time.
 */

let counter = 0;

export function resetFixtureSeed(): void {
  counter = 0;
}

export function makeId(prefix: string): string {
  counter += 1;
  return `${prefix}-${String(counter).padStart(6, "0")}`;
}

export function makeClock(startMs = 0): {
  readonly now: () => number;
  readonly advance: (ms: number) => void;
  readonly set: (ms: number) => void;
} {
  let current = startMs;
  return {
    now: () => current,
    advance: (ms: number) => {
      current += ms;
    },
    set: (ms: number) => {
      current = ms;
    },
  };
}

export interface RawEventOverrides {
  id?: string;
  name?: RawEventName;
  timestamp?: number;
  sequenceNumber?: number;
  sessionId?: string;
  pageViewId?: string;
  pageType?: PageType;
  pathname?: string;
  elementId?: string;
  subject?: RawEvent["subject"];
  ecommerce?: RawEvent["ecommerce"];
  data?: RawEvent["data"];
}

export function makeRawEvent(overrides: RawEventOverrides = {}): RawEvent {
  return {
    id: overrides.id ?? makeId("raw"),
    name: overrides.name ?? "element_click",
    timestamp: overrides.timestamp ?? 0,
    sequenceNumber: overrides.sequenceNumber ?? 0,
    sessionId: overrides.sessionId ?? "session-test-1",
    pageViewId: overrides.pageViewId ?? "pv-test-1",
    pageType: overrides.pageType ?? "catalog",
    pathname: overrides.pathname ?? "/katalog",
    ...(overrides.elementId !== undefined && { elementId: overrides.elementId }),
    ...(overrides.subject !== undefined && { subject: overrides.subject }),
    ...(overrides.ecommerce !== undefined && { ecommerce: overrides.ecommerce }),
    ...(overrides.data !== undefined && { data: overrides.data }),
  };
}

export function makeEcommerceContext(
  overrides: Partial<EcommerceContext> = {},
): EcommerceContext {
  return {
    pageType: "catalog",
    pathname: "/katalog",
    activeFilters: [],
    activeFiltersCount: 0,
    ...overrides,
  };
}

export function makeAnalysisContext(args: {
  events: readonly RawEvent[];
  windowStart?: number;
  windowEnd?: number;
  pageType?: PageType;
  pathname?: string;
  previousPageType?: PageType;
  sessionId?: string;
  pageViewId?: string;
  ecommerce?: EcommerceContext;
  clock?: () => number;
}): AnalysisContext {
  const start = args.windowStart ?? 0;
  const end = args.windowEnd ?? 1000;
  return {
    events: args.events,
    window: { startedAt: start, endedAt: end },
    sessionId: args.sessionId ?? "session-test-1",
    pageViewId: args.pageViewId ?? "pv-test-1",
    pageType: args.pageType ?? "catalog",
    pathname: args.pathname ?? "/katalog",
    ...(args.previousPageType !== undefined && {
      previousPageType: args.previousPageType,
    }),
    ecommerce: args.ecommerce ?? makeEcommerceContext(),
    now: args.clock ?? (() => end),
  };
}

export function makeMetaEvent(
  name: MetaEventName,
  overrides: Partial<MetaEvent> = {},
): MetaEvent {
  return {
    schemaVersion: META_EVENT_SCHEMA_VERSION,
    eventId: overrides.eventId ?? makeId("evt"),
    name,
    detectedAt: overrides.detectedAt ?? new Date(0).toISOString(),
    window: overrides.window ?? {
      startedAt: new Date(0).toISOString(),
      endedAt: new Date(1000).toISOString(),
      durationMs: 1000,
    },
    identity: overrides.identity ?? {
      sessionId: "session-test-1",
      pageViewId: "pv-test-1",
    },
    page: overrides.page ?? { type: "catalog", pathname: "/katalog" },
    ...(overrides.subject !== undefined && { subject: overrides.subject }),
    ecommerce: overrides.ecommerce ?? {
      activeFilters: [],
      activeFiltersCount: 0,
    },
    metrics: overrides.metrics ?? {},
    quality: overrides.quality ?? {
      strength: 0.5,
      evidenceCount: 1,
      algorithmVersion: DETECTOR_ALGORITHM_VERSION,
      partialData: false,
    },
    privacy: overrides.privacy ?? {
      containsFreeText: false,
      rawDataUploaded: false,
    },
  };
}

/** Injects a deterministic ID generator. */
export function makeIdGenerator(prefix: string): () => string {
  let n = 0;
  return () => {
    n += 1;
    return `${prefix}-${String(n).padStart(6, "0")}`;
  };
}
