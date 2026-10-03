import {
  DETECTOR_ALGORITHM_VERSION,
  META_EVENT_SCHEMA_VERSION,
  type AnalysisContext,
  type EcommerceContext,
  type MetaEvent,
  type MetaEventName,
  type RawEvent,
  type Subject,
} from "../types";

export interface BuildMetaEventInput {
  readonly name: MetaEventName;
  readonly ctx: AnalysisContext;
  /** Raw events that caused detection (used for evidenceCount and window). */
  readonly evidence: readonly RawEvent[];
  /** 0-1 confidence heuristic. */
  readonly strength: number;
  readonly metrics: Record<string, string | number | boolean>;
  readonly subject?: Subject;
  readonly partialData?: boolean;
  readonly detectedAtMs?: number;
  readonly eventId: string;
}

/**
 * Assembles a MetaEvent that satisfies the contract. Every detector MUST go
 * through this builder — never construct MetaEvent literals by hand.
 */
export function buildMetaEvent(input: BuildMetaEventInput): MetaEvent {
  const detectedAtMs = input.detectedAtMs ?? input.ctx.now();
  const windowMs = computeWindowMs(input.evidence, input.ctx);
  const startedAt = detectedAtMs - windowMs;
  return {
    schemaVersion: META_EVENT_SCHEMA_VERSION,
    eventId: input.eventId,
    name: input.name,
    detectedAt: new Date(detectedAtMs).toISOString(),
    window: {
      startedAt: new Date(startedAt).toISOString(),
      endedAt: new Date(detectedAtMs).toISOString(),
      durationMs: windowMs,
    },
    identity: {
      sessionId: input.ctx.sessionId,
      pageViewId: input.ctx.pageViewId,
    },
    page: {
      type: input.ctx.pageType,
      pathname: input.ctx.pathname,
      previousPageType: input.ctx.previousPageType,
    },
    ...(input.subject !== undefined && { subject: input.subject }),
    ecommerce: pickEcommerceSlice(input.ctx.ecommerce),
    metrics: input.metrics,
    quality: {
      strength: clamp01(input.strength),
      evidenceCount: input.evidence.length,
      algorithmVersion: DETECTOR_ALGORITHM_VERSION,
      partialData: input.partialData ?? false,
    },
    privacy: {
      containsFreeText: false,
      rawDataUploaded: false,
    },
  };
}

function computeWindowMs(
  evidence: readonly RawEvent[],
  ctx: AnalysisContext,
): number {
  if (evidence.length === 0) {
    // Fallback: the supplied analysis window.
    return Math.max(0, ctx.window.endedAt - ctx.window.startedAt);
  }
  let min = Number.POSITIVE_INFINITY;
  let max = 0;
  for (const event of evidence) {
    if (event.timestamp < min) min = event.timestamp;
    if (event.timestamp > max) max = event.timestamp;
  }
  return Math.max(0, max - min);
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}

function pickEcommerceSlice(ctx: EcommerceContext) {
  return {
    activeFilters: ctx.activeFilters,
    activeFiltersCount: ctx.activeFiltersCount,
    ...(ctx.sortingType !== undefined && { sortingType: ctx.sortingType }),
    ...(ctx.resultsCountBucket !== undefined && {
      resultsCountBucket: ctx.resultsCountBucket,
    }),
    ...(ctx.priceBucket !== undefined && { priceBucket: ctx.priceBucket }),
    ...(ctx.deliveryCostBucket !== undefined && {
      deliveryCostBucket: ctx.deliveryCostBucket,
    }),
    ...(ctx.availability !== undefined && { availability: ctx.availability }),
    ...(ctx.priceVisible !== undefined && { priceVisible: ctx.priceVisible }),
    ...(ctx.deliveryVisible !== undefined && {
      deliveryVisible: ctx.deliveryVisible,
    }),
    ...(ctx.availabilityVisible !== undefined && {
      availabilityVisible: ctx.availabilityVisible,
    }),
  };
}

/** Dedupe key helpers used by the dispatcher/deduplicator. */
export function detectorCooldownKey(
  name: MetaEventName,
  subject?: Subject,
): string {
  if (subject === undefined) {
    return name;
  }
  return `${name}:${subject.type}:${subject.id ?? ""}`;
}

/** Generates a deterministic event id for tests via injection. */
export type MetaEventIdGenerator = () => string;
