import type { MetaEvent } from "./types";

export const MAX_ASSISTANT_META_EVENTS = 10;

type Listener = () => void;

let history: readonly MetaEvent[] = [];
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
  for (const event of events) {
    if (!byId.has(event.eventId)) {
      byId.set(event.eventId, event);
    }
  }

  const nextHistory = [...byId.values()]
    .sort((first, second) => Date.parse(first.detectedAt) - Date.parse(second.detectedAt))
    .slice(-MAX_ASSISTANT_META_EVENTS);

  if (sameEventIds(history, nextHistory)) return;

  history = nextHistory;
  for (const listener of listeners) {
    listener();
  }
}

/** Clears assistant context when the tracker or its session is torn down. */
export function clearAssistantMetaEventHistory(): void {
  if (history.length === 0) return;

  history = [];
  for (const listener of listeners) {
    listener();
  }
}

function sameEventIds(
  first: readonly MetaEvent[],
  second: readonly MetaEvent[],
): boolean {
  return (
    first.length === second.length &&
    first.every((event, index) => event.eventId === second[index]?.eventId)
  );
}
