/**
 * Session and page-view identifiers. Per-tab by design (sessionStorage) —
 * we do NOT synchronize tabs; each tab is an independent session.
 *
 * Test hooks (`resetSessionStateForTests`) are provided to avoid reaching
 * into module state from tests.
 */

import { generateId } from "../id";

const SESSION_ID_KEY = "behavior.sessionId.v1";

let cachedSessionId: string | null = null;
let currentPageViewId: string | null = null;

export function getSessionId(): string {
  if (cachedSessionId !== null) {
    return cachedSessionId;
  }
  let id: string | null = null;
  if (typeof window !== "undefined") {
    try {
      id = window.sessionStorage.getItem(SESSION_ID_KEY);
    } catch {
      // sessionStorage unavailable (privacy mode) — fall through to volatile id.
    }
  }
  if (id === null || id.length === 0) {
    id = generateId("sid");
    if (typeof window !== "undefined") {
      try {
        window.sessionStorage.setItem(SESSION_ID_KEY, id);
      } catch {
        // Best-effort only.
      }
    }
  }
  cachedSessionId = id;
  return id;
}

export function getCurrentPageViewId(): string {
  if (currentPageViewId === null) {
    currentPageViewId = generateId("page");
  }
  return currentPageViewId;
}

/**
 * Rotates the page-view ID and returns the previous one (or null on first
 * call). Called by the collector when a location change is detected.
 */
export function rotatePageViewId(): {
  previous: string | null;
  current: string;
} {
  const previous = currentPageViewId;
  currentPageViewId = generateId("page");
  return { previous, current: currentPageViewId };
}

/** Test-only hook: clears cached state. */
export function resetSessionStateForTests(): void {
  cachedSessionId = null;
  currentPageViewId = null;
}
