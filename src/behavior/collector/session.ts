/**
 * Session and page-view identifiers. Per-tab by design (sessionStorage) —
 * we do NOT synchronize tabs; each tab is an independent session.
 *
 * Test hooks (`resetSessionStateForTests`) are provided to avoid reaching
 * into module state from tests.
 */

const SESSION_ID_KEY = "behavior.sessionId.v1";

let cachedSessionId: string | null = null;
let currentPageViewId: string | null = null;

function generateId(): string {
  // crypto.randomUUID is broadly available in modern browsers and Node 20+.
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return crypto.randomUUID();
  }
  // Fallback for very old environments; not cryptographically strong but
  // only used as a session identifier in demo contexts.
  return `sid-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 14)}`;
}

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
    id = generateId();
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
    currentPageViewId = generateId();
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
  currentPageViewId = generateId();
  return { previous, current: currentPageViewId };
}

/** Test-only hook: clears cached state. */
export function resetSessionStateForTests(): void {
  cachedSessionId = null;
  currentPageViewId = null;
}
