import { THRESHOLDS } from "../config/thresholds";
import {
  RAW_EVENT_BUFFER_SCHEMA_VERSION,
  type RawEvent,
} from "../types";

type CheckpointPayload = {
  schemaVersion: number;
  savedAt: number;
  sessionId: string;
  events: readonly RawEvent[];
};

/**
 * sessionStorage-backed checkpoint for the raw-event buffer. Best-effort:
 * failures (privacy mode, quota, JSON errors) are swallowed after a single
 * instrumentation hook; the system continues operating on memory alone.
 *
 * Per-tab isolation is intentional (no cross-tab sync) — sessionStorage is
 * scoped to the tab by the platform.
 */
export class Checkpoint {
  constructor(
    private readonly storageKey: string = THRESHOLDS.buffer.checkpointStorageKey,
    private readonly maxBytes: number = THRESHOLDS.buffer.checkpointMaxBytes,
  ) {}

  save(
    sessionId: string,
    events: readonly RawEvent[],
    now: () => number = Date.now,
  ): boolean {
    if (typeof window === "undefined") {
      return false;
    }
    const payload: CheckpointPayload = {
      schemaVersion: RAW_EVENT_BUFFER_SCHEMA_VERSION,
      savedAt: now(),
      sessionId,
      events,
    };
    let serialized: string;
    try {
      serialized = JSON.stringify(payload);
    } catch {
      return false;
    }
    if (serialized.length > this.maxBytes) {
      // Refuse to write an oversized payload rather than fight the quota.
      return false;
    }
    try {
      window.sessionStorage.setItem(this.storageKey, serialized);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Reads the previously-saved checkpoint for the CURRENT session.
   * Returns undefined when nothing usable exists (fresh tab, schema drift,
   * parse error, different sessionId).
   */
  restore(
    sessionId: string,
  ): { events: readonly RawEvent[]; savedAt: number } | undefined {
    if (typeof window === "undefined") {
      return undefined;
    }
    let raw: string | null;
    try {
      raw = window.sessionStorage.getItem(this.storageKey);
    } catch {
      return undefined;
    }
    if (raw === null) {
      return undefined;
    }
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (!isCheckpointPayload(parsed)) {
        return undefined;
      }
      if (parsed.schemaVersion !== RAW_EVENT_BUFFER_SCHEMA_VERSION) {
        // Schema changed — silently drop; raw events are cheap to lose.
        this.clear();
        return undefined;
      }
      if (parsed.sessionId !== sessionId) {
        return undefined;
      }
      return { events: parsed.events, savedAt: parsed.savedAt };
    } catch {
      return undefined;
    }
  }

  clear(): void {
    if (typeof window === "undefined") {
      return;
    }
    try {
      window.sessionStorage.removeItem(this.storageKey);
    } catch {
      // ignore
    }
  }
}

function isCheckpointPayload(value: unknown): value is CheckpointPayload {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const candidate = value as Partial<CheckpointPayload>;
  return (
    typeof candidate.schemaVersion === "number" &&
    typeof candidate.savedAt === "number" &&
    typeof candidate.sessionId === "string" &&
    Array.isArray(candidate.events)
  );
}
