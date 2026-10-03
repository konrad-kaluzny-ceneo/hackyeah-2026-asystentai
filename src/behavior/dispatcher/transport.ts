import type { MetaEventBatchPayload } from "../types";

export interface Transport {
  /**
   * Attempts to deliver the batch. Resolves true on success (HTTP 2xx),
   * false on failure (network error, non-2xx). Never throws.
   */
  send(payload: MetaEventBatchPayload): Promise<boolean>;
}

export interface TransportOptions {
  readonly endpoint: string;
  readonly fetchImpl?: typeof fetch;
  readonly sendBeacon?: (url: string, data: string) => boolean;
}

const JSON_HEADERS = { "Content-Type": "application/json" } as const;

/**
 * Delivery transport for meta event batches. Prefers `navigator.sendBeacon`
 * (no main-thread blocking, tab-close-safe) and falls back to `fetch` with
 * keepalive, then plain `fetch`.
 */
export function createTransport(options: TransportOptions): Transport {
  const fetchImpl = options.fetchImpl ?? globalThis.fetch?.bind(globalThis);
  const sendBeacon =
    options.sendBeacon ??
    (typeof navigator !== "undefined" &&
    typeof navigator.sendBeacon === "function"
      ? (url: string, data: string) =>
          navigator.sendBeacon(
            url,
            new Blob([data], { type: "application/json" }),
          )
      : undefined);

  return {
    async send(payload: MetaEventBatchPayload): Promise<boolean> {
      let body: string;
      try {
        body = JSON.stringify(payload);
      } catch {
        return false;
      }
      if (sendBeacon !== undefined) {
        try {
          const queued = sendBeacon(options.endpoint, body);
          if (queued) {
            return true;
          }
        } catch {
          // fall through to fetch
        }
      }
      if (fetchImpl === undefined) {
        return false;
      }
      try {
        const response = await fetchImpl(options.endpoint, {
          method: "POST",
          headers: JSON_HEADERS,
          body,
          keepalive: true,
        });
        if (response.ok) {
          return true;
        }
      } catch {
        // network error — final fallback below
      }
      try {
        const response = await fetchImpl(options.endpoint, {
          method: "POST",
          headers: JSON_HEADERS,
          body,
        });
        return response.ok;
      } catch {
        return false;
      }
    },
  };
}
