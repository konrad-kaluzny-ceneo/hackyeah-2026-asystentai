import type { MetaEvent } from "./types";

export const MAX_ASSISTANT_META_EVENTS = 10;
export const MIN_ASSISTANT_META_EVENTS_FOR_PROPOSAL = 1;
const MAX_REMEMBERED_EVENT_IDS = 1_000;

export type AssistantProposalTrigger = Readonly<{
  eventId: string;
  metaEvents: readonly MetaEvent[];
}>;

type Listener = () => void;

let history: readonly MetaEvent[] = [];
const rememberedEventIds = new Map<string, true>();
const pendingProposalTriggers: AssistantProposalTrigger[] = [];
let distinctEventCount = 0;
const listeners = new Set<Listener>();

/** Returns the latest bounded MetaEvent window for assistant requests. */
export function getAssistantMetaEventHistory(): readonly MetaEvent[] {
  return history;
}

/** Subscribe to changes in the assistant's bounded MetaEvent window. */
export function subscribeAssistantMetaEventHistory(
  listener: Listener,
): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * Adds events from a successfully dispatched meta-event batch. Event IDs are
 * stable across retries, so duplicates are ignored before applying the cap.
 */
export function recordAssistantMetaEventBatch(
  events: readonly MetaEvent[],
): void {
  if (events.length === 0) return;

  const byId = new Map(history.map((event) => [event.eventId, event]));
  let addedAny = false;
  const orderedEvents = [...events].sort(
    (first, second) => Date.parse(first.detectedAt) - Date.parse(second.detectedAt),
  );

  for (const event of orderedEvents) {
    if (rememberedEventIds.has(event.eventId)) continue;

    rememberEventId(event.eventId);
    byId.set(event.eventId, event);
    distinctEventCount += 1;
    addedAny = true;

    if (distinctEventCount >= MIN_ASSISTANT_META_EVENTS_FOR_PROPOSAL) {
      const snapshot = [...byId.values()]
        .sort((first, second) => Date.parse(first.detectedAt) - Date.parse(second.detectedAt))
        .slice(-MAX_ASSISTANT_META_EVENTS);
      pendingProposalTriggers.push({
        eventId: event.eventId,
        metaEvents: snapshot,
      });
    }
  }

  if (!addedAny) return;

  history = [...byId.values()]
    .sort((first, second) => Date.parse(first.detectedAt) - Date.parse(second.detectedAt))
    .slice(-MAX_ASSISTANT_META_EVENTS);

  notifyListeners();
}

/** Returns the next event-triggered classification request, if one is queued. */
export function takeAssistantProposalTrigger(): AssistantProposalTrigger | null {
  return pendingProposalTriggers.shift() ?? null;
}

/** Puts an uncompleted request back when its UI owner unmounts mid-flight. */
export function requeueAssistantProposalTrigger(
  trigger: AssistantProposalTrigger,
): void {
  pendingProposalTriggers.unshift(trigger);
}

/** Drops queued requests after a proposal becomes visible or the assistant is muted. */
export function clearAssistantProposalTriggers(): void {
  pendingProposalTriggers.length = 0;
}

/** Clears assistant context when the tracker or its session is torn down. */
export function clearAssistantMetaEventHistory(): void {
  if (
    history.length === 0 &&
    rememberedEventIds.size === 0 &&
    pendingProposalTriggers.length === 0
  ) {
    return;
  }

  history = [];
  rememberedEventIds.clear();
  pendingProposalTriggers.length = 0;
  distinctEventCount = 0;
  notifyListeners();
}

function rememberEventId(eventId: string): void {
  rememberedEventIds.set(eventId, true);
  if (rememberedEventIds.size > MAX_REMEMBERED_EVENT_IDS) {
    const oldestEventId = rememberedEventIds.keys().next().value;
    if (oldestEventId !== undefined) rememberedEventIds.delete(oldestEventId);
  }
}

function notifyListeners(): void {
  for (const listener of listeners) {
    listener();
  }
}
