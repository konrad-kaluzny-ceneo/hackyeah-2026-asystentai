/**
 * Single source of truth for every numeric/time threshold used by the
 * behavior pipeline. No magic numbers in collector/detectors/dispatcher.
 *
 * All durations are milliseconds unless suffixed otherwise.
 */
export const THRESHOLDS = {
  buffer: {
    /** Hard cap on retained raw events. */
    maxEvents: 500,
    /** Raw events older than this are eligible for eviction. */
    rawEventTtlMs: 10 * 60 * 1000, // 10 min
    /** How often we checkpoint the buffer to sessionStorage. */
    checkpointIntervalMs: 30 * 1000, // 30 s
    /** sessionStorage key. */
    checkpointStorageKey: "behavior.rawEvents.v1",
    /** Approx size ceiling for the serialized checkpoint (defensive). */
    checkpointMaxBytes: 256 * 1024,
  },
  scroll: {
    /** Inactivity window before emitting a scroll_summary. */
    idleMs: 1500,
    /** Time span used to group rapid scroll samples into one burst. */
    burstWindowMs: 700,
    /** Minimum scroll samples required for a burst. */
    burstMinEvents: 3,
    /** Total travelled distance as a fraction of viewport height. */
    burstMinDistanceRatio: 0.4,
  },
  idle: {
    /** Inactivity window before emitting idle_started. */
    idleMs: 4000,
    /** Mousemove handling cadence to avoid high-frequency listener work. */
    activityThrottleMs: 100,
  },
  analyzer: {
    /** Idle-time analysis cadence. */
    scheduleIntervalMs: 5 * 1000,
    /** Default look-back window supplied to detectors. */
    defaultWindowMs: 60 * 1000,
    /** Longer window for slow-burn detectors (navigation_loop etc.). */
    longWindowMs: 5 * 60 * 1000,
  },
  dispatcher: {
    maxBatchEvents: 50,
    /** Batch payload size ceiling (approximate JSON bytes). */
    maxBatchBytes: 128 * 1024,
    /** Flush cadence. */
    flushIntervalMs: 10 * 1000,
    /** Debounce after a meta event is enqueued before an early flush. */
    debounceMs: 250,
    /** Exponential backoff series for failed flushes. */
    retryBackoffMs: [250, 1000, 4000],
    /** Cap on the unsent queue (drop oldest beyond this). */
    maxQueueEvents: 500,
  },
  deduplicator: {
    /** Time a dedupe key stays "seen". */
    ttlMs: 5 * 60 * 1000,
    /** Max dedupe entries kept (LRU-ish via oldest-first eviction). */
    maxEntries: 512,
    /** Per-detector cooldown after it emits a meta event. */
    cooldowns: {
      rage_click: 30 * 1000,
      dead_click_cluster: 30 * 1000,
      repeated_validation_failure: 60 * 1000,
      technical_friction: 60 * 1000,
      navigation_loop: 2 * 60 * 1000,
      no_progress_window: 60 * 1000,
      rapid_filter_churn: 60 * 1000,
      product_revisit: 60 * 1000,
      comparison_oscillation: 2 * 60 * 1000,
      category_interest: 60 * 1000,
      filter_engagement: 60 * 1000,
      hesitation_dwell: 60 * 1000,
      rapid_scroll_burst: 30 * 1000,
      price_focus: 60 * 1000,
      search_refinement_loop: 2 * 60 * 1000,
      assistant_proposal_dismissed: 0,
      delivery_information_seeking: 60 * 1000,
      availability_information_seeking: 60 * 1000,
      sustained_product_interest: 60 * 1000,
    },
  },
  detectors: {
    rage_click: {
      minClicks: 3,
      windowMs: 2500,
      /** Time after the first click during which a UI change "counts". */
      uiChangeGraceMs: 800,
    },
    dead_click_cluster: {
      minClicks: 2,
      windowMs: 2000,
      /** Silence after the last click to confirm the click had no effect. */
      silenceMs: 1500,
    },
    repeated_validation_failure: {
      minFailures: 2,
      windowMs: 30 * 1000,
    },
    technical_friction: {
      /** Max wait after a failed interaction before user retry qualifies. */
      retryWindowMs: 15 * 1000,
    },
    navigation_loop: {
      minCycleLength: 2,
      maxCycleLength: 6,
      minRepeatCount: 2,
      windowMs: 5 * 60 * 1000,
    },
    no_progress_window: {
      windowMs: 90 * 1000,
      /**
       * Events that count as "progress" for the demo journey. Deliberately
       * EXCLUDES filter/search changes — those are activity, not progress:
       * the user is still circling the catalog. Progress means advancing
       * toward a purchase decision.
       */
      progressEvents: ["product_viewed", "offer_viewed"],
    },
    rapid_filter_churn: {
      minChanges: 6,
      windowMs: 30 * 1000,
      /** Undone filter = added then removed (or vice versa) within window. */
      minUndoneCount: 2,
    },
    product_revisit: {
      /** Time spent on the product that makes an exposure "meaningful". */
      minDwellMs: 2000,
      minDistinctIntermediates: 1,
    },
    comparison_oscillation: {
      minCandidates: 2,
      maxCandidates: 4,
      minTransitions: 4,
      windowMs: 3 * 60 * 1000,
    },
    delivery_information_seeking: {
      minExposuresOrInteractions: 2,
      windowMs: 60 * 1000,
    },
    availability_information_seeking: {
      minExposuresOrInteractions: 2,
      windowMs: 60 * 1000,
    },
    sustained_product_interest: {
      minDwellMs: 10 * 1000,
      windowMs: 5 * 60 * 1000,
    },
    category_interest: {
      minDwellMs: 6 * 1000,
      windowMs: 60 * 1000,
    },
    filter_engagement: {
      minChanges: 2,
      minRetainedCount: 1,
      windowMs: 60 * 1000,
    },
    hesitation_dwell: {
      minIdleMs: 4 * 1000,
      windowMs: 60 * 1000,
    },
    rapid_scroll_burst: {
      minBursts: 1,
      windowMs: 30 * 1000,
    },
    price_focus: {
      minDwellMs: 3 * 1000,
      windowMs: 60 * 1000,
    },
    search_refinement_loop: {
      minSearches: 3,
      windowMs: 90 * 1000,
    },
    assistant_proposal_dismissed: {
      // Stateless spike detector: fires whenever the dismiss click appears in the analysis window.
      windowMs: 60 * 1000,
    },
  },
} as const;

export type Thresholds = typeof THRESHOLDS;
