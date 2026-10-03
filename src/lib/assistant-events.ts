import type { CatalogEvent, CatalogEventInput } from "@/lib/catalog-types";

const EVENTS_KEY = "asystent-ai:catalog-events:v1";
const MUTED_UNTIL_KEY = "asystent-ai:muted-until:v1";
const MAX_EVENTS = 120;

export const CATALOG_SESSION_CHANGED = "asystent-ai:catalog-session-changed";

function canUseSessionStorage(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return typeof window.sessionStorage !== "undefined";
  } catch {
    return false;
  }
}

function notifySubscribers(): void {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(CATALOG_SESSION_CHANGED));
  }
}

function createEventId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

/** Reads this tab's bounded, anonymous browsing history. */
export function readCatalogEvents(): CatalogEvent[] {
  if (!canUseSessionStorage()) return [];

  try {
    const raw = window.sessionStorage.getItem(EVENTS_KEY);
    if (!raw) return [];

    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed as CatalogEvent[];
  } catch {
    return [];
  }
}

/** Adds one anonymous catalog signal to the current tab's session. */
export function trackCatalogEvent(input: CatalogEventInput): void {
  if (!canUseSessionStorage()) return;

  const event = {
    ...input,
    id: createEventId(),
    timestamp: new Date().toISOString(),
  } as CatalogEvent;

  try {
    const events = [...readCatalogEvents(), event].slice(-MAX_EVENTS);
    window.sessionStorage.setItem(EVENTS_KEY, JSON.stringify(events));
    notifySubscribers();
  } catch {
    // Storage can be disabled or full; browsing remains available without signals.
  }
}

export function readAssistantMutedUntil(): number {
  if (!canUseSessionStorage()) return 0;

  try {
    const value = Number(window.sessionStorage.getItem(MUTED_UNTIL_KEY));
    return Number.isFinite(value) ? value : 0;
  } catch {
    return 0;
  }
}

export function muteAssistantFor(durationMs: number): void {
  if (!canUseSessionStorage()) return;

  try {
    window.sessionStorage.setItem(
      MUTED_UNTIL_KEY,
      String(Date.now() + Math.max(0, durationMs)),
    );
    notifySubscribers();
  } catch {
    // A failed preference write should not interrupt the catalog interaction.
  }
}
