import type { MetaEvent, PageType, RawEvent } from "../types";

/**
 * Lightweight in-memory store for the dev-only debug overlay. Holds
 * telemetry the pipeline already has; not part of the privacy contract
 * (no raw data leaves this store — it's read-only for the overlay).
 *
 * Subscription model is a tiny custom emitter so we don't pull React into
 * the behavior pipeline (the pipeline publishes, the overlay subscribes).
 */

export interface SentMetaEventSummary {
  readonly eventId: string;
  readonly name: MetaEvent["name"];
  readonly detectedAt: string;
  readonly batchId: string;
  readonly sentAt: string;
  readonly strength: number;
  readonly evidenceCount: number;
}

export interface RawEventSummary {
  readonly eventId: string;
  readonly name: RawEvent["name"];
  readonly timestamp: number;
  readonly sequenceNumber: number;
  readonly pageType: PageType;
  readonly pathname: string;
}

export interface AssistantProposalRequestSummary {
  readonly requestedAt: string;
}

export interface DebugState {
  /** Whether the hackathon demo overlay is open (header toggle). */
  readonly overlayOpen: boolean;
  /** Whether the tracker is enabled (true when initBehaviorTracker returned non-null). */
  readonly trackerEnabled: boolean;
  /** Approximation: number of events in the latest sessionStorage checkpoint. */
  readonly rawEventsInSessionStorage: number;
  /** Meta events waiting in the dispatcher queue right now. */
  readonly unsentMetaEvents: number;
  /** Cumulative count of meta events successfully POSTed in this session. */
  readonly totalMetaSentThisSession: number;
  /** Sliding window of the most recently-sent meta events. */
  readonly lastSentMetaEvents: readonly SentMetaEventSummary[];
  /** Raw event summaries retained by the latest sessionStorage checkpoint. */
  readonly lastRawEvents: readonly RawEventSummary[];
  /** Timestamps of assistant proposal requests made by the coordinator. */
  readonly assistantProposalRequests: readonly AssistantProposalRequestSummary[];
  readonly sessionId: string | null;
  readonly pageViewId: string | null;
  readonly pageType: PageType;
  readonly pathname: string;
}

export const MAX_LAST_SENT_META_EVENTS = 100;
export const MAX_ASSISTANT_PROPOSAL_REQUESTS = 100;

const INITIAL_STATE: DebugState = {
  overlayOpen: false,
  trackerEnabled: false,
  rawEventsInSessionStorage: 0,
  unsentMetaEvents: 0,
  totalMetaSentThisSession: 0,
  lastSentMetaEvents: [],
  lastRawEvents: [],
  assistantProposalRequests: [],
  sessionId: null,
  pageViewId: null,
  pageType: "unknown",
  pathname: "/",
};

let state: DebugState = INITIAL_STATE;

const listeners = new Set<() => void>();

function notify(): void {
  for (const listener of listeners) {
    listener();
  }
}

export function getDebugState(): DebugState {
  return state;
}

/** Merge-update; notifies subscribers only when something actually changed. */
export function setDebugState(partial: Partial<DebugState>): void {
  const next: DebugState = { ...state, ...partial };
  if (shallowEqualDebugState(state, next)) {
    return;
  }
  state = next;
  notify();
}

/**
 * Called by the dispatcher's `onBatchSent` hook. Prepends the freshly-sent
 * events, newest first, and bumps the cumulative counter. An oversized batch
 * keeps its latest events inside the sliding window.
 */
export function recordBatchSent(args: {
  batchId: string;
  sentAt: string;
  events: readonly MetaEvent[];
}): void {
  if (args.events.length === 0) {
    return;
  }
  const summaries: SentMetaEventSummary[] = args.events.map((e) => ({
    eventId: e.eventId,
    name: e.name,
    detectedAt: e.detectedAt,
    batchId: args.batchId,
    sentAt: args.sentAt,
    strength: e.quality.strength,
    evidenceCount: e.quality.evidenceCount,
  }));
  const newestFirst = summaries
    .slice(-MAX_LAST_SENT_META_EVENTS)
    .reverse();
  const merged = [...newestFirst, ...state.lastSentMetaEvents].slice(
    0,
    MAX_LAST_SENT_META_EVENTS,
  );
  state = {
    ...state,
    totalMetaSentThisSession:
      state.totalMetaSentThisSession + args.events.length,
    lastSentMetaEvents: merged,
  };
  notify();
}

export function recordAssistantProposalRequest(
  requestedAt = new Date().toISOString(),
): void {
  state = {
    ...state,
    assistantProposalRequests: [
      { requestedAt },
      ...state.assistantProposalRequests,
    ].slice(0, MAX_ASSISTANT_PROPOSAL_REQUESTS),
  };
  notify();
}

export function subscribeDebug(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function setBehaviorDebugOverlayOpen(open: boolean): void {
  setDebugState({ overlayOpen: open });
}

export function toggleBehaviorDebugOverlay(): void {
  setDebugState({ overlayOpen: !state.overlayOpen });
}

/** Test hook: resets the store to the initial state. */
export function resetDebugStateForTests(): void {
  state = INITIAL_STATE;
  listeners.clear();
}

function shallowEqualDebugState(a: DebugState, b: DebugState): boolean {
  return (
    a.overlayOpen === b.overlayOpen &&
    a.trackerEnabled === b.trackerEnabled &&
    a.rawEventsInSessionStorage === b.rawEventsInSessionStorage &&
    a.unsentMetaEvents === b.unsentMetaEvents &&
    a.totalMetaSentThisSession === b.totalMetaSentThisSession &&
    a.lastSentMetaEvents === b.lastSentMetaEvents &&
    areRawEventSummariesEqual(a.lastRawEvents, b.lastRawEvents) &&
    a.assistantProposalRequests === b.assistantProposalRequests &&
    a.sessionId === b.sessionId &&
    a.pageViewId === b.pageViewId &&
    a.pageType === b.pageType &&
    a.pathname === b.pathname
  );
}

function areRawEventSummariesEqual(
  a: readonly RawEventSummary[],
  b: readonly RawEventSummary[],
): boolean {
  if (a === b) return true;
  if (a.length !== b.length) return false;
  return a.every((event, index) => {
    const other = b[index];
    return (
      event.eventId === other.eventId &&
      event.name === other.name &&
      event.timestamp === other.timestamp &&
      event.sequenceNumber === other.sequenceNumber &&
      event.pageType === other.pageType &&
      event.pathname === other.pathname
    );
  });
}
